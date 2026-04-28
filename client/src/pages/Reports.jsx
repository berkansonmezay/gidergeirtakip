import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Download, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Reports() {
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catTotal, setCatTotal] = useState(0);

  useEffect(() => {
    (async () => {
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
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      // Monthly data
      const ws1 = XLSX.utils.json_to_sheet(monthlyData.map(d => ({ Ay: d.month, Yıl: d.year, Gelir: d.income, Gider: d.expense, Bakiye: d.balance })));
      XLSX.utils.book_append_sheet(wb, ws1, 'Aylık Rapor');
      // Category data
      const ws2 = XLSX.utils.json_to_sheet(categoryData.map(d => ({ Kategori: d.name, Toplam: d.total, İşlem: d.count, Yüzde: `${d.percentage}%` })));
      XLSX.utils.book_append_sheet(wb, ws2, 'Kategori Dağılımı');
      XLSX.writeFile(wb, `Aile_Butcesi_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { console.error(err); }
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Aile Butcesi Raporu', 14, 22);
      doc.setFontSize(10);
      doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);
      // Monthly table
      doc.setFontSize(14);
      doc.text('Aylik Gelir-Gider', 14, 42);
      autoTable(doc, {
        startY: 46,
        head: [['Ay', 'Gelir', 'Gider', 'Bakiye']],
        body: monthlyData.map(d => [d.month, formatMoney(d.income), formatMoney(d.expense), formatMoney(d.balance)]),
        styles: { fontSize: 9 },
      });
      // Category table
      const y2 = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text('Kategori Dagilimi', 14, y2);
      autoTable(doc, {
        startY: y2 + 4,
        head: [['Kategori', 'Toplam', 'Islem', 'Yuzde']],
        body: categoryData.map(d => [d.name, formatMoney(d.total), d.count, `${d.percentage}%`]),
        styles: { fontSize: 9 },
      });
      doc.save(`Aile_Butcesi_Rapor_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Raporlar</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Finansal analiz ve raporlama</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPDF} className="btn btn-secondary btn-sm"><Download size={16} /> PDF</button>
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm"><FileSpreadsheet size={16} /> Excel</button>
        </div>
      </div>

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
}
