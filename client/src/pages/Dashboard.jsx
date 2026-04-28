import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowRight, Plus, CreditCard } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../services/api';
import { Link } from 'react-router-dom';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [topExpenses, setTopExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [sumRes, monthRes, catRes, txRes, topRes] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/reports/monthly?months=6'),
        api.get('/reports/category-breakdown?type=expense'),
        api.get('/transactions?limit=5'),
        api.get('/reports/top-expenses'),
      ]);
      setSummary(sumRes.data);
      setMonthlyData(monthRes.data.data);
      setCategoryData(catRes.data.breakdown);
      setRecentTx(txRes.data.transactions);
      setTopExpenses(topRes.data.expenses);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const handler = () => fetchData();
    window.addEventListener('transaction-added', handler);
    return () => window.removeEventListener('transaction-added', handler);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-3 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
    </div>
  );

  const savingsRate = summary && summary.totalIncome > 0 ? Math.round(((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={TrendingUp} label="Toplam Gelir" value={formatMoney(summary?.totalIncome || 0)} color="var(--income)" bg="gradient-income" delay={0} />
        <SummaryCard icon={TrendingDown} label="Toplam Gider" value={formatMoney(summary?.totalExpense || 0)} color="var(--expense)" bg="gradient-expense" delay={1} />
        <SummaryCard icon={Wallet} label="Kalan Bakiye" value={formatMoney(summary?.balance || 0)} color="var(--primary)" bg="gradient-primary" delay={2} />
        <SummaryCard icon={PiggyBank} label="Tasarruf Oranı" value={`%${savingsRate}`} color="var(--secondary)" bg="gradient-accent" delay={3} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly comparison bar chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Aylık Gelir-Gider</h3>
            <Link to="/reports" className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--primary)' }}>
              Detay <ArrowRight size={14} />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Harcama Dağılımı</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={75} innerRadius={45} dataKey="total" paddingAngle={2}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {categoryData.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{c.icon} {c.name}</span>
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Henüz veri yok</p>}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Son İşlemler</h3>
            <Link to="/transactions" className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--primary)' }}>
              Tümü <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentTx.length > 0 ? recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{tx.category_icon || '📁'}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tx.description || tx.category_name || 'İşlem'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleDateString('tr-TR')}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                </span>
              </div>
            )) : <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Henüz işlem yok</p>}
          </div>
        </div>

        {/* Quick actions + top expenses */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Hızlı İşlemler</h3>
            <div className="grid grid-cols-3 gap-3">
              <Link to="/transactions" className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105" style={{ background: 'var(--bg-secondary)' }}>
                <div className="w-10 h-10 rounded-xl gradient-income flex items-center justify-center"><Plus size={20} className="text-white" /></div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Gelir Ekle</span>
              </Link>
              <Link to="/transactions" className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105" style={{ background: 'var(--bg-secondary)' }}>
                <div className="w-10 h-10 rounded-xl gradient-expense flex items-center justify-center"><TrendingDown size={20} className="text-white" /></div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Gider Ekle</span>
              </Link>
              <Link to="/installments" className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105" style={{ background: 'var(--bg-secondary)' }}>
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center"><CreditCard size={20} className="text-white" /></div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Taksit Ekle</span>
              </Link>
            </div>
          </div>

          {/* Top expenses */}
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>En Yüksek Harcamalar</h3>
            <div className="space-y-2">
              {topExpenses.length > 0 ? topExpenses.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: COLORS[i] }}>{i + 1}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{e.description || e.category_name}</span>
                  </div>
                  <span className="font-semibold text-red-500">{formatMoney(e.amount)}</span>
                </div>
              )) : <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Henüz veri yok</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, bg, delay }) {
  return (
    <div className="card p-5 animate-fade-in" style={{ animationDelay: `${delay * 100}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold animate-count-up" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
