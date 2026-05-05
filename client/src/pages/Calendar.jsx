import { useState, useEffect, useMemo, Fragment } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Search, TrendingUp, TrendingDown, Clock, X } from 'lucide-react';
import api from '../services/api';

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function formatMoney(n) { 
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n); 
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month, year
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const fetchData = async () => {
    setLoading(true);
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      const res = await api.get(`/transactions?start_date=${startOfYear}&end_date=${endOfYear}&limit=1000`);
      setItems(res.data.transactions || []);
    } catch (err) {
      console.error('Calendar data error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  // Derived stats for the header
  const stats = useMemo(() => {
    const monthItems = items.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const income = monthItems.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0);
    const expense = monthItems.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0);
    return { income, expense, balance: income - expense };
  }, [items, month, year]);

  // Calendar logic
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1; 
  };

  const prevPeriod = () => {
    if (view === 'day') setCurrentDate(new Date(year, month, currentDate.getDate() - 1));
    else if (view === 'month') setCurrentDate(new Date(year, month - 1, 1));
    else setCurrentDate(new Date(year - 1, 0, 1));
  };
  const nextPeriod = () => {
    if (view === 'day') setCurrentDate(new Date(year, month, currentDate.getDate() + 1));
    else if (view === 'month') setCurrentDate(new Date(year, month + 1, 1));
    else setCurrentDate(new Date(year + 1, 0, 1));
  };
  const today = () => setCurrentDate(new Date());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const calendarDays = useMemo(() => {
    const days = [];
    const prevMonthDays = getDaysInMonth(year, month - 1);
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
    return days;
  }, [year, month, firstDay, daysInMonth]);

  const getItemsForDate = (date) => {
    if (!date) return [];
    const dStr = date.toISOString().split('T')[0];
    return items.filter(item => 
      item.date === dStr && 
      (searchQuery === '' || item.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
      {DAYS.map(d => (
        <div key={d} className="bg-[var(--bg-secondary)] py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">{d}</div>
      ))}
      {calendarDays.map((d, i) => {
        const dayItems = getItemsForDate(d.date);
        const isToday = d.date.toDateString() === new Date().toDateString();
        return (
          <div 
            key={i} 
            onClick={() => setSelectedDay(d.date)}
            className={`min-h-[110px] bg-[var(--bg-card)] p-2 transition-all cursor-pointer hover:bg-[var(--bg-secondary)]/50
              ${!d.current ? 'opacity-30' : ''}
              ${isToday ? 'bg-[var(--primary)]/5' : ''}
            `}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center
                ${isToday ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-primary)]'}
              `}>
                {d.day}
              </span>
              {dayItems.length > 0 && d.current && (
                <div className="flex gap-0.5">
                  {dayItems.some(i => i.type === 'income') && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {dayItems.some(i => i.type === 'expense') && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                </div>
              )}
            </div>
            <div className="space-y-1">
              {d.current && dayItems.slice(0, 3).map((item, idx) => (
                <div 
                  key={idx} 
                  className={`text-[9px] px-1.5 py-0.5 rounded-md truncate font-semibold
                    ${item.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}
                  `}
                >
                  {item.amount.toLocaleString('tr-TR')} {item.description || item.category_name}
                </div>
              ))}
              {d.current && dayItems.length > 3 && (
                <div className="text-[8px] text-center font-bold text-[var(--text-muted)] mt-1">+{dayItems.length - 3}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderYearView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {MONTHS.map((m, idx) => {
        const mItems = items.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() === idx && itemDate.getFullYear() === year;
        });
        const inc = mItems.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0);
        const exp = mItems.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0);

        return (
          <div 
            key={m} 
            onClick={() => { setCurrentDate(new Date(year, idx, 1)); setView('month'); }}
            className="card p-4 hover:border-[var(--primary)] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-lg group-hover:text-[var(--primary)]">{m}</h4>
              <span className="text-[10px] bg-[var(--bg-secondary)] px-2 py-1 rounded-full font-bold text-[var(--text-muted)]">{mItems.length} İşlem</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-500 font-medium">Gelir</span>
                <span className="font-bold">{formatMoney(inc)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-500 font-medium">Gider</span>
                <span className="font-bold">{formatMoney(exp)}</span>
              </div>
              <div className="pt-2 border-t border-[var(--border)] flex justify-between text-xs font-black">
                <span>Bakiye</span>
                <span className={inc - exp >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatMoney(inc - exp)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderReportView = () => {
    const reportData = {};
    let grandTotal = 0;
    
    items.filter(i => i.type === 'expense').forEach(item => {
      const payee = item.payee_name || 'Diğer Harcama Yeri';
      const cat = item.category_name || 'Belirtilmemiş Kategori';
      const m = new Date(item.date).getMonth();
      
      if (!reportData[payee]) reportData[payee] = { total: 0, categories: {} };
      if (!reportData[payee].categories[cat]) reportData[payee].categories[cat] = { months: Array(12).fill(0), total: 0 };
      
      reportData[payee].categories[cat].months[m] += item.amount;
      reportData[payee].categories[cat].total += item.amount;
      reportData[payee].total += item.amount;
      grandTotal += item.amount;
    });

    const payeesList = Object.keys(reportData).sort();

    const formatNumber = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    return (
      <div className="card overflow-x-auto shadow-sm p-0 md:p-4 animate-fade-in" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="min-w-max border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full border-collapse text-[11px] font-sans">
            <thead>
              <tr className="bg-[var(--bg-card)]">
                <th className="p-2 border border-[var(--border)] text-left font-bold text-[var(--text-primary)]" style={{ width: '180px' }}></th>
                {MONTHS.map(m => <th key={m} className="p-2 border border-[var(--border)] text-center text-[var(--text-secondary)] font-bold min-w-[70px]">{m}</th>)}
                <th className="p-2 border border-[var(--border)] text-center text-[var(--text-secondary)] font-bold min-w-[80px]">Toplam</th>
                <th className="p-2 border border-[var(--border)] text-center text-[var(--text-secondary)] font-bold min-w-[80px]">Ara<br/>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {payeesList.map(payee => {
                const cats = Object.keys(reportData[payee].categories).sort();
                return (
                  <Fragment key={payee}>
                    {/* Payee Header Row */}
                    <tr className="bg-[var(--bg-secondary)]">
                      <td className="p-2 border border-[var(--border)] font-bold text-[var(--text-primary)] text-center text-xs">{payee}</td>
                      <td colSpan={13} className="border border-[var(--border)]"></td>
                      <td className="p-2 border border-[var(--border)] text-right font-bold text-[var(--income)] text-xs">
                        {formatNumber(reportData[payee].total)}
                      </td>
                    </tr>
                    {/* Category Rows */}
                    {cats.map(cat => {
                      const rowData = reportData[payee].categories[cat];
                      return (
                        <tr key={cat} className="hover:bg-[var(--bg-secondary)] transition-colors bg-[var(--bg-card)]">
                          <td className="p-2 pl-3 border border-[var(--border)] font-semibold text-[var(--text-primary)]">{cat}</td>
                          {rowData.months.map((amt, i) => (
                            <td key={i} className="p-2 border border-[var(--border)] text-right text-[var(--text-secondary)]">
                              {amt > 0 ? formatNumber(amt) : ''}
                            </td>
                          ))}
                          <td className="p-2 border border-[var(--border)] text-right font-bold text-[var(--expense)]">
                            {formatNumber(rowData.total)}
                          </td>
                          <td className="border border-[var(--border)] bg-[var(--bg-card)]"></td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {/* Grand Total Row */}
              <tr className="bg-[var(--bg-secondary)]">
                <td colSpan={14} className="border border-[var(--border)] font-bold text-right text-[var(--text-primary)] p-2 text-xs">Genel Toplam</td>
                <td className="p-2 border border-[var(--border)] text-right font-bold text-[var(--income)] text-xs">
                  {formatNumber(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayItems = getItemsForDate(currentDate);
    const inc = dayItems.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0);
    const exp = dayItems.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4 border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Günlük Toplam Gelir</p>
            <p className="text-xl font-black text-emerald-600">{formatMoney(inc)}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-red-500">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Günlük Toplam Gider</p>
            <p className="text-xl font-black text-red-600">{formatMoney(exp)}</p>
          </div>
        </div>
        <div className="card p-6 min-h-[400px]">
          {dayItems.length > 0 ? (
            <div className="space-y-4">
              {dayItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-3xl bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] transition-all group border border-[var(--border)]">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-110
                      ${item.type === 'income' ? 'bg-emerald-500/10' : 'bg-red-500/10'}
                    `}>
                      {item.category_icon || '📁'}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{item.description || item.category_name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tighter mt-0.5">{item.category_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${item.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold mt-1">
                      {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
               <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4">
                 <CalendarIcon size={40} className="text-[var(--text-muted)]" />
               </div>
               <p className="font-medium italic">Bu gün için işlem bulunmuyor.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              {view === 'day' ? currentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : (view === 'year' || view === 'report') ? year : `${MONTHS[month]} ${year}`}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <button onClick={prevPeriod} className="p-1 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-muted)]"><ChevronLeft size={16}/></button>
              <button onClick={today} className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[var(--bg-secondary)] hover:bg-[var(--border)] rounded transition-colors">
                {view === 'day' ? 'Bugün' : view === 'month' ? 'Bu Ay' : 'Bu Yıl'}
              </button>
              <button onClick={nextPeriod} className="p-1 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-muted)]"><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-1 shadow-sm">
            <button onClick={() => setView('day')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${view === 'day' ? 'gradient-primary text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}>Gün</button>
            <button onClick={() => setView('month')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${view === 'month' ? 'gradient-primary text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}>Ay</button>
            <button onClick={() => setView('year')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${view === 'year' ? 'gradient-primary text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}>Yıl</button>
            <button onClick={() => setView('report')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${view === 'report' ? 'gradient-primary text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}>Rapor</button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {view === 'month' && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Aylık Toplam Gelir</p>
            <p className="text-xl font-black text-emerald-600">{formatMoney(stats.income)}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-red-500">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Aylık Toplam Gider</p>
            <p className="text-xl font-black text-red-600">{formatMoney(stats.expense)}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-[var(--primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Net Bakiye</p>
            <p className={`text-xl font-black ${stats.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(stats.balance)}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-12 h-12 border-4 border-[var(--primary)]/20 border-t-[var(--primary)] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="animate-scale-in">
          {view === 'day' ? renderDayView() : view === 'month' ? renderMonthView() : view === 'year' ? renderYearView() : renderReportView()}
        </div>
      )}

      {/* Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setSelectedDay(null)}>
          <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-scale-in border border-[var(--border)]" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-[var(--border)] flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black tracking-tight">{selectedDay.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">{selectedDay.toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors text-[var(--text-muted)]"><X size={24}/></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-6 space-y-4">
              {getItemsForDate(selectedDay).length > 0 ? getItemsForDate(selectedDay).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-3xl bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-110
                      ${item.type === 'income' ? 'bg-emerald-500/10' : 'bg-red-500/10'}
                    `}>
                      {item.category_icon || '📁'}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{item.description || item.category_name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tighter mt-0.5">{item.category_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${item.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold mt-1">
                      {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                    <CalendarIcon size={40} className="text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[var(--text-muted)] font-medium italic">Bu gün için herhangi bir işlem kaydı bulunmuyor.</p>
                </div>
              )}
            </div>
            <div className="p-8 bg-[var(--bg-secondary)]/20 border-t border-[var(--border)]">
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-quick-add', { detail: { date: selectedDay.toISOString().split('T')[0] } }));
                  setSelectedDay(null);
                }}
                className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-3 text-base font-bold shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-1"
              >
                <Plus size={20} /> Yeni İşlem Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
