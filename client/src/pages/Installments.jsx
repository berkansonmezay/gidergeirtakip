import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, CreditCard, Check, ChevronDown, ChevronUp, Trash2, X, Calendar, Bell, BellOff, Edit3 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Installments() {
  const { type: activeTab = 'expense' } = useParams();
  const navigate = useNavigate();
  const [installments, setInstallments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [payees, setPayees] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', category_id: '', payee_id: '' });
  const [unpayConfirmId, setUnpayConfirmId] = useState(null);
  const [payDateConfirmId, setPayDateConfirmId] = useState(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState('Tümü');

  const fetchInstallments = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/installments?type=${activeTab}`);
      setInstallments(data.installments);
    } catch {}
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchInstallments();
    api.get(`/categories?type=${activeTab}`).then(r => setCategories(r.data.categories)).catch(() => {});
    api.get('/payees').then(r => setPayees(r.data.payees)).catch(() => {});
    setCurrentPage(1);
    setSelectedYear('Tümü');
  }, [activeTab, fetchInstallments]);

  useEffect(() => {
    const handleRefresh = () => fetchInstallments();
    window.addEventListener('installment-added', handleRefresh);
    window.addEventListener('transaction-added', handleRefresh);
    return () => {
      window.removeEventListener('installment-added', handleRefresh);
      window.removeEventListener('transaction-added', handleRefresh);
    };
  }, [activeTab, fetchInstallments]);

  const handlePay = async () => {
    if (!payDateConfirmId) return;
    try {
      await api.put(`/installments/payments/${payDateConfirmId}/pay`, { date: payDate });
      await fetchInstallments();
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) {
      alert(err.response?.data?.error || 'Ödeme işlemi başarısız oldu.');
    }
    setPayDateConfirmId(null);
  };

  const executeUnpay = async () => {
    if (!unpayConfirmId) return;
    try {
      await api.put(`/installments/payments/${unpayConfirmId}/unpay`);
      await fetchInstallments();
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem geri alınırken bir hata oluştu.');
    }
    setUnpayConfirmId(null);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { 
      await api.delete(`/installments/${deleteConfirmId}`); 
      await fetchInstallments(); 
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) {
      alert(err.response?.data?.error || 'Silme işlemi başarısız oldu.');
    }
    setDeleteConfirmId(null);
  };

  const submitEdit = async () => {
    if (!editForm.description) return alert("Açıklama boş olamaz.");
    try {
      await api.put(`/installments/${editItem.id}`, editForm);
      setEditItem(null);
      await fetchInstallments();
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) {
      alert(err.response?.data?.error || "Güncelleme başarısız oldu.");
    }
  };

  const availableYears = [...new Set(installments.map(i => i.start_date.split('-')[0]))].sort((a, b) => b - a);

  const filteredInstallments = installments.filter(inst => {
    if (selectedYear === 'Tümü') return true;
    return inst.start_date.startsWith(selectedYear);
  });

  const totalUpcoming = filteredInstallments.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0);
  const grandTotalAmount = filteredInstallments.reduce((s, i) => s + i.total_amount, 0);
  const grandTotalPaid = filteredInstallments.reduce((s, i) => s + (i.paid_amount || 0), 0);

  const totalPages = Math.ceil(filteredInstallments.length / ITEMS_PER_PAGE);
  const paginatedInstallments = filteredInstallments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [selectedYear]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {activeTab === 'expense' ? 'Taksitli Borçlar' : 'Taksitli Alacaklar'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filteredInstallments.length} kayıt • Toplam kalan tutar: {formatMoney(totalUpcoming)}
          </p>
        </div>
        
        {installments.length > 0 && (
          <div className="flex items-center">
            <select 
              className="select !py-2 font-medium"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              style={{ minWidth: '130px' }}
            >
              <option value="Tümü">Tüm Yıllar</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y} Yılı</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : installments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] border-dashed">
          <CreditCard size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Henüz {activeTab === 'expense' ? 'ödeme' : 'tahsilat'} kaydı yok</p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-quick-add', { detail: { type: activeTab } }))} 
            className="btn btn-primary mt-4"
          >
            <Plus size={18} /> İlk Kaydı Ekle
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th className="w-10"></th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Tarih</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>{activeTab === 'expense' ? 'Harcama Yeri' : 'Tahsil Yeri'}</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Kategori</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Açıklama</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Toplam Tutar</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>{activeTab === 'expense' ? 'Ödenen' : 'Tahsilat'}</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInstallments.map((inst, i) => (
                  <InstallmentGroupRow 
                    key={inst.id} 
                    inst={inst} 
                    onPay={(paymentId) => {
                      setPayDateConfirmId(paymentId);
                      setPayDate(new Date().toISOString().split('T')[0]);
                    }} 
                    onUnpay={(paymentId) => setUnpayConfirmId(paymentId)} 
                    onDelete={() => setDeleteConfirmId(inst.id)} 
                    onEdit={() => {
                      setEditItem(inst);
                      setEditForm({
                        description: inst.description || '',
                        category_id: inst.category_id || '',
                        payee_id: inst.payee_id || '',
                        total_amount: inst.total_amount || 0,
                        installment_count: inst.installment_count || 1,
                        start_date: inst.start_date || new Date().toISOString().split('T')[0]
                      });
                    }}
                    delay={i} 
                    activeTab={activeTab} 
                  />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan="5" className="px-4 py-4 text-right font-bold text-xs text-gray-500 uppercase tracking-wider">
                    Genel Toplam
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>
                    {formatMoney(grandTotalAmount)}
                  </td>
                  <td className={`px-4 py-4 text-right font-bold text-[14px] ${activeTab === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {formatMoney(grandTotalPaid)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-4 pb-4">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Toplam {filteredInstallments.length} kayıttan {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredInstallments.length)} arası gösteriliyor
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="btn btn-icon btn-ghost btn-sm disabled:opacity-30"
                >
                  <ChevronDown className="rotate-90" size={16} />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page ? 'gradient-primary text-white shadow-md' : 'btn-ghost'}`}
                    style={currentPage === page ? {} : { color: 'var(--text-secondary)' }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="btn btn-icon btn-ghost btn-sm disabled:opacity-30"
                >
                  <ChevronDown className="-rotate-90" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editItem && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditItem(null)}>
          <div className="modal-content p-0 overflow-hidden max-w-md">
            <div className={`p-5 text-white ${activeTab === 'income' ? 'gradient-income' : 'gradient-expense'}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Taksit Düzenle</h2>
                <button onClick={() => setEditItem(null)} className="p-1 rounded-lg hover:bg-white/20 transition-colors"><X size={20} /></button>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Toplam Tutar (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-2xl font-bold text-center"
                  value={editForm.total_amount}
                  onChange={e => setEditForm({ ...editForm, total_amount: e.target.value })}
                  style={{ fontSize: '1.5rem', padding: '14px' }}
                />
              </div>

              <div className="p-4 rounded-2xl border transition-all" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Taksit Sayısı</label>
                    <input
                      type="number"
                      min="2"
                      max="60"
                      className="input !py-2"
                      value={editForm.installment_count}
                      onChange={(e) => setEditForm({ ...editForm, installment_count: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>İlk Taksit</label>
                    <input
                      type="date"
                      className="input !py-2 !text-[11px]"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Taksit Tutarı</label>
                    <div className="h-10 flex items-center px-2 rounded-xl font-bold text-[13px]" style={{ background: 'var(--bg-primary)', color: 'var(--primary)' }}>
                      ₺{editForm.total_amount && editForm.installment_count ? (parseFloat(editForm.total_amount) / parseInt(editForm.installment_count)).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{activeTab === 'expense' ? 'Harcama Yeri' : 'Tahsil Yeri'}</label>
                  <select className="select" value={editForm.payee_id} onChange={e => setEditForm({ ...editForm, payee_id: e.target.value })}>
                    <option value="">Seçiniz</option>
                    {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Kategori</label>
                  <select className="select" value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}>
                    <option value="">Seçiniz</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Açıklama</label>
                <input className="input" placeholder="İşlem açıklaması..." value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>

              <button
                onClick={submitEdit}
                className={`btn w-full btn-lg text-white font-semibold mt-4 ${activeTab === 'income' ? 'gradient-income' : 'gradient-expense'}`}
                style={{ borderRadius: '12px' }}
              >
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal-content p-6 max-w-sm text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Taksit Silinsin mi?</h3>
            <p className="text-gray-500 mb-6 text-sm">Bu taksit grubunu ve buna bağlı tüm ödeme kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="btn btn-secondary flex-1">Vazgeç</button>
              <button onClick={executeDelete} className="btn bg-red-500 hover:bg-red-600 text-white flex-1 font-bold">Evet, Sil</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Unpay Confirmation */}
      {unpayConfirmId && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setUnpayConfirmId(null)}>
          <div className="modal-content p-6 max-w-sm text-center">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <X size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Ödeme Geri Alınsın mı?</h3>
            <p className="text-gray-500 mb-6 text-sm">Son yapılan ödeme işlemini iptal etmek istediğinize emin misiniz?</p>
            <div className="flex gap-3">
              <button onClick={() => setUnpayConfirmId(null)} className="btn btn-secondary flex-1">Vazgeç</button>
              <button onClick={executeUnpay} className="btn bg-orange-500 hover:bg-orange-600 text-white flex-1 font-bold">Geri Al</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Pay Date Confirmation */}
      {payDateConfirmId && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setPayDateConfirmId(null)}>
          <div className="modal-content p-6 max-w-sm text-center">
            <div className={`w-16 h-16 ${activeTab === 'expense' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">İşlem Tarihini Seçin</h3>
            <p className="text-gray-500 mb-4 text-sm">Lütfen {activeTab === 'expense' ? 'ödemenin yapıldığı' : 'tahsilatın alındığı'} tarihi girin.</p>
            
            <input 
              type="date" 
              className="input mb-6" 
              value={payDate} 
              onChange={e => setPayDate(e.target.value)} 
            />

            <div className="flex gap-3">
              <button onClick={() => setPayDateConfirmId(null)} className="btn btn-secondary flex-1">Vazgeç</button>
              <button onClick={handlePay} className={`btn ${activeTab === 'expense' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white flex-1 font-bold`}>Onayla</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function InstallmentGroupRow({ inst, onPay, onUnpay, onDelete, onEdit, delay, activeTab }) {
  const [expanded, setExpanded] = useState(false);
  const isComplete = inst.paid_amount >= inst.total_amount;
  
  const nextPayment = inst.payments?.find(p => !p.is_paid);
  const lastPaidPayment = [...(inst.payments || [])].reverse().find(p => p.is_paid);
  
  const [reminderLoading, setReminderLoading] = useState(false);
  const toggleReminder = async (e) => {
    e.stopPropagation();
    setReminderLoading(true);
    try {
      await api.put(`/installments/${inst.id}/toggle-reminder`);
      window.dispatchEvent(new Event('installment-added')); // Re-fetch all
    } catch {}
    setReminderLoading(false);
  };

  return (
    <>
      <tr 
        className={`transition-colors hover:bg-[var(--bg-secondary)] cursor-pointer ${isComplete ? 'opacity-70' : ''}`} 
        style={{ borderBottom: '1px solid var(--border)', animationDelay: `${delay * 10}ms` }}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-center" style={{ color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </td>
        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {new Date(inst.start_date).toLocaleDateString('tr-TR')}
        </td>
        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {inst.payee_name || '-'}
        </td>
        <td className="px-4 py-3">
          {inst.category_name && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              {inst.category_icon} {inst.category_name}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
          <div className="flex items-center gap-2">
            <span>{inst.description}</span>
            <span className="flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
              <Calendar size={12} />
              {inst.payments?.filter(p => p.is_paid).length || 0}/{inst.installment_count} taksit
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm font-bold text-right text-gray-500">
          {formatMoney(inst.total_amount)}
        </td>
        <td className={`px-4 py-3 text-sm font-bold text-right ${activeTab === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>
          {formatMoney(inst.paid_amount || 0)}
        </td>
        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <button 
              onClick={toggleReminder} 
              disabled={reminderLoading}
              className={`btn-icon btn-ghost btn-sm transition-all ${inst.reminder_enabled ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'text-gray-400'}`}
              title={inst.reminder_enabled ? 'Hatırlatıcıyı Kapat' : 'Hatırlatıcıyı Aç'}
            >
              {inst.reminder_enabled ? <Bell size={15} fill="currentColor" /> : <BellOff size={15} />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }} 
              className="btn-icon btn-ghost btn-sm" 
              title="Düzenle"
            >
              <Edit3 size={15} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }} 
              className="btn-icon btn-ghost btn-sm hover:!text-red-500" 
              title="Tüm kaydı sil"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>
      
      {expanded && (
        <tr style={{ background: 'var(--bg-secondary)' }}>
          <td colSpan="8" className="px-0 py-0 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="px-12 py-4 shadow-inner" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div className="text-[11px] tracking-wider font-bold text-gray-400 mb-3 uppercase">Taksit Detayları</div>
              <table className="w-full text-sm">
                <tbody>
                  {inst.payments?.map(p => (
                    <tr key={p.id} className="border-b last:border-0 border-gray-100 dark:border-gray-800">
                      <td className="py-2.5 px-3 w-16 text-gray-400 font-medium">#{p.payment_number}</td>
                      <td className="py-2.5 px-3 text-gray-600 font-medium">{new Date(p.due_date).toLocaleDateString('tr-TR')}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-700">{formatMoney(p.amount)}</td>
                      <td className="py-2.5 px-3 w-48 text-right">
                        {p.is_paid ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md">
                              <Check size={12} strokeWidth={3} /> {activeTab === 'expense' ? 'Ödendi' : 'Tahsil Edildi'}
                            </span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onUnpay(p.id); }} 
                              className="btn-icon btn-ghost btn-sm hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors" 
                              title={activeTab === 'expense' ? 'Ödemeyi Geri Al' : 'Tahsilatı Geri Al'}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="inline-flex text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md">
                              Bekliyor
                            </span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onPay(p.id); }} 
                              className={`btn-icon btn-sm ${activeTab === 'expense' ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'} rounded-md transition-colors`}
                              title={activeTab === 'expense' ? 'Öde' : 'Tahsil Et'}
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
