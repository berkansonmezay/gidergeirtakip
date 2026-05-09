import { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, 
  Search, Download, FileSpreadsheet, List, Grid, Layout, 
  Trash2, Edit2, X, Clock, AlertCircle, Bell, Repeat
} from 'lucide-react';
import api from '../services/api';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const EVENT_TYPES = [
  { id: 'task', label: 'Görev', color: '#3b82f6', bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500' },
  { id: 'event', label: 'Etkinlik', color: '#8b5cf6', bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500' },
  { id: 'birthday', label: 'Doğum Günü', color: '#ec4899', bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-500' },
  { id: 'payment', label: 'Ödeme', color: '#ef4444', bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500' },
];

const RECURRENCE_OPTIONS = [
  { id: 'none', label: 'Tek Seferlik' },
  { id: 'daily', label: 'Her Gün' },
  { id: 'weekly', label: 'Her Hafta' },
  { id: 'monthly', label: 'Her Ay' },
  { id: 'yearly', label: 'Her Yıl' },
];

export default function Events() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // day, week, month, agenda
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'task',
    date: new Date().toISOString().split('T')[0],
    time: '',
    recurrence: 'none',
    color: '#3b82f6'
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/events');
      setEvents(res.data.events || []);
    } catch (err) {
      console.error('Events fetch error:', err);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (selectedEvent) {
        await api.put(`/events/${selectedEvent.id}`, formData);
      } else {
        await api.post('/events', formData);
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      console.error('Save event error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/events/${id}`);
      fetchEvents();
    } catch (err) {
      console.error('Delete event error:', err);
    }
  };

  const openAddModal = (date) => {
    const d = date || new Date();
    setSelectedEvent(null);
    setFormData({
      title: '',
      description: '',
      type: 'task',
      date: d.toISOString().split('T')[0],
      time: '',
      recurrence: 'none',
      color: '#3b82f6'
    });
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      type: event.type,
      date: event.date,
      time: event.time || '',
      recurrence: event.recurrence || 'none',
      color: event.color || '#3b82f6'
    });
    setShowModal(true);
  };

  // Expand recurring events for the current view
  const expandedEvents = useMemo(() => {
    const result = [];
    const searchLower = searchQuery.toLowerCase();
    
    // Helper to check if a date matches a recurrence pattern
    const matchesRecurrence = (baseDate, targetDate, recurrence) => {
      const bd = new Date(baseDate);
      const td = new Date(targetDate);
      
      // Don't show before the start date
      if (td < new Date(bd.getFullYear(), bd.getMonth(), bd.getDate())) return false;

      switch (recurrence) {
        case 'daily': return true;
        case 'weekly': return bd.getDay() === td.getDay();
        case 'monthly': return bd.getDate() === td.getDate();
        case 'yearly': return bd.getDate() === td.getDate() && bd.getMonth() === td.getMonth();
        default: return false;
      }
    };

    // For simplicity in the calendar view, we'll expand events within a range
    // depending on the view. For month view, we need the whole month + padding.
    const startRange = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const endRange = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);

    events.forEach(event => {
      if (searchQuery && !event.title.toLowerCase().includes(searchLower) && !event.description.toLowerCase().includes(searchLower)) return;

      if (event.recurrence === 'none') {
        result.push(event);
      } else {
        // Generate instances within the range
        let curr = new Date(startRange);
        while (curr <= endRange) {
          if (matchesRecurrence(event.date, curr, event.recurrence)) {
            result.push({
              ...event,
              date: curr.toISOString().split('T')[0],
              isInstance: true
            });
          }
          curr.setDate(curr.getDate() + 1);
        }
      }
    });

    return result;
  }, [events, currentDate, searchQuery]);

  const getEventsForDate = (date) => {
    const dStr = date.toISOString().split('T')[0];
    return expandedEvents.filter(e => e.date === dStr);
  };

  // Calendar Helpers
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

  const prevPeriod = () => {
    if (view === 'day') setCurrentDate(new Date(year, month, currentDate.getDate() - 1));
    else if (view === 'week') setCurrentDate(new Date(year, month, currentDate.getDate() - 7));
    else setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextPeriod = () => {
    if (view === 'day') setCurrentDate(new Date(year, month, currentDate.getDate() + 1));
    else if (view === 'week') setCurrentDate(new Date(year, month, currentDate.getDate() + 7));
    else setCurrentDate(new Date(year, month + 1, 1));
  };

  // Render Views
  const renderMonthView = () => {
    const days = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, current: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, current: true, date: new Date(year, month, i) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, current: false, date: new Date(year, month + 1, i) });
    }

    return (
      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
        {DAYS.map(d => (
          <div key={d} className="bg-[var(--bg-secondary)] py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">{d}</div>
        ))}
        {days.map((d, i) => {
          const dayEvents = getEventsForDate(d.date);
          const isToday = d.date.toDateString() === new Date().toDateString();
          return (
            <div 
              key={i} 
              onClick={() => openAddModal(d.date)}
              className={`min-h-[120px] bg-[var(--bg-card)] p-1.5 transition-all cursor-pointer hover:bg-[var(--bg-secondary)]/50
                ${!d.current ? 'opacity-30' : ''}
                ${isToday ? 'bg-[var(--primary)]/5' : ''}
              `}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center
                  ${isToday ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-primary)]'}
                `}>
                  {d.day}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 4).map((e, idx) => {
                  const type = EVENT_TYPES.find(t => t.id === e.type);
                  return (
                    <div 
                      key={idx}
                      onClick={(ev) => { ev.stopPropagation(); openEditModal(e); }}
                      className={`text-[9px] px-1.5 py-0.5 rounded border-l-2 truncate font-medium ${type?.bg} ${type?.text} ${type?.border}`}
                    >
                      {e.time && <span className="opacity-70 mr-1">{e.time}</span>}
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 4 && (
                  <div className="text-[8px] text-center font-bold text-[var(--text-muted)]">+{dayEvents.length - 4} daha</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAgendaView = () => {
    // Sort events by date
    const sortedEvents = [...expandedEvents].sort((a, b) => a.date.localeCompare(b.date));
    // Filter only future events for agenda
    const todayStr = new Date().toISOString().split('T')[0];
    const agendaEvents = sortedEvents.filter(e => e.date >= todayStr).slice(0, 50);

    return (
      <div className="space-y-4">
        {agendaEvents.length > 0 ? (
          agendaEvents.map((event, idx) => {
            const type = EVENT_TYPES.find(t => t.id === event.type);
            const eventDate = new Date(event.date);
            return (
              <div 
                key={idx}
                onClick={() => openEditModal(event)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:shadow-md transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${type?.bg} ${type?.text}`}>
                  <span className="text-[10px] font-bold uppercase">{MONTHS[eventDate.getMonth()].substring(0, 3)}</span>
                  <span className="text-lg font-black leading-none">{eventDate.getDate()}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">{event.title}</h4>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-muted)] font-medium">
                    <span className="flex items-center gap-1"><Clock size={12} /> {event.time || 'Tüm Gün'}</span>
                    <span className="flex items-center gap-1 uppercase tracking-wider">{type?.label}</span>
                    {event.recurrence !== 'none' && <span className="flex items-center gap-1 text-[var(--primary)]"><Repeat size={12} /> {RECURRENCE_OPTIONS.find(r => r.id === event.recurrence)?.label}</span>}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                  className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="card p-12 text-center flex flex-col items-center opacity-50">
            <AlertCircle size={48} className="mb-4 text-[var(--text-muted)]" />
            <p className="font-medium italic">Yaklaşan etkinlik bulunmuyor.</p>
          </div>
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    return (
      <div className="card p-6 min-h-[400px]">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <CalendarIcon className="text-[var(--primary)]" size={20} />
          {currentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
        </h3>
        <div className="space-y-4">
          {dayEvents.length > 0 ? dayEvents.map((event, idx) => {
            const type = EVENT_TYPES.find(t => t.id === event.type);
            return (
              <div 
                key={idx}
                onClick={() => openEditModal(event)}
                className={`p-5 rounded-2xl border-l-4 transition-all cursor-pointer hover:shadow-md bg-[var(--bg-secondary)]/30 ${type?.border}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${type?.text}`}>{type?.label}</div>
                    <h4 className="text-lg font-bold text-[var(--text-primary)]">{event.title}</h4>
                    {event.description && <p className="text-sm text-[var(--text-muted)] mt-1">{event.description}</p>}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-bold text-[var(--text-primary)]">
                      <Clock size={14} className="text-[var(--text-muted)]" />
                      {event.time || 'Tüm Gün'}
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-20 text-center opacity-50 flex flex-col items-center">
              <Plus size={32} className="mb-2" />
              <p>Bugün için planlanmış bir etkinlik yok.</p>
              <button onClick={() => openAddModal(currentDate)} className="mt-4 text-[var(--primary)] font-bold text-sm">Yeni Ekle</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    // Get start of week (Monday)
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }

    return (
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((d, i) => {
          const dayEvents = getEventsForDate(d);
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={i} className="space-y-3">
              <div className={`text-center p-3 rounded-2xl transition-all ${isToday ? 'bg-[var(--primary)] text-white shadow-lg' : 'bg-[var(--bg-card)] border border-[var(--border)]'}`}>
                <div className={`text-[10px] font-bold uppercase ${isToday ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{DAYS[i]}</div>
                <div className="text-lg font-black">{d.getDate()}</div>
              </div>
              <div className="space-y-2">
                {dayEvents.map((e, idx) => {
                  const type = EVENT_TYPES.find(t => t.id === e.type);
                  return (
                    <div 
                      key={idx}
                      onClick={() => openEditModal(e)}
                      className={`p-2 rounded-xl border-l-2 text-[10px] cursor-pointer hover:shadow-sm transition-all ${type?.bg} ${type?.text} ${type?.border}`}
                    >
                      <div className="font-bold truncate">{e.title}</div>
                      {e.time && <div className="mt-0.5 opacity-70 font-medium">{e.time}</div>}
                    </div>
                  );
                })}
                <button 
                  onClick={() => openAddModal(d)}
                  className="w-full py-2 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all flex items-center justify-center"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Export
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const data = expandedEvents.map(e => ({
      Başlık: e.title,
      Açıklama: e.description,
      Tür: EVENT_TYPES.find(t => t.id === e.type)?.label,
      Tarih: e.date,
      Saat: e.time || 'Tüm Gün',
      Tekrar: RECURRENCE_OPTIONS.find(r => r.id === e.recurrence)?.label
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Etkinlikler');
    XLSX.writeFile(wb, 'Etkinlik_Listesi.xlsx');
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    
    // Turkish character support check would go here if needed as in Reports.jsx
    
    doc.text('Etkinlik ve Hatırlatıcı Listesi', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Başlık', 'Tür', 'Tarih', 'Saat', 'Tekrar']],
      body: expandedEvents.map(e => [
        e.title, 
        EVENT_TYPES.find(t => t.id === e.type)?.label,
        e.date,
        e.time || 'Tüm Gün',
        RECURRENCE_OPTIONS.find(r => r.id === e.recurrence)?.label
      ]),
      styles: { fontSize: 8 }
    });
    doc.save('Etkinlik_Listesi.pdf');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {view === 'agenda' ? 'Ajanda' : `${MONTHS[month]} ${year}`}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <button onClick={prevPeriod} className="p-1 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-muted)]"><ChevronLeft size={16}/></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[var(--bg-secondary)] hover:bg-[var(--border)] rounded transition-colors text-[var(--text-primary)]">Bugün</button>
              <button onClick={nextPeriod} className="p-1 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-muted)]"><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--primary)]" size={16} />
            <input 
              type="text" 
              placeholder="Ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary)]/20 outline-none w-48 transition-all"
            />
          </div>
          <div className="flex bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-1 shadow-sm">
            <button onClick={() => setView('day')} title="Günlük" className={`p-2 rounded-xl transition-all ${view === 'day' ? 'bg-indigo-500 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}><Clock size={18} /></button>
            <button onClick={() => setView('week')} title="Haftalık" className={`p-2 rounded-xl transition-all ${view === 'week' ? 'bg-indigo-500 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}><Layout size={18} /></button>
            <button onClick={() => setView('month')} title="Aylık" className={`p-2 rounded-xl transition-all ${view === 'month' ? 'bg-indigo-500 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}><Grid size={18} /></button>
            <button onClick={() => setView('agenda')} title="Ajanda" className={`p-2 rounded-xl transition-all ${view === 'agenda' ? 'bg-indigo-500 text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}><List size={18} /></button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportPDF} className="p-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:text-red-500 transition-all"><Download size={20} /></button>
            <button onClick={handleExportExcel} className="p-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:text-emerald-500 transition-all"><FileSpreadsheet size={20} /></button>
          </div>
          <button onClick={() => openAddModal()} className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Plus size={20} /> <span className="hidden sm:inline">Yeni Etkinlik</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center py-32"><div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="animate-scale-in">
          {view === 'day' ? renderDayView() : view === 'week' ? renderWeekView() : view === 'month' ? renderMonthView() : renderAgendaView()}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-scale-in border border-[var(--border)]" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-[var(--border)] flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black tracking-tight">
                  {selectedEvent?.is_external ? 'Hatırlatıcı Detayı' : (selectedEvent ? 'Etkinliği Düzenle' : 'Yeni Etkinlik')}
                </h3>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">
                  {selectedEvent?.is_external ? 'Bu kayıt taksitli işlemlerden gelmektedir' : 'Planlarınızı yönetin'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors text-[var(--text-muted)]"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-5">
              {selectedEvent?.is_external && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 mb-4">
                  <div className="flex gap-3 text-indigo-600 dark:text-indigo-400">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-xs font-medium leading-relaxed">
                      Bu bir otomatik hatırlatıcıdır. Değişiklik yapmak veya silmek için ilgili taksitli işlem sayfasını ziyaret etmelisiniz.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">BAŞLIK</label>
                <input 
                  autoFocus
                  required
                  readOnly={selectedEvent?.is_external}
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className={`w-full px-5 py-4 bg-[var(--bg-secondary)] border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-semibold ${selectedEvent?.is_external ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="Neler yapacaksın?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">TARİH</label>
                  <input 
                    required
                    readOnly={selectedEvent?.is_external}
                    type="date" 
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className={`w-full px-5 py-4 bg-[var(--bg-secondary)] border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-semibold ${selectedEvent?.is_external ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">SAAT</label>
                  <input 
                    type="time" 
                    readOnly={selectedEvent?.is_external}
                    value={formData.time}
                    onChange={e => setFormData({...formData, time: e.target.value})}
                    className={`w-full px-5 py-4 bg-[var(--bg-secondary)] border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-semibold ${selectedEvent?.is_external ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">TÜR</label>
                  <select 
                    disabled={selectedEvent?.is_external}
                    value={formData.type}
                    onChange={e => {
                      const type = EVENT_TYPES.find(t => t.id === e.target.value);
                      setFormData({...formData, type: e.target.value, color: type?.color || '#3b82f6'});
                    }}
                    className={`w-full px-5 py-4 bg-[var(--bg-secondary)] border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-semibold ${selectedEvent?.is_external ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">TEKRAR</label>
                  <select 
                    disabled={selectedEvent?.is_external}
                    value={formData.recurrence}
                    onChange={e => setFormData({...formData, recurrence: e.target.value})}
                    className={`w-full px-5 py-4 bg-[var(--bg-secondary)] border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-semibold ${selectedEvent?.is_external ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {RECURRENCE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">AÇIKLAMA</label>
                <textarea 
                  rows="3"
                  readOnly={selectedEvent?.is_external}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className={`w-full px-5 py-4 bg-[var(--bg-secondary)] border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-semibold resize-none ${selectedEvent?.is_external ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="Detaylar..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                {selectedEvent?.is_external ? (
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 btn-primary py-4 rounded-2xl text-base font-bold shadow-xl transition-all"
                  >
                    Anladım
                  </button>
                ) : (
                  <>
                    <button 
                      type="submit" 
                      className="flex-1 btn-primary py-4 rounded-2xl flex items-center justify-center gap-3 text-base font-bold shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-1"
                    >
                      {selectedEvent ? 'Güncelle' : 'Kaydet'}
                    </button>
                    {selectedEvent && (
                      <button 
                        type="button"
                        onClick={() => handleDelete(selectedEvent.id)}
                        className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all"
                      >
                        <Trash2 size={24} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
