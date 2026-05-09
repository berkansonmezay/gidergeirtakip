import { useState, useEffect, useMemo, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight, Clock, Repeat, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { robotoBase64 } from '../utils/fonts/Roboto.js';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Reports() {
  const [activeTab, setActiveTab] = useState('summary'); // summary, annual
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catTotal, setCatTotal] = useState(0);

  // Annual Report State
  const [year, setYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [annualLoading, setAnnualLoading] = useState(false);

  useEffect(() => {
    fetchSummaryData();
  }, []);

  useEffect(() => {
    if (activeTab === 'annual') {
      fetchAnnualData();
    }
  }, [activeTab, year]);

  const fetchSummaryData = async () => {
    setLoading(true);
    try {
      const [m, c, t] = await Promise.all([
        api.get('/reports/monthly?months=12'),
        api.get('/reports/category-breakdown?type=expense'),
        api.get('/reports/trends?months=12'),
      ]);
      setMonthlyData(m.data.data);
      setCategoryData(c.data.breakdown);
      setCatTotal(c.data.total);
      setTrendData(t.data.data);
    } catch (err) {
      console.error('Summary report error:', err);
    }
    setLoading(false);
  };

  const fetchAnnualData = async () => {
    setAnnualLoading(true);
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      const res = await api.get(`/transactions?start_date=${startOfYear}&end_date=${endOfYear}&limit=1000`);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Annual report data error:', err);
    }
    setAnnualLoading(false);
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      if (activeTab === 'summary') {
        const ws1 = XLSX.utils.json_to_sheet(monthlyData.map(d => ({ Ay: d.month, Yıl: d.year, Gelir: d.income, Gider: d.expense, Bakiye: d.balance })));
        XLSX.utils.book_append_sheet(wb, ws1, 'Aylık Rapor');
        const ws2 = XLSX.utils.json_to_sheet(categoryData.map(d => ({ Kategori: d.name, Toplam: d.total, İşlem: d.count, Yüzde: `${d.percentage}%` })));
        XLSX.utils.book_append_sheet(wb, ws2, 'Kategori Dağılımı');
      } else {
        // Annual report export logic can be added here if needed
        const reportData = getAnnualReportData();
        const exportData = [];
        Object.keys(reportData).sort().forEach(payee => {
          exportData.push({ HarcamaYeri: payee, ...reportData[payee].months.reduce((acc, amt, i) => ({ ...acc, [MONTHS[i]]: amt }), {}), Toplam: reportData[payee].total });
          Object.keys(reportData[payee].categories).sort().forEach(cat => {
            exportData.push({ HarcamaYeri: `  - ${cat}`, ...reportData[payee].categories[cat].months.reduce((acc, amt, i) => ({ ...acc, [MONTHS[i]]: amt }), {}), Toplam: reportData[payee].categories[cat].total });
          });
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Yıllık Gider Listesi');
      }
      
      XLSX.writeFile(wb, `Aile_Butcesi_Rapor_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { console.error(err); }
  };

  const handleExportPDF = async () => {
    // Keep the existing PDF logic for summary, or expand for annual
    if (activeTab === 'annual') {
      alert('Yıllık rapor PDF dışa aktarma yakında eklenecek. Şimdilik Excel kullanabilirsiniz.');
      return;
    }
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');
      doc.setFontSize(18);
      doc.text('Aile Bütçesi Raporu', 14, 22);
      doc.setFontSize(10);
      doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

      doc.setFontSize(14);
      doc.text('Aylık Gelir-Gider', 14, 42);
      const monthlyTotalIncome = monthlyData.reduce((s, d) => s + d.income, 0);
      const monthlyTotalExpense = monthlyData.reduce((s, d) => s + d.expense, 0);
      const monthlyTotalBalance = monthlyTotalIncome - monthlyTotalExpense;

      autoTable(doc, {
        startY: 46,
        head: [['Ay', 'Gelir', 'Gider', 'Bakiye']],
        body: monthlyData.map(d => [d.month, formatMoney(d.income), formatMoney(d.expense), formatMoney(d.balance)]),
        foot: [['Toplam', formatMoney(monthlyTotalIncome), formatMoney(monthlyTotalExpense), formatMoney(monthlyTotalBalance)]],
        styles: { font: 'Roboto', fontSize: 9 },
        headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
        footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      });

      const y2 = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text('Kategori Dağılımı', 14, y2);
      const catTotalAmount = categoryData.reduce((s, d) => s + d.total, 0);
      const catTotalCount = categoryData.reduce((s, d) => s + d.count, 0);

      autoTable(doc, {
        startY: y2 + 4,
        head: [['Kategori', 'Toplam', 'İşlem', 'Yüzde']],
        body: categoryData.map(d => [d.name, formatMoney(d.total), d.count, `${d.percentage}%`]),
        foot: [['Toplam', formatMoney(catTotalAmount), catTotalCount, '100%']],
        styles: { font: 'Roboto', fontSize: 9 },
        headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
        footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
        columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
      });
      doc.save(`Aile_Butcesi_Rapor_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error(err); }
  };

  const getAnnualReportData = () => {
    const reportData = {};
    let grandTotal = 0;
    const monthTotals = Array(12).fill(0);
    
    transactions.filter(i => i.type === 'expense').forEach(item => {
      const payee = item.payee_name || 'Diğer Harcama Yeri';
      const cat = item.category_name || 'Belirtilmemiş Kategori';
      const m = new Date(item.date).getMonth();
      
      if (!reportData[payee]) reportData[payee] = { total: 0, categories: {}, months: Array(12).fill(0) };
      if (!reportData[payee].categories[cat]) reportData[payee].categories[cat] = { months: Array(12).fill(0), total: 0 };
      
      reportData[payee].categories[cat].months[m] += item.amount;
      reportData[payee].categories[cat].total += item.amount;
      reportData[payee].months[m] += item.amount;
      reportData[payee].total += item.amount;
      monthTotals[m] += item.amount;
      grandTotal += item.amount;
    });
    return { reportData, monthTotals, grandTotal };
  };

  const renderSummaryTab = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Trend chart */}
      <div className="card p-5">
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Gelir-Gider Trendi (12 Ay)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="income" name="Gelir" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="expense" name="Gider" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="savings" name="Tasarruf" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly bar */}
        <div className="card p-5">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Aylık Karşılaştırma</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
              <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie + table */}
        <div className="card p-5">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Kategori Dağılımı</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} innerRadius={50} dataKey="total" paddingAngle={2}>
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {categoryData.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{c.icon} {c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>{c.percentage}%</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatMoney(c.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnnualTab = () => {
    const { reportData, monthTotals, grandTotal } = getAnnualReportData();
    const payeesList = Object.keys(reportData).sort();
    const formatNumber = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    if (annualLoading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 rounded-full animate-spin border-indigo-500/20 border-t-indigo-500" /></div>;

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"><ChevronLeft size={20} /></button>
            <span className="text-xl font-black">{year}</span>
            <button onClick={() => setYear(year + 1)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"><ChevronRight size={20} /></button>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Yıllık Toplam Gider</p>
            <p className="text-xl font-black text-red-500">{formatMoney(grandTotal)}</p>
          </div>
        </div>

        <div className="card overflow-x-auto shadow-sm p-0 md:p-4 animate-fade-in" style={{ backgroundColor: 'var(--bg-card)' }}>
          <div className="min-w-max border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-[11px] font-sans">
              <thead>
                <tr className="bg-[var(--bg-card)]">
                  <th className="p-2 border border-[var(--border)] text-left font-bold text-[var(--text-primary)]" style={{ width: '180px' }}></th>
                  {MONTHS.map(m => <th key={m} className="p-2 border border-[var(--border)] text-center text-[var(--text-secondary)] font-bold min-w-[70px]">{m}</th>)}
                  <th className="p-2 border border-[var(--border)] text-center text-[var(--text-secondary)] font-bold min-w-[80px]">Toplam</th>
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
                        {reportData[payee].months.map((amt, i) => (
                          <td key={i} className="p-2 border border-[var(--border)] text-right font-bold text-[var(--income)] text-xs">
                            {amt > 0 ? formatNumber(amt) : ''}
                          </td>
                        ))}
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
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {/* Grand Total Row */}
                <tr className="bg-[var(--bg-secondary)]">
                  <td className="p-2 border border-[var(--border)] font-bold text-right text-[var(--text-primary)] text-xs">Genel Toplam</td>
                  {monthTotals.map((total, idx) => (
                    <td key={idx} className="p-2 border border-[var(--border)] text-right font-bold text-[var(--expense)] text-xs">
                      {total > 0 ? formatNumber(total) : ''}
                    </td>
                  ))}
                  <td className="p-2 border border-[var(--border)] text-right font-bold text-[var(--expense)] text-xs">
                    {formatNumber(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-32"><div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Raporlar</h2>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Finansal durumunuzu analiz edin</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="btn btn-secondary btn-sm h-10 px-4"><Download size={18} /> PDF</button>
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm h-10 px-4"><FileSpreadsheet size={18} /> Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl w-fit border border-[var(--border)] shadow-inner">
        <button 
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'summary' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-md translate-y-0' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Özet Rapor
        </button>
        <button 
          onClick={() => setActiveTab('annual')}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'annual' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-md translate-y-0' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Yıllık Gider Listesi
        </button>
      </div>

      <div className="min-h-[600px]">
        {activeTab === 'summary' ? renderSummaryTab() : renderAnnualTab()}
      </div>
    </div>
  );
}
