import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, Edit3, Search, Shield, ShieldCheck, ShieldAlert, ShieldX, Camera, Upload, Bell, BellOff, Eye, Calendar, Store, Tag, Hash, FileText, Receipt, Clock, AlertTriangle, CheckCircle, ScanLine, Loader2 } from 'lucide-react';
import api from '../services/api';

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }

const CATEGORIES = [
  { value: 'elektronik', label: 'Elektronik', icon: '💻' },
  { value: 'beyaz_esya', label: 'Beyaz Eşya', icon: '🧊' },
  { value: 'kiyafet', label: 'Kıyafet', icon: '👕' },
  { value: 'ayakkabi', label: 'Ayakkabı', icon: '👟' },
  { value: 'mobilya', label: 'Mobilya', icon: '🛋️' },
  { value: 'otomotiv', label: 'Otomotiv', icon: '🚗' },
  { value: 'saglik', label: 'Sağlık', icon: '🏥' },
  { value: 'spor', label: 'Spor', icon: '⚽' },
  { value: 'diger', label: 'Diğer', icon: '📦' },
];

const DOC_TYPES = [
  { value: 'fatura', label: 'Fatura', icon: '🧾' },
  { value: 'garanti_belgesi', label: 'Garanti Belgesi', icon: '📜' },
];

function getCategoryInfo(val) { return CATEGORIES.find(c => c.value === val) || CATEGORIES[CATEGORIES.length - 1]; }
function getDocTypeInfo(val) { return DOC_TYPES.find(d => d.value === val) || DOC_TYPES[0]; }

function getWarrantyStatus(endDate) {
  if (!endDate) return { label: 'Belirsiz', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: 'unknown' };
  const now = new Date();
  const end = new Date(endDate);
  const daysLeft = Math.ceil((end - now) / 86400000);
  if (daysLeft < 0) return { label: 'Süresi Dolmuş', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: 'expired', daysLeft };
  if (daysLeft <= 30) return { label: `${daysLeft} gün kaldı`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: 'expiring', daysLeft };
  if (daysLeft <= 90) return { label: `${daysLeft} gün kaldı`, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: 'active', daysLeft };
  return { label: `${daysLeft} gün kaldı`, color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'active', daysLeft };
}

function getWarrantyProgress(purchaseDate, endDate) {
  if (!purchaseDate || !endDate) return 0;
  const start = new Date(purchaseDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

// Compress image to thumbnail
function compressImage(base64, maxWidth = 200, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Warranties() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filter, setFilter] = useState('all'); // all | fatura | garanti_belgesi | expiring
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/warranties');
      setItems(data.items);
    } catch (err) {
      console.error('Fetch Warranties Error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleDelete = (id) => {
    const item = items.find(i => i.id === id);
    setDeleteConfirm({
      id,
      title: 'Kaydı Sil',
      message: `"${item?.product_name}" kaydını silmek istediğinize emin misiniz?`
    });
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/warranties/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchItems();
    } catch {}
  };

  const toggleNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await api.put(`/warranties/${id}/notification`);
      fetchItems();
    } catch {}
  };

  // Stats
  const totalCount = items.length;
  const activeWarranties = items.filter(i => {
    if (!i.warranty_end_date) return false;
    return new Date(i.warranty_end_date) > new Date();
  }).length;
  const expiringWarranties = items.filter(i => {
    if (!i.warranty_end_date) return false;
    const days = Math.ceil((new Date(i.warranty_end_date) - new Date()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const totalValue = items.reduce((s, i) => s + (i.purchase_price || 0), 0);

  // Filtered items
  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchesFilter = filter === 'all'
        || (filter === 'expiring' && item.warranty_end_date && Math.ceil((new Date(item.warranty_end_date) - new Date()) / 86400000) <= 30 && Math.ceil((new Date(item.warranty_end_date) - new Date()) / 86400000) >= 0)
        || item.document_type === filter;
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = !q
        || (item.product_name || '').toLowerCase().includes(q)
        || (item.brand || '').toLowerCase().includes(q)
        || (item.store_name || '').toLowerCase().includes(q)
        || (item.model || '').toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [items, filter, searchQuery]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Shield size={26} style={{ color: 'var(--primary)' }} />
            Garanti Belgesi & Fatura Kasası
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Fatura ve garanti belgelerinizi güvenle saklayın</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary">
          <Plus size={18} /> Yeni Kayıt
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Receipt size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Toplam Kayıt</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid #10b981', animationDelay: '50ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <ShieldCheck size={20} style={{ color: '#10b981' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Aktif Garanti</p>
              <p className="text-xl font-bold" style={{ color: '#10b981' }}>{activeWarranties}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid #f59e0b', animationDelay: '100ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <ShieldAlert size={20} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Süresi Yaklaşan</p>
              <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>{expiringWarranties}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 animate-fade-in" style={{ borderLeft: '4px solid #8b5cf6', animationDelay: '150ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
              <Tag size={20} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Toplam Değer</p>
              <p className="text-lg font-bold" style={{ color: '#8b5cf6' }}>{formatMoney(totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { val: 'all', label: 'Tümü', icon: '📋' },
            { val: 'fatura', label: 'Faturalar', icon: '🧾' },
            { val: 'garanti_belgesi', label: 'Garanti Belgeleri', icon: '📜' },
            { val: 'expiring', label: '⚠️ Süresi Yaklaşan' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilter(f.val)}
              className={`btn btn-sm ${filter === f.val ? 'btn-primary' : 'btn-secondary'}`}>
              {f.icon && <span>{f.icon}</span>} {f.label}
              {f.val === 'expiring' && expiringWarranties > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{expiringWarranties}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-64">
          <Search size={18} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          <input type="text" className="input w-full" placeholder="Ürün, marka, mağaza ara..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>Henüz kayıt bulunmuyor</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Fatura ve garanti belgelerinizi ekleyin</p>
          <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary mt-4"><Plus size={18} /> İlk Kaydı Oluştur</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Search size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Arama kriterlerine uygun kayıt bulunamadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, i) => {
            const cat = getCategoryInfo(item.category);
            const status = getWarrantyStatus(item.warranty_end_date);
            const progress = getWarrantyProgress(item.purchase_date, item.warranty_end_date);
            const docType = getDocTypeInfo(item.document_type);

            return (
              <div key={item.id} onClick={() => setSelectedItem(item)}
                className="card p-4 animate-fade-in cursor-pointer hover:shadow-lg transition-all border-transparent hover:border-[var(--primary)] border-2"
                style={{ animationDelay: `${i * 60}ms` }}>
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: status.bg }}>
                      {cat.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.product_name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.brand && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.brand}</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {/* Notification toggle */}
                    <button onClick={(e) => toggleNotification(item.id, e)}
                      className="btn-icon btn-ghost btn-sm relative"
                      title={item.notification_enabled ? 'Bildirim aktif — kapatmak için tıklayın' : 'Bildirim kapalı — açmak için tıklayın'}
                      style={{ color: item.notification_enabled ? '#f59e0b' : 'var(--text-muted)' }}>
                      {item.notification_enabled ? <Bell size={16} /> : <BellOff size={16} />}
                      {item.notification_enabled && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" style={{ animation: 'pulse-glow 2s infinite' }} />
                      )}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditItem(item); setShowForm(true); }} className="btn-icon btn-ghost btn-sm"><Edit3 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="btn-icon btn-ghost btn-sm hover:!text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Info row */}
                <div className="flex items-center gap-3 text-[11px] mb-3 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><span>{docType.icon}</span> {docType.label}</span>
                  {item.purchase_price > 0 && <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{formatMoney(item.purchase_price)}</span>}
                  {item.store_name && <span className="flex items-center gap-1"><Store size={11} /> {item.store_name}</span>}
                </div>

                {/* Warranty progress */}
                {item.warranty_end_date && (
                  <div>
                    <div className="progress-bar" style={{ height: '6px' }}>
                      <div className="h-full rounded" style={{
                        width: `${progress}%`,
                        background: status.icon === 'expired' ? '#ef4444' : status.icon === 'expiring' ? '#f59e0b' : 'linear-gradient(90deg, var(--primary), var(--secondary))',
                        borderRadius: '4px',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(item.purchase_date)}</span>
                      <span className="text-[10px] font-medium" style={{ color: status.color }}>{formatDate(item.warranty_end_date)}</span>
                    </div>
                  </div>
                )}

                {/* Photo indicator */}
                {item.photo_thumbnail && (
                  <div className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Camera size={11} /> Fotoğraf mevcut
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <WarrantyFormModal
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); fetchItems(); }}
        />
      )}

      {selectedItem && (
        <WarrantyDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onToggleNotification={async (id) => { await api.put(`/warranties/${id}/notification`); fetchItems(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal-content p-6 animate-slide-up" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{deleteConfirm.title}</h3>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{deleteConfirm.message}</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn btn-secondary flex-1">İptal</button>
              <button type="button" onClick={executeDelete} className="btn bg-rose-500 hover:bg-rose-600 text-white flex-1 font-bold">Evet, Sil</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


// ============================================================================
// FORM MODAL (with OCR)
// ============================================================================
function WarrantyFormModal({ editItem, onClose, onSaved }) {
  const [form, setForm] = useState({
    product_name: editItem?.product_name || '',
    brand: editItem?.brand || '',
    model: editItem?.model || '',
    serial_number: editItem?.serial_number || '',
    category: editItem?.category || 'elektronik',
    purchase_date: editItem?.purchase_date ? editItem.purchase_date.split('T')[0] : '',
    warranty_end_date: editItem?.warranty_end_date ? editItem.warranty_end_date.split('T')[0] : '',
    purchase_price: editItem?.purchase_price || '',
    store_name: editItem?.store_name || '',
    document_type: editItem?.document_type || 'fatura',
    notification_enabled: editItem?.notification_enabled || false,
    notes: editItem?.notes || '',
  });
  const [photo, setPhoto] = useState(editItem?.photo_base64 || null);
  const [thumbnail, setThumbnail] = useState(editItem?.photo_thumbnail || null);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const updateField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  // Auto-calculate warranty end date (2 years from purchase)
  useEffect(() => {
    if (form.purchase_date && !form.warranty_end_date && !editItem) {
      const d = new Date(form.purchase_date);
      d.setFullYear(d.getFullYear() + 2);
      updateField('warranty_end_date', d.toISOString().split('T')[0]);
    }
  }, [form.purchase_date]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setPhoto(base64);
      const thumb = await compressImage(base64);
      setThumbnail(thumb);
    };
    reader.readAsDataURL(file);
  };

  const handleOCR = async () => {
    if (!photo) return;
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const Tesseract = await import('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(photo, 'tur+eng', {
        logger: () => {},
      });
      setOcrResult(text);
      parseOCRText(text);
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrResult('OCR işlemi başarısız oldu. Lütfen fotoğrafı kontrol edin.');
    }
    setOcrLoading(false);
  };

  const parseOCRText = (text) => {
    if (!text) return;

    // Parse dates (dd/mm/yyyy or dd.mm.yyyy or dd-mm-yyyy)
    const dateRegex = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/g;
    const dates = [];
    let dateMatch;
    while ((dateMatch = dateRegex.exec(text)) !== null) {
      const [, day, month, year] = dateMatch;
      const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2040) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    if (dates.length > 0 && !form.purchase_date) {
      // Earliest date is likely purchase date
      dates.sort();
      updateField('purchase_date', dates[0]);
      if (dates.length > 1) {
        updateField('warranty_end_date', dates[dates.length - 1]);
      }
    }

    // Parse prices (₺, TL, TRY followed or preceded by numbers)
    const priceRegex = /(?:₺|TL|TRY)\s*([0-9.,]+)|([0-9.,]+)\s*(?:₺|TL|TRY)/gi;
    const prices = [];
    let priceMatch;
    while ((priceMatch = priceRegex.exec(text)) !== null) {
      const numStr = (priceMatch[1] || priceMatch[2]).replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) prices.push(num);
    }
    if (prices.length > 0 && !form.purchase_price) {
      // Largest price is likely total
      updateField('purchase_price', Math.max(...prices));
    }

    // Parse brand names (common brands)
    const knownBrands = ['Samsung', 'Apple', 'iPhone', 'Xiaomi', 'Huawei', 'Sony', 'LG', 'Bosch', 'Arçelik', 'Beko', 'Vestel', 'Philips', 'Tefal', 'Dyson', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Canon', 'Nikon', 'Panasonic', 'Toshiba', 'Electrolux', 'Siemens', 'Miele', 'Grundig', 'Casper', 'Monster', 'JBL', 'Marshall', 'Nike', 'Adidas', 'Puma', 'New Balance', 'Zara', 'H&M', 'Mango', 'LC Waikiki', 'DeFacto', 'Koton'];
    const textUpper = text.toUpperCase();
    if (!form.brand) {
      for (const brand of knownBrands) {
        if (textUpper.includes(brand.toUpperCase())) {
          updateField('brand', brand);
          break;
        }
      }
    }

    // Parse serial numbers (long alphanumeric sequences)
    const serialRegex = /(?:seri\s*(?:no|numaras[ıi])?|S\/N|serial)[:\s]*([A-Z0-9-]{6,})/gi;
    let serialMatch;
    if (!form.serial_number && (serialMatch = serialRegex.exec(text)) !== null) {
      updateField('serial_number', serialMatch[1]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_name.trim()) return;
    setLoading(true);
    try {
      const payload = {
        ...form,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : 0,
        photo_base64: photo,
        photo_thumbnail: thumbnail,
      };
      if (editItem) {
        await api.put(`/warranties/${editItem.id}`, payload);
      } else {
        await api.post('/warranties', payload);
      }
      onSaved();
    } catch (err) {
      console.error('Save error:', err);
    }
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-0 overflow-hidden" style={{ maxWidth: '580px' }}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
              {editItem ? <Edit3 size={20} /> : <Plus size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-bold">{editItem ? 'Kaydı Düzenle' : 'Yeni Fatura / Garanti Belgesi'}</h3>
              <p className="text-xs opacity-80">Bilgileri girin veya fotoğraftan tanıtın</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={22} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[65vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', background: 'var(--bg-primary)' }}>
          {/* Photo Upload Section */}
          <div className="card p-4" style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)' }}>
            <label className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Camera size={16} style={{ color: 'var(--primary)' }} /> Fotoğraf
            </label>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Belge" className="w-full max-h-48 object-contain rounded-lg border" style={{ borderColor: 'var(--border)' }} />
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={handleOCR} disabled={ocrLoading}
                    className="btn btn-sm flex-1 font-bold"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', opacity: ocrLoading ? 0.7 : 1 }}>
                    {ocrLoading ? <><Loader2 size={14} className="animate-spin" /> Tanınıyor...</> : <><ScanLine size={14} /> Fotoğraftan Tanı</>}
                  </button>
                  <button type="button" onClick={() => { setPhoto(null); setThumbnail(null); setOcrResult(null); }}
                    className="btn btn-sm btn-secondary">
                    <Trash2 size={14} /> Kaldır
                  </button>
                </div>
                {ocrResult && (
                  <div className="mt-3 p-3 rounded-lg text-xs animate-fade-in" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="font-bold mb-1 flex items-center gap-1" style={{ color: 'var(--primary)' }}>
                      <CheckCircle size={12} /> OCR Sonucu — Alanlar otomatik dolduruldu
                    </p>
                    <p className="max-h-20 overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--text-muted)', scrollbarWidth: 'thin' }}>{ocrResult.substring(0, 500)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => cameraInputRef.current?.click()}
                  className="btn btn-secondary flex-1 py-6 flex-col gap-1"
                  style={{ borderStyle: 'dashed' }}>
                  <Camera size={22} style={{ color: 'var(--primary)' }} />
                  <span className="text-xs">Fotoğraf Çek</span>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary flex-1 py-6 flex-col gap-1"
                  style={{ borderStyle: 'dashed' }}>
                  <Upload size={22} style={{ color: 'var(--secondary)' }} />
                  <span className="text-xs">Dosya Seç</span>
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Belge Türü</label>
            <div className="flex gap-2">
              {DOC_TYPES.map(dt => (
                <button key={dt.value} type="button" onClick={() => updateField('document_type', dt.value)}
                  className={`flex-1 btn btn-sm ${form.document_type === dt.value ? 'btn-primary' : 'btn-secondary'}`}>
                  {dt.icon} {dt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ürün Adı *</label>
              <input className="input" placeholder="ör: iPhone 15 Pro" value={form.product_name}
                onChange={(e) => updateField('product_name', e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Marka</label>
              <input className="input" placeholder="ör: Apple" value={form.brand}
                onChange={(e) => updateField('brand', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Model</label>
              <input className="input" placeholder="ör: A2848" value={form.model}
                onChange={(e) => updateField('model', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Seri Numarası</label>
              <input className="input" placeholder="ör: SN-12345678" value={form.serial_number}
                onChange={(e) => updateField('serial_number', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Mağaza / Satıcı</label>
              <input className="input" placeholder="ör: MediaMarkt" value={form.store_name}
                onChange={(e) => updateField('store_name', e.target.value)} />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Kategori</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => updateField('category', cat.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.category === cat.value ? 'text-white shadow-md' : 'hover:opacity-80'}`}
                  style={{
                    background: form.category === cat.value ? 'var(--primary)' : 'var(--bg-secondary)',
                    color: form.category === cat.value ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates and Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Satın Alma Tarihi</label>
              <input type="date" className="input" value={form.purchase_date}
                onChange={(e) => updateField('purchase_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Garanti Bitiş</label>
              <input type="date" className="input" value={form.warranty_end_date}
                onChange={(e) => updateField('warranty_end_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fiyat (₺)</label>
              <input type="number" className="input" placeholder="0" value={form.purchase_price}
                onChange={(e) => updateField('purchase_price', e.target.value)} />
            </div>
          </div>

          {/* Notification toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: form.notification_enabled ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)' }}>
                {form.notification_enabled ? <Bell size={18} style={{ color: '#f59e0b' }} /> : <BellOff size={18} style={{ color: '#94a3b8' }} />}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Garanti Hatırlatıcısı</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Süre bitmesine 30 gün kala bildirim alın</p>
              </div>
            </div>
            <button type="button" onClick={() => updateField('notification_enabled', !form.notification_enabled)}
              className="w-12 h-7 rounded-full transition-all relative"
              style={{ background: form.notification_enabled ? '#f59e0b' : 'var(--border)' }}>
              <div className="w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm"
                style={{ left: form.notification_enabled ? '26px' : '4px' }} />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notlar</label>
            <textarea className="input" rows={2} placeholder="Ek bilgi veya notlar..." value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)} style={{ resize: 'vertical', minHeight: '60px' }} />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2 sticky bottom-0 pb-1" style={{ background: 'var(--bg-primary)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}


// ============================================================================
// DETAILS MODAL
// ============================================================================
function WarrantyDetailsModal({ item, onClose, onToggleNotification }) {
  const cat = getCategoryInfo(item.category);
  const status = getWarrantyStatus(item.warranty_end_date);
  const progress = getWarrantyProgress(item.purchase_date, item.warranty_end_date);
  const docType = getDocTypeInfo(item.document_type);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  const StatusIcon = status.icon === 'expired' ? ShieldX : status.icon === 'expiring' ? ShieldAlert : ShieldCheck;

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-0 max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 text-white" style={{
          background: status.icon === 'expired'
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : status.icon === 'expiring'
              ? 'linear-gradient(135deg, #f59e0b, #d97706)'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)'
        }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl">
                {cat.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold">{item.product_name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.brand && <span className="text-sm opacity-90">{item.brand}</span>}
                  {item.model && <span className="text-sm opacity-70">• {item.model}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onToggleNotification(item.id)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title={item.notification_enabled ? 'Bildirim aktif' : 'Bildirim kapalı'}>
                {item.notification_enabled ? <Bell size={20} /> : <BellOff size={20} />}
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2 mb-4">
            <StatusIcon size={18} />
            <span className="text-sm font-medium">{status.label}</span>
            <span className="ml-auto text-sm font-medium opacity-80">{docType.icon} {docType.label}</span>
          </div>

          {/* Warranty progress */}
          {item.warranty_end_date && (
            <div>
              <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-xs opacity-80">
                <span>{formatDate(item.purchase_date)}</span>
                <span>{formatDate(item.warranty_end_date)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4" style={{ background: 'var(--bg-primary)' }}>
          {/* Photo */}
          {item.photo_base64 && (
            <div className="card p-3 animate-fade-in">
              <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Camera size={13} /> Belge Fotoğrafı
              </p>
              <img src={showFullPhoto ? item.photo_base64 : (item.photo_thumbnail || item.photo_base64)}
                alt="Belge" className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxHeight: showFullPhoto ? 'none' : '180px', objectFit: 'contain' }}
                onClick={() => setShowFullPhoto(!showFullPhoto)} />
              <p className="text-[10px] text-center mt-1" style={{ color: 'var(--text-muted)' }}>
                {showFullPhoto ? 'Küçültmek için tıklayın' : 'Büyütmek için tıklayın'}
              </p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            {item.serial_number && (
              <InfoCard icon={<Hash size={14} />} label="Seri Numarası" value={item.serial_number} />
            )}
            {item.purchase_price > 0 && (
              <InfoCard icon={<Tag size={14} />} label="Satın Alma Fiyatı" value={formatMoney(item.purchase_price)} />
            )}
            {item.store_name && (
              <InfoCard icon={<Store size={14} />} label="Mağaza / Satıcı" value={item.store_name} />
            )}
            <InfoCard icon={<FileText size={14} />} label="Kategori" value={`${cat.icon} ${cat.label}`} />
            {item.purchase_date && (
              <InfoCard icon={<Calendar size={14} />} label="Satın Alma" value={formatDate(item.purchase_date)} />
            )}
            {item.warranty_end_date && (
              <InfoCard icon={<Clock size={14} />} label="Garanti Bitiş" value={formatDate(item.warranty_end_date)} highlight={status.color} />
            )}
          </div>

          {/* Notification status */}
          <div className="flex items-center gap-3 p-3 rounded-xl animate-fade-in" style={{
            background: item.notification_enabled ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
            border: `1px solid ${item.notification_enabled ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`
          }}>
            {item.notification_enabled
              ? <Bell size={16} style={{ color: '#f59e0b' }} />
              : <BellOff size={16} style={{ color: 'var(--text-muted)' }} />
            }
            <span className="text-xs font-medium" style={{ color: item.notification_enabled ? '#f59e0b' : 'var(--text-muted)' }}>
              {item.notification_enabled
                ? 'Garanti süresinin bitmesine 30 gün kala bildirim alacaksınız'
                : 'Bildirim kapalı'}
            </span>
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="card p-3">
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>Notlar</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{item.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function InfoCard({ icon, label, value, highlight }) {
  return (
    <div className="p-3 rounded-xl animate-fade-in" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p className="text-sm font-bold" style={{ color: highlight || 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
