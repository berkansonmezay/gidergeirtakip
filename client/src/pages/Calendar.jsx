import { useState, useEffect, useMemo, Fragment } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Search, TrendingUp, TrendingDown, Clock, X, Download, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import { robotoBase64 } from '../utils/fonts/Roboto.js';

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

  // ───── Export Helpers ─────
  const getYearSummary = () => {
    return MONTHS.map((m, idx) => {
      const mItems = items.filter(item => {
        const d = new Date(item.date);
        return d.getMonth() === idx && d.getFullYear() === year;
      });
      const income = mItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
      const expense = mItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
      return { month: m, count: mItems.length, income, expense, balance: income - expense };
    });
  };

  const getMonthTransactions = () => {
    return items.filter(item => {
      const d = new Date(item.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      if (view === 'year') {
        const summary = getYearSummary();
        const ws = XLSX.utils.json_to_sheet(summary.map(d => ({
          Ay: d.month,
          'İşlem Sayısı': d.count,
          'Gelir (₺)': d.income,
          'Gider (₺)': d.expense,
          'Bakiye (₺)': d.balance,
        })));
        XLSX.utils.book_append_sheet(wb, ws, `${year} Yıllık Özet`);
      } else if (view === 'month') {
        const txs = getMonthTransactions();
        const ws = XLSX.utils.json_to_sheet(txs.map(t => ({
          Tarih: new Date(t.date).toLocaleDateString('tr-TR'),
          'Harcama Yeri': t.payee_name || '-',
          Kategori: t.category_name || '-',
          'Açıklama': t.description || '-',
          Tür: t.type === 'income' ? 'Gelir' : 'Gider',
          'Tutar (₺)': t.amount,
        })));
        XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[month]} ${year}`);
      } else {
        const dayTxs = getItemsForDate(currentDate);
        const ws = XLSX.utils.json_to_sheet(dayTxs.map(t => ({
          Tarih: new Date(t.date).toLocaleDateString('tr-TR'),
          'Harcama Yeri': t.payee_name || '-',
          Kategori: t.category_name || '-',
          'Açıklama': t.description || '-',
          Tür: t.type === 'income' ? 'Gelir' : 'Gider',
          'Tutar (₺)': t.amount,
        })));
        XLSX.utils.book_append_sheet(wb, ws, currentDate.toLocaleDateString('tr-TR'));
      }

      const fileName = view === 'year'
        ? `Takvim_Yillik_${year}.xlsx`
        : view === 'month'
          ? `Takvim_${MONTHS[month]}_${year}.xlsx`
          : `Takvim_${currentDate.toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) { console.error('Excel export error:', err); }
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF(view === 'year' ? { orientation: 'landscape' } : {});
      doc.setLanguage('tr');
      doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');

      if (view === 'year') {
        doc.setDocumentProperties({
          title: `Takvim Yıllık Özet - ${year}`,
          subject: `${year} yılı aylık gelir-gider özeti`,
          author: 'Aile Bütçesi',
          creator: 'Aile Bütçesi Finans Yönetimi',
        });
        doc.setFontSize(18);
        doc.text(`Takvim Yıllık Özet - ${year}`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        const summary = getYearSummary();
        const totalIncome = summary.reduce((s, d) => s + d.income, 0);
        const totalExpense = summary.reduce((s, d) => s + d.expense, 0);
        const totalBalance = totalIncome - totalExpense;

        autoTable(doc, {
          startY: 36,
          head: [['Ay', 'İşlem', 'Gelir', 'Gider', 'Bakiye']],
          body: summary.map(d => [
            d.month,
            d.count,
            formatMoney(d.income),
            formatMoney(d.expense),
            formatMoney(d.balance),
          ]),
          foot: [['Toplam', summary.reduce((s, d) => s + d.count, 0), formatMoney(totalIncome), formatMoney(totalExpense), formatMoney(totalBalance)]],
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 4) {
              const row = summary[data.row.index];
              if (row) data.cell.styles.textColor = row.balance >= 0 ? [16, 185, 129] : [239, 68, 68];
            }
          },
        });
        doc.save(`Takvim_Yillik_${year}.pdf`);

      } else if (view === 'month') {
        doc.setDocumentProperties({
          title: `Takvim - ${MONTHS[month]} ${year}`,
          subject: `${MONTHS[month]} ${year} aylık işlem detayı`,
          author: 'Aile Bütçesi',
          creator: 'Aile Bütçesi Finans Yönetimi',
        });
        doc.setFontSize(18);
        doc.text(`${MONTHS[month]} ${year} - İşlemler`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        // Summary line
        doc.setFontSize(10);
        doc.text(`Gelir: ${formatMoney(stats.income)}  |  Gider: ${formatMoney(stats.expense)}  |  Bakiye: ${formatMoney(stats.balance)}`, 14, 38);

        const txs = getMonthTransactions();
        autoTable(doc, {
          startY: 44,
          head: [['Tarih', 'Harcama Yeri', 'Kategori', 'Açıklama', 'Gelir', 'Gider']],
          body: txs.map(t => [
            new Date(t.date).toLocaleDateString('tr-TR'),
            t.payee_name || '-',
            t.category_name || '-',
            t.description || '-',
            t.type === 'income' ? formatMoney(t.amount) : '-',
            t.type === 'expense' ? formatMoney(t.amount) : '-',
          ]),
          foot: [['', '', '', 'Toplam',
            formatMoney(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
            formatMoney(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
          ]],
          styles: { font: 'Roboto', fontSize: 8 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
          columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
        });
        doc.save(`Takvim_${MONTHS[month]}_${year}.pdf`);

      } else {
        doc.setDocumentProperties({
          title: `Takvim - ${currentDate.toLocaleDateString('tr-TR')}`,
          subject: `Günlük işlem detayı`,
          author: 'Aile Bütçesi',
          creator: 'Aile Bütçesi Finans Yönetimi',
        });
        doc.setFontSize(18);
        doc.text(currentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }), 14, 22);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        const dayTxs = getItemsForDate(currentDate);
        const dayIncome = dayTxs.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
        const dayExpense = dayTxs.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

        doc.text(`Gelir: ${formatMoney(dayIncome)}  |  Gider: ${formatMoney(dayExpense)}  |  Bakiye: ${formatMoney(dayIncome - dayExpense)}`, 14, 38);

        autoTable(doc, {
          startY: 44,
          head: [['Kategori', 'Açıklama', 'Tür', 'Tutar']],
          body: dayTxs.map(t => [
            t.category_name || '-',
            t.description || '-',
            t.type === 'income' ? 'Gelir' : 'Gider',
            formatMoney(t.amount),
          ]),
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          columnStyles: { 3: { halign: 'right' } },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 2) {
              data.cell.styles.textColor = data.cell.raw === 'Gelir' ? [16, 185, 129] : [239, 68, 68];
            }
          },
        });
        doc.save(`Takvim_${currentDate.toISOString().split('T')[0]}.pdf`);
      }
    } catch (err) { console.error('PDF export error:', err); }
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
              {view === 'day' ? currentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : view === 'year' ? year : `${MONTHS[month]} ${year}`}
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
          <div className="flex items-center gap-2">
            <button onClick={handleExportPDF} className="btn btn-secondary btn-sm h-10 px-4"><Download size={18} /> PDF</button>
            <button onClick={handleExportExcel} className="btn btn-secondary btn-sm h-10 px-4"><FileSpreadsheet size={18} /> Excel</button>
          </div>
          <div className="flex bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-1 shadow-sm">
            <button onClick={() => setView('day')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${view === 'day' ? 'gradient-primary text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}>Gün</button>
            <button onClick={() => setView('month')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${view === 'month' ? 'gradient-primary text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}>Ay</button>
            <button onClick={() => setView('year')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${view === 'year' ? 'gradient-primary text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}>Yıl</button>
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
          {view === 'day' ? renderDayView() : view === 'month' ? renderMonthView() : renderYearView()}
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
