import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Filter, Trash2, Edit3, TrendingUp, TrendingDown, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FileText, FileSpreadsheet, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { utils } from 'xlsx';
import api from '../services/api';
import { robotoBase64 } from '../utils/fonts/Roboto.js';

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payees, setPayees] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', category_id: '', payee_id: '', search: '', start_date: '', end_date: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeDateRange, setActiveDateRange] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [total, setTotal] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [selectedYear, setSelectedYear] = useState('Tümü');
  const [showImportModal, setShowImportModal] = useState(false);

  const handleDateRangeClick = (rangeStr) => {
    setActiveDateRange(rangeStr);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (rangeStr) {
      case 'Gecmis':
        start = new Date(0);
        end = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'Gecen Ay':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'Gecen 3 Ay':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'Gecen Ceyrek':
        const prevQuarter = Math.floor(now.getMonth() / 3) - 1;
        start = new Date(now.getFullYear(), prevQuarter * 3, 1);
        end = new Date(now.getFullYear(), (prevQuarter + 1) * 3, 0);
        break;
      case 'Bugun':
        break;
      case 'Bu Hafta':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        break;
      case 'Bu Ay':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'Bu Ceyrek':
        const currQuarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currQuarter * 3, 1);
        end = new Date(now.getFullYear(), (currQuarter + 1) * 3, 0);
        break;
      case '15 Gun':
        start = new Date(now.setDate(now.getDate() - 15));
        end = new Date();
        break;
      case 'Gelecek 3 Ay':
        start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 4, 0);
        break;
      default:
        start = ''; end = '';
    }

    setFilter(f => ({ 
      ...f, 
      start_date: start ? start.toISOString().split('T')[0] : '', 
      end_date: end ? end.toISOString().split('T')[0] : '' 
    }));
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.category_id) params.append('category_id', filter.category_id);
      if (filter.payee_id) params.append('payee_id', filter.payee_id);
      if (filter.start_date) params.append('start_date', filter.start_date);
      if (filter.end_date) params.append('end_date', filter.end_date);
      params.append('limit', '100');
      const { data } = await api.get(`/transactions?${params}`);
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data.categories);
    } catch {}
  };

  const fetchPayees = async () => {
    try {
      const { data } = await api.get('/payees');
      setPayees(data.payees);
    } catch {}
  };

  useEffect(() => { fetchCategories(); fetchPayees(); }, []);
  useEffect(() => { fetchTransactions(); }, [filter.type, filter.category_id, filter.payee_id, filter.start_date, filter.end_date]);

  useEffect(() => {
    const handleRefresh = () => fetchTransactions();
    window.addEventListener('transaction-added', handleRefresh);
    return () => window.removeEventListener('transaction-added', handleRefresh);
  }, []);

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.delete(`/transactions/${deleteConfirmId}`);
      fetchTransactions();
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem silinirken bir hata oluştu.');
    }
    setDeleteConfirmId(null);
  };

  const handleEdit = (tx) => { setEditItem(tx); setShowForm(true); };

  const availableYears = [...new Set(transactions.map(tx => new Date(tx.date).getFullYear().toString()))].sort((a, b) => b - a);

  const filtered = transactions.filter(tx => {
    if (selectedYear !== 'Tümü' && !tx.date.startsWith(selectedYear)) return false;
    
    if (!filter.search) return true;
    const s = filter.search.toLowerCase();
    return (tx.description?.toLowerCase().includes(s) || tx.category_name?.toLowerCase().includes(s) || tx.payee_name?.toLowerCase().includes(s));
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalIncome = filtered.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : 0), 0);
  const totalExpense = filtered.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0);

  const exportToExcel = async () => {
    try {
      if (filtered.length === 0) return alert('Dışa aktarılacak kayıt bulunamadı.');
      
      const data = filtered.map(tx => ({
        'Tarih': new Date(tx.date).toLocaleDateString('tr-TR'),
        'Harcama Yeri': tx.payee_name || '-',
        'Kategori': tx.category_name || '-',
        'Açıklama': tx.description || '-',
        'Gelir (₺)': tx.type === 'income' ? tx.amount : 0,
        'Gider (₺)': tx.type === 'expense' ? tx.amount : 0
      }));

      data.push({
        'Tarih': '', 'Harcama Yeri': '', 'Kategori': '', 'Açıklama': 'Genel Toplam:', 
        'Gelir (₺)': totalIncome, 'Gider (₺)': totalExpense
      });

      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "İşlemler");
      
      const { write } = await import('xlsx');
      const b64 = write(wb, { bookType: 'xlsx', type: 'base64' });
      const link = document.createElement('a');
      link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
      link.download = `Islemler_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('Excel dışa aktarılırken bir hata oluştu: ' + err.message);
    }
  };

  const exportToPDF = () => {
    try {
      if (filtered.length === 0) return alert('Dışa aktarılacak kayıt bulunamadı.');

      const doc = new jsPDF();
      doc.setLanguage('tr');
      doc.setDocumentProperties({
        title: 'İşlemler Raporu',
        subject: 'Gelir ve gider işlemleri listesi',
        author: 'Aile Bütçesi',
        creator: 'Aile Bütçesi Finans Yönetimi',
      });
      
      // Add custom font for Turkish characters
      doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');

      doc.setFontSize(18);
      doc.text('İşlemler Raporu', 14, 22);
      doc.setFontSize(10);
      doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);
      
      const tableData = filtered.map(tx => [
        new Date(tx.date).toLocaleDateString('tr-TR'),
        tx.payee_name || '-',
        tx.category_name || '-',
        tx.description || '-',
        tx.type === 'income' ? formatMoney(tx.amount) : '-',
        tx.type === 'expense' ? formatMoney(tx.amount) : '-'
      ]);

      autoTable(doc, {
        head: [['Tarih', 'Harcama Yeri', 'Kategori', 'Açıklama', 'Gelir', 'Gider']],
        body: tableData,
        foot: [['', '', '', 'Genel Toplam:', formatMoney(totalIncome), formatMoney(totalExpense)]],
        startY: 36,
        styles: { font: 'Roboto', fontSize: 9 },
        headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
        footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } }
      });

      const b64 = doc.output('datauristring');
      const link = document.createElement('a');
      link.href = b64;
      link.download = `Islemler_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('PDF dışa aktarılırken bir hata oluştu: ' + err.message);
    }
  };

  useEffect(() => { setCurrentPage(1); }, [filter.search, filter.type, filter.category_id, filter.payee_id, filter.start_date, filter.end_date]);

  const dateRanges = ['Geçmiş', 'Geçen Ay', 'Geçen 3 Ay', 'Geçen Çeyrek', 'Bugün', 'Bu Hafta', 'Bu Ay', 'Bu Çeyrek', '15 Gün', 'Gelecek 3 Ay'];
  const dateRangesMapped = ['Gecmis', 'Gecen Ay', 'Gecen 3 Ay', 'Gecen Ceyrek', 'Bugun', 'Bu Hafta', 'Bu Ay', 'Bu Ceyrek', '15 Gun', 'Gelecek 3 Ay'];

  return (
    <div className="animate-fade-in relative pb-10">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-30 pt-2 pb-5 -mt-2 mb-5" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>İşlemler</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{filtered.length} kayıt bulundu</p>
          </div>
          
          {transactions.length > 0 && (
            <div className="flex items-center">
              <select 
                className="select !py-2 font-medium"
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
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

        {/* Filters Area */}
        <div className="flex flex-col gap-3 relative">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input className="input w-full" style={{ paddingLeft: '40px' }} placeholder="Ara..." value={filter.search} onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))} />
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setShowImportModal(true)}
              className="btn bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 gap-2"
              title="Excel İçe Aktar"
            >
              <Upload size={18} /> <span className="hidden sm:inline">İçe Aktar</span>
            </button>
            <button 
              onClick={exportToExcel}
              className="btn bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 gap-2"
              title="Excel İndir"
            >
              <FileSpreadsheet size={18} /> <span className="hidden sm:inline">Excel</span>
            </button>
            <button 
              onClick={exportToPDF}
              className="btn bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 gap-2"
              title="PDF İndir"
            >
              <FileText size={18} /> <span className="hidden sm:inline">PDF</span>
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`btn gap-2 transition-all ${showFilters ? 'bg-[var(--primary)] text-white shadow-md border-transparent' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Filter size={18} /> <span className="hidden sm:inline">Filtreler</span>
            </button>
          </div>
        </div>

        {/* Popover / Expandable Filter Panel */}
        {showFilters && (
          <div className="card p-5 w-full md:w-[400px] absolute right-0 top-[52px] z-20 shadow-xl border border-[var(--border)] animate-fade-in origin-top-right">
            
            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-gray-400 mb-3 tracking-wider">VADE</h3>
              <div className="flex flex-wrap gap-2">
                {dateRanges.map((label, i) => {
                  const val = dateRangesMapped[i];
                  return (
                    <button
                      key={val}
                      onClick={() => handleDateRangeClick(val)}
                      className={`text-sm px-2 py-1 rounded-md transition-colors ${activeDateRange === val ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-gray-400 mb-2 tracking-wider">KATEGORİ</h3>
              <select className="select w-full" value={filter.category_id} onChange={(e) => setFilter(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Tümü</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-gray-400 mb-2 tracking-wider">ÖDEME YERİ</h3>
              <select className="select w-full" value={filter.payee_id} onChange={(e) => setFilter(f => ({ ...f, payee_id: e.target.value }))}>
                <option value="">Tümü</option>
                {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="pt-2 border-t border-[var(--border)] mt-4">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <Filter size={16} /> Gelişmiş Filtreler
              </button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-4 animate-slide-down">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h3 className="text-[11px] font-bold text-gray-400 mb-2 tracking-wider">BAŞLANGIÇ</h3>
                      <input 
                        type="date" 
                        className="input w-full text-sm" 
                        value={filter.start_date} 
                        onChange={(e) => setFilter(f => ({ ...f, start_date: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold text-gray-400 mb-2 tracking-wider">BİTİŞ</h3>
                      <input 
                        type="date" 
                        className="input w-full text-sm" 
                        value={filter.end_date} 
                        onChange={(e) => setFilter(f => ({ ...f, end_date: e.target.value }))} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>📭 Henüz işlem bulunamadı</p>
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-quick-add'))} className="btn btn-primary mt-4"><Plus size={18} /> İlk İşlemi Ekle</button>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Tarih</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Harcama Yeri</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Kategori</th>
                  <th className="text-left text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Açıklama</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Gelir</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Gider</th>
                  <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((tx, i) => (
                  <tr key={`${tx.record_type}_${tx.id}`} className="transition-colors hover:bg-[var(--bg-secondary)]" style={{ borderBottom: '1px solid var(--border)', animationDelay: `${i * 30}ms` }}>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(tx.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tx.payee_name ? <span className="flex items-center gap-1">📍 {tx.payee_name}</span> : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {tx.category_name && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          {tx.category_icon} {tx.category_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {tx.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-emerald-500">
                      {tx.type === 'income' ? formatMoney(tx.amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-red-500">
                      {tx.type === 'expense' ? formatMoney(tx.amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {tx.record_type === 'transaction' ? (
                          <>
                            <button type="button" onClick={() => handleEdit(tx)} className="btn-icon btn-ghost btn-sm" title="İşlemi Düzenle"><Edit3 size={15} /></button>
                            <button type="button" onClick={() => setDeleteConfirmId(tx.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500 relative z-10" title="İşlemi Sil"><Trash2 size={15} /></button>
                          </>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider" title="İptal için takvimler sayfasını kullanın">Taksit Ödemesi</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan="4" className="px-4 py-4 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Genel Toplam:</td>
                  <td className="px-4 py-4 text-sm font-bold text-right text-emerald-500">{formatMoney(totalIncome)}</td>
                  <td className="px-4 py-4 text-sm font-bold text-right text-red-500">{formatMoney(totalExpense)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Toplam: {filtered.length}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="btn btn-icon btn-ghost btn-sm disabled:opacity-30"
                      title="İlk Sayfa"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      className="btn btn-icon btn-ghost btn-sm disabled:opacity-30"
                      title="Önceki"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => page === 1 || page === totalPages || Math.abs(currentPage - page) <= 1)
                      .map((page, i, arr) => (
                        <div key={page} className="flex items-center">
                          {i > 0 && arr[i - 1] !== page - 1 && <span className="px-1 text-gray-400">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page ? 'gradient-primary text-white shadow-md' : 'btn-ghost'}`}
                            style={currentPage === page ? {} : { color: 'var(--text-secondary)' }}
                          >
                            {page}
                          </button>
                        </div>
                    ))}

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="btn btn-icon btn-ghost btn-sm disabled:opacity-30"
                      title="Sonraki"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="btn btn-icon btn-ghost btn-sm disabled:opacity-30"
                      title="Son Sayfa"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                )}
                
                <div className="relative">
                  <select 
                    className="select !py-1.5 !pl-3 !pr-8 text-sm cursor-pointer appearance-none bg-white font-medium"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{ minHeight: '34px', borderColor: 'var(--border)' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <TransactionFormModal
          categories={categories}
          payees={payees}
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); fetchTransactions(); }}
        />
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <ExcelImportModal
          onClose={() => setShowImportModal(false)}
          onSaved={() => {
            setShowImportModal(false);
            fetchTransactions();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirmId(null)}>
          <div className="modal-content p-6" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>İşlemi Sil</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Bu işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirmId(null)} className="btn btn-secondary flex-1">İptal</button>
              <button type="button" onClick={executeDelete} className="btn btn-danger flex-1">Evet, Sil</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ExcelImportModal({ onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [details, setDetails] = useState([]);

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/transactions/template', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'gelir_gider_sablonu.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Şablon indirilirken bir hata oluştu.');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setSuccess('');
      setDetails([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Lütfen yüklemek için bir dosya seçin.');

    setUploading(true);
    setError('');
    setSuccess('');
    setDetails([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/transactions/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess(`${data.count} adet işlem başarıyla içeri aktarıldı!`);
      setFile(null);
      setTimeout(() => {
        onSaved();
      }, 1500);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Dosya yüklenirken bir hata oluştu.';
      setError(errMsg);
      if (err.response?.data?.details) {
        setDetails(err.response.data.details);
      }
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6" style={{ maxWidth: '500px' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Excel ile Gelir/Gider Ekle</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>

        <div className="space-y-5">
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
            <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>1. Güncel Şablonu İndirin</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Sistemdeki güncel kategorileriniz ve harcama yerleriniz Excel şablonuna otomatik olarak açılır liste şeklinde eklenir. Taksitli işlemler için <strong>Taksit Sayısı</strong> sütununu doldurabilirsiniz.
            </p>
            <button 
              type="button" 
              onClick={handleDownloadTemplate} 
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <Download size={16} /> Şablonu İndir (.xlsx)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 rounded-xl border border-[var(--border)]">
              <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>2. Doldurduğunuz Şablonu Yükleyin</h4>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Doldurduğunuz Excel dosyasını seçin ve yükleyin.
              </p>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-lg p-6 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] transition-all cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload size={32} className="text-primary mb-2" />
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {file ? file.name : 'Dosya Seçin veya Sürükleyin'}
                </span>
                <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Yalnızca .xlsx veya .xls dosyaları
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>
                <span className="font-semibold">{error}</span>
                {details.length > 0 && (
                  <ul className="mt-2 text-xs list-disc list-inside max-h-32 overflow-y-auto space-y-1">
                    {details.map((d, index) => <li key={index}>{d}</li>)}
                  </ul>
                )}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--income-light)', color: 'var(--income)' }}>
                {success}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
              <button 
                type="submit" 
                disabled={uploading || !file} 
                className="btn btn-primary flex-1"
              >
                {uploading ? 'Yükleniyor...' : 'Verileri İçe Aktar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TransactionFormModal({ categories, payees, editItem, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: editItem?.type || 'expense',
    amount: editItem?.amount || '',
    description: editItem?.description || '',
    category_id: editItem?.category_id || '',
    payee_id: editItem?.payee_id || '',
    date: editItem?.date || new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredCats = categories.filter(c => c.type === form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('Geçerli tutar girin.');
    setLoading(true);
    try {
      if (editItem) {
        await api.put(`/transactions/${editItem.id}`, { ...form, amount: parseFloat(form.amount) });
      } else {
        await api.post('/transactions', { ...form, amount: parseFloat(form.amount) });
      }
      onSaved();
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) { setError(err.response?.data?.error || 'Hata oluştu.'); }
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editItem ? 'İşlemi Düzenle' : 'Yeni İşlem'}</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'var(--expense-light)', color: 'var(--expense)' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))} className={`flex-1 btn ${form.type === 'expense' ? 'gradient-expense text-white' : 'btn-secondary'}`}>
              <TrendingDown size={16} /> Gider
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))} className={`flex-1 btn ${form.type === 'income' ? 'gradient-income text-white' : 'btn-secondary'}`}>
              <TrendingUp size={16} /> Gelir
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tutar (₺)</label>
            <input type="number" step="0.01" className="input text-xl font-bold text-center" placeholder="0.00" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Açıklama</label>
            <input className="input" placeholder="Açıklama..." value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Harcama Yeri</label>
              <select className="select" value={form.payee_id} onChange={(e) => setForm(f => ({ ...f, payee_id: e.target.value }))}>
                <option value="">Seçiniz</option>
                {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kategori</label>
              <select className="select" value={form.category_id} onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Seçiniz</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tarih</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Ekle'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
