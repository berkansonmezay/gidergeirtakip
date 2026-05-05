import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, PiggyBank, Target, Trash2, X, Edit3, History, Download, FileText, FileSpreadsheet, TrendingUp, Coins, RefreshCw } from 'lucide-react';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { robotoBase64 } from '../utils/fonts/Roboto.js';

const GOLD_TYPES = ['Gr Altın', 'Çeyrek', 'Yarım', 'Tam', 'Cumhuriyet', 'Ata Lira'];
const CURRENCY_TYPES = ['USD', 'EUR'];

// Load saved gold prices from localStorage
function loadGoldPrices() {
  try {
    const saved = localStorage.getItem('goldUnitPrices');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function saveGoldPrices(prices) {
  try { localStorage.setItem('goldUnitPrices', JSON.stringify(prices)); } catch {}
}

function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }
function formatValue(n, currency, metric) {
  if (metric && currency) return `${n} ${metric} (${currency})`;
  if (metric) return `${n} ${metric}`;
  if (!currency || currency === '₺') return formatMoney(n);
  return `${n} ${currency}`;
}

const EMOJI_CATEGORIES = {
  '💰 Finans': ['💰','💵','💴','💶','💷','💸','💳','💎','🏦','📈','📉','📊','🧾','🪙','💹','🏧','💱','💲','🧈','🟡','⚪','🥇','🥈','🥉','🧱'],
  '🍽️ Yeme & İçme': ['🍽️','🍔','🍕','🍝','🍜','🍣','🍰','🍩','🍦','🍫','🍿','☕','🍺','🍷','🥤','🧁','🥗','🌮','🥘','🍱'],
  '🛒 Alışveriş': ['🛒','🛍️','🏪','🏬','🎁','📦','🧴','🧹','🧺','🧻','🧽','🧼'],
  '🚗 Ulaşım': ['🚗','🚕','🚌','🚇','🚆','🚂','✈️','🚀','🛳️','🚲','🛵','🏍️','⛽','🅿️','🚁','🛸'],
  '🏠 Ev & Yaşam': ['🏠','🏡','🏢','🛋️','🛏️','🚿','🛁','🪑','🪞','🧲','🔑','🔒','🪴','🏗️','🧱','💡'],
  '🏥 Sağlık': ['🏥','💊','🩺','🩹','💉','🦷','👓','🧬','🩻','🩸','💆','🧘'],
  '📚 Eğitim': ['📚','🎓','✏️','📝','📖','📐','🔬','🔭','🧪','🎒','📓','📌'],
  '🎮 Eğlence': ['🎮','🎬','🎭','🎪','🎡','🎢','🎠','🎤','🎧','🎵','🎶','🎸','🎻','🎺','🥁','🎲','🎯','🎰'],
  '⚽ Spor': ['⚽','🏀','🏈','⚾','🎾','🏐','🏓','🏸','🏊','🏋️','🤸','🚴','⛷️','🏄','🧗','🥊','🏆','🥇'],
  '🐾 Evcil Hayvan': ['🐾','🐶','🐱','🐟','🐦','🐰','🐹','🦜','🐢','🦮'],
  '👕 Giyim': ['👕','👔','👗','👠','👟','🧥','👜','👝','🎩','🧢','🕶️','💄','👑','💍'],
  '🌿 Doğa': ['🌿','🌳','🌸','🌻','🌈','☀️','🌙','☁️','⚡','🔥','💧','❄️','🌊','🍀'],
  '💻 Teknoloji': ['💻','📱','⌨️','🖱️','🖥️','📷','🎥','📹','🔋','🔌','📡','🛰️','🤖','🧮'],
  '🔧 Tamir': ['🔧','🔨','🪚','🪜','🛠️','⚙️','🔩','🪛','🧰'],
  '📁 Diğer': ['📁','📂','📋','📎','🗂️','🗃️','🗄️','🏷️','✅','❌','⭐','❤️','🔔','🎀','🕐','📅','🗓️','✉️','📮','🎗️'],
};
const EMOJI_CATEGORY_KEYS = Object.keys(EMOJI_CATEGORIES);
const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

export default function Savings() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [addAmountId, setAddAmountId] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [addValue, setAddValue] = useState('');
  const [transType, setTransType] = useState('in'); // 'in' or 'out'
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'goal'|'history', id, historyId, title, message }
  const [goldPrices, setGoldPrices] = useState(loadGoldPrices);

  const updateGoldPrice = useCallback((type, value) => {
    setGoldPrices(prev => {
      const next = { ...prev, [type]: value };
      saveGoldPrices(next);
      return next;
    });
  }, []);

  const [fetchingPrices, setFetchingPrices] = useState(false);
  const fetchLiveGoldPrices = useCallback(async () => {
    setFetchingPrices(true);
    try {
      const { data } = await api.get('/gold-prices');
      if (data.prices) {
        const newPrices = { ...goldPrices };
        GOLD_TYPES.forEach(type => {
          if (data.prices[type]) {
            newPrices[type] = String(Math.round(data.prices[type].sell));
          }
        });
        // Also fetch USD and EUR rates
        CURRENCY_TYPES.forEach(type => {
          if (data.prices[type]) {
            newPrices[type] = String(data.prices[type].sell.toFixed(2));
          }
        });
        setGoldPrices(newPrices);
        saveGoldPrices(newPrices);
      }
    } catch (err) {
      console.error('Gold prices fetch error:', err);
      alert('Fiyatlar alınamadı. Lütfen daha sonra tekrar deneyin.');
    }
    setFetchingPrices(false);
  }, [goldPrices]);

  const fetchGoals = async () => {
    try { 
      const { data } = await api.get('/savings'); 
      setGoals(data.goals); 
    } catch (err) {
      console.error('Fetch Goals Error:', err);
      alert('Veriler yüklenirken hata oluştu: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };
  useEffect(() => { fetchGoals(); }, []);

  const handleDelete = async (id) => {
    const goal = goals.find(g => g.id === id);
    setDeleteConfirm({
      type: 'goal',
      id,
      title: 'Hesabı Sil',
      message: `"${goal?.name}" hesabını ve tüm geçmişini silmek istediğinize emin misiniz?`
    });
  };

  const executeDelete = async () => {
    const { type, id, historyId } = deleteConfirm;
    try {
      if (type === 'goal') {
        await api.delete(`/savings/${id}`);
        fetchGoals();
      } else {
        await api.delete(`/savings/${id}/history/${historyId}`);
        const { data } = await api.get('/savings');
        setGoals(data.goals);
        const updated = data.goals.find(g => g.id === id);
        if (updated) setSelectedGoal(updated);
      }
      setDeleteConfirm(null);
    } catch {}
  };

  const handleAddAmount = async (id) => {
    if ((!addAmount || parseFloat(addAmount) <= 0) && (!addValue || parseFloat(addValue) <= 0)) return;
    try { 
      await api.put(`/savings/${id}`, { 
        add_amount: parseFloat(addAmount || 0),
        add_unit_price: parseFloat(addValue || 0),
        type: transType,
        date: transDate
      }); 
      setAddAmountId(null); 
      setAddAmount(''); 
      setAddValue('');
      setTransType('in');
      setTransDate(new Date().toISOString().split('T')[0]);
      fetchGoals(); 
    } catch {}
  };

  const handleDeleteHistory = async (goalId, historyId) => {
    setDeleteConfirm({
      type: 'history',
      id: goalId,
      historyId,
      title: 'İşlemi Sil',
      message: 'Bu işlemi silmek istediğinize emin misiniz? Bakiye otomatik olarak güncellenecektir.'
    });
    return true; // we handle the rest in executeDelete
  };

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');

  // Calculate total savings: use entered gold/currency prices when available, otherwise fallback to stored current_value
  const totalSavingsCalculated = useMemo(() => {
    let total = 0;
    goals.forEach(g => {
      if (g.status === 'deleted') return;
      // Determine which gold type this account uses (stored in currency or metric)
      const goldType = GOLD_TYPES.includes(g.currency) ? g.currency : (GOLD_TYPES.includes(g.metric) ? g.metric : null);
      // Check for foreign currency (USD, EUR)
      const currencyType = (!goldType && g.currency && CURRENCY_TYPES.includes(g.currency === '$' ? 'USD' : g.currency === '€' ? 'EUR' : g.currency)) 
        ? (g.currency === '$' ? 'USD' : g.currency === '€' ? 'EUR' : g.currency) 
        : null;
      
      if (goldType && goldPrices[goldType] && parseFloat(goldPrices[goldType]) > 0) {
        // Use entered gold price × current amount
        total += (g.current_amount || 0) * parseFloat(goldPrices[goldType]);
      } else if (currencyType && goldPrices[currencyType] && parseFloat(goldPrices[currencyType]) > 0) {
        // Use entered currency rate × current amount
        total += (g.current_amount || 0) * parseFloat(goldPrices[currencyType]);
      } else if ((!g.currency || g.currency === '₺') && !GOLD_TYPES.includes(g.metric)) {
        // TL based account - use current_amount directly
        total += (g.current_amount || 0);
      } else {
        // Fallback to stored current_value
        total += (g.current_value || 0);
      }
    });
    return total;
  }, [goals, goldPrices]);

  // Count how many gold prices are entered
  const filledGoldPriceCount = GOLD_TYPES.filter(t => goldPrices[t] && parseFloat(goldPrices[t]) > 0).length;

  // Total cost (sum of all current_value = actual investment/maliyet)
  const totalCost = useMemo(() => {
    return goals.filter(g => g.status !== 'deleted').reduce((s, g) => s + (g.current_value || 0), 0);
  }, [goals]);

  // Profit/Loss
  const profitLoss = totalSavingsCalculated - totalCost;
  const profitLossPercent = totalCost > 0 ? ((profitLoss / totalCost) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tasarruf</h2>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary"><Plus size={18} /> Yeni Hesap</button>
      </div>

      {/* Gold Prices & Total Savings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Gold Prices Input Card - spans 2 columns */}
        <div className="card p-3 animate-fade-in md:col-span-2" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              🪙
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>Güncel Altın & Döviz Fiyatları</h3>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Birim TL değerlerini girin</p>
            </div>
            <button
              onClick={fetchLiveGoldPrices}
              disabled={fetchingPrices}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', opacity: fetchingPrices ? 0.6 : 1 }}
              title="Serbest piyasa verilerinden güncelle"
            >
              <RefreshCw size={11} className={fetchingPrices ? 'animate-spin' : ''} />
              {fetchingPrices ? 'Yükleniyor...' : 'Güncelle'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {GOLD_TYPES.map(type => (
              <div key={type} className="flex items-center gap-2 px-1.5 py-1 rounded-md transition-all hover:bg-[var(--bg-secondary)]">
                <span className="text-[11px] font-semibold w-20 shrink-0" style={{ color: 'var(--text-secondary)' }}>{type}</span>
                <div className="relative flex-1">
                  <input
                    type="number"
                    className="input text-xs py-1 pr-6 w-full"
                    placeholder="0"
                    value={goldPrices[type] || ''}
                    onChange={(e) => updateGoldPrice(type, e.target.value)}
                    style={{ fontSize: '11px', minHeight: 'unset', height: '28px' }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>₺</span>
                </div>
              </div>
            ))}
          </div>
          {/* Divider */}
          <div className="border-t my-1.5" style={{ borderColor: 'var(--border)' }} />
          {/* Currency Rates */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {CURRENCY_TYPES.map(type => (
              <div key={type} className="flex items-center gap-2 px-1.5 py-1 rounded-md transition-all hover:bg-[var(--bg-secondary)]">
                <span className="text-[11px] font-semibold w-20 shrink-0 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  {type === 'USD' ? '💵' : '💶'} {type}
                </span>
                <div className="relative flex-1">
                  <input
                    type="number"
                    className="input text-xs py-1 pr-6 w-full"
                    placeholder="0"
                    value={goldPrices[type] || ''}
                    onChange={(e) => updateGoldPrice(type, e.target.value)}
                    style={{ fontSize: '11px', minHeight: 'unset', height: '28px' }}
                    step="0.01"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>₺</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Savings Card */}
        <div className="card p-3 animate-fade-in flex flex-col justify-center text-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)', border: 'none', animationDelay: '100ms' }}>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-2 text-center">
            <p className="text-[10px] text-white/60 mb-0.5">Güncel Toplam Değer</p>
            <p className="text-xl font-bold text-white tracking-tight">{formatMoney(totalSavingsCalculated)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-2 text-center">
            <p className="text-[10px] text-white/60 mb-0.5">Toplam Maliyet</p>
            <p className="text-base font-bold text-white/90 tracking-tight">{formatMoney(totalCost)}</p>
          </div>
          <div className="backdrop-blur-sm rounded-xl p-3 flex flex-col items-center text-center" style={{ background: profitLoss >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)' }}>
            <div className="flex flex-col items-center mb-1">
              <p className="text-[10px] text-white/60 mb-1">Kar / Zarar</p>
              {totalCost > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${profitLoss >= 0 ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}`}>
                  {profitLoss >= 0 ? '▲' : '▼'} %{Math.abs(profitLossPercent).toFixed(1)}
                </span>
              )}
            </div>
            <p className={`text-base font-bold tracking-tight ${profitLoss >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
              {profitLoss >= 0 ? '+' : ''}{formatMoney(profitLoss)}
            </p>
          </div>
          {filledGoldPriceCount > 0 && (
            <p className="text-[9px] mt-2 text-white/40 text-center">
              ✓ Güncel altın fiyatları ile hesaplanıyor
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
      ) : goals.length === 0 ? (
        <div className="card p-12 text-center">
          <Target size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-muted)' }}>Henüz tasarruf hedefi yok</p>
          <button onClick={() => { setEditItem(null); setShowForm(true); }} className="btn btn-primary mt-4"><Plus size={18} /> İlk Hedefi Oluştur</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.filter(g => g.status !== 'deleted').map((goal, i) => {
            const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
            const isComplete = goal.status === 'completed';
            const daysLeft = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)) : null;

            return (
              <div key={goal.id} onClick={() => setSelectedGoal(goal)} 
                className="card p-5 animate-fade-in cursor-pointer hover:shadow-lg transition-all border-transparent hover:border-[var(--primary)] border-2" 
                style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white ${isComplete ? 'bg-emerald-500' : 'gradient-primary'}`}>
                      {goal.icon || (isComplete ? '🎉' : '🎯')}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{goal.name}</p>
                      {daysLeft !== null && !isComplete && (
                        <p className="text-xs" style={{ color: daysLeft < 30 ? 'var(--expense)' : 'var(--text-muted)' }}>{daysLeft} gün kaldı</p>
                      )}
                      {isComplete && <span className="badge badge-income text-xs">Tamamlandı!</span>}
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditItem(goal); setShowForm(true); }} className="btn-icon btn-ghost btn-sm"><Edit3 size={14} /></button>
                    <button onClick={() => handleDelete(goal.id)} className="btn-icon btn-ghost btn-sm hover:!text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>Mevcut Birikim</span>
                    <div className="text-right">
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {((!goal.currency || goal.currency === '₺') && !GOLD_TYPES.includes(goal.metric))
                          ? formatMoney(goal.current_value || goal.current_amount)
                          : goal.metric
                            ? `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(goal.current_amount)} ${goal.metric}`
                            : `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(goal.current_amount)} ${goal.currency}`
                        }
                      </span>
                      {((goal.currency && goal.currency !== '₺') || GOLD_TYPES.includes(goal.metric)) && (
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          {formatMoney(goal.current_value || 0)}
                        </p>
                      )}
                    </div>
                  </div>
                  {goal.target_amount > 0 && (
                    <>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: isComplete ? '#10b981' : undefined }} />
                      </div>
                      <p className="text-xs text-right mt-1 font-medium" style={{ color: 'var(--primary)' }}>{Math.round(pct)}%</p>
                    </>
                  )}
                </div>

                <div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {addAmountId === goal.id ? (
                      <div className="flex flex-col gap-2 p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] animate-slide-up">
                        <div className="flex gap-1 mb-2 p-1 bg-[var(--bg-primary)] rounded-lg">
                          <button onClick={() => setTransType('in')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${transType === 'in' ? 'bg-emerald-500 text-white shadow-sm' : 'text-[var(--text-muted)]'}`}>Giriş</button>
                          <button onClick={() => setTransType('out')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${transType === 'out' ? 'bg-rose-500 text-white shadow-sm' : 'text-[var(--text-muted)]'}`}>Çıkış</button>
                        </div>
                        
                        {/* Miktar Alanı: Metric varsa metric, yoksa Para Birimi */}
                        <div className="flex items-center gap-2">
                          <input type="number" className="input text-lg font-bold" style={{ flex: 1 }} 
                            placeholder="Miktar" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} autoFocus />
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--bg-primary)] rounded border border-[var(--border)] w-14 text-center" style={{ color: 'var(--text-secondary)' }}>
                              {goal.metric || goal.currency}
                            </span>
                            {goal.metric && goal.currency && goal.currency !== '₺' && (
                              <span className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>({goal.currency})</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Tutar Alanı: Her zaman ₺ (Eğer hem metric hem para birimi varsa veya para birimi ₺ değilse) */}
                        {(goal.metric || (goal.currency && goal.currency !== '₺')) && (
                          <div className="flex items-center gap-2">
                            <input type="number" className="input text-lg font-bold" style={{ flex: 1 }} 
                              placeholder="Birim Fiyat" value={addValue} onChange={(e) => setAddValue(e.target.value)} />
                            <span className="text-[10px] font-bold px-2 py-1 bg-[var(--bg-primary)] rounded border border-[var(--border)] w-14 text-center" style={{ color: 'var(--text-secondary)' }}>
                              ₺
                            </span>
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold opacity-70 ml-1">İşlem Tarihi</label>
                          <input type="date" className="input text-sm py-1.5" value={transDate} onChange={(e) => setTransDate(e.target.value)} />
                        </div>
                        
                        <div className="flex gap-2 mt-1">
                          <button 
                            onClick={() => handleAddAmount(goal.id)} 
                            className={`btn flex-1 ${transType === 'out' ? 'bg-rose-500 hover:bg-rose-600 text-white border-none' : 'btn-primary'}`}
                          >
                            {transType === 'out' ? 'Çıkış Yap' : 'Ekle'}
                          </button>
                          <button onClick={() => { setAddAmountId(null); setAddAmount(''); setAddValue(''); setTransType('in'); }} className="btn btn-ghost btn-sm">İptal</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddAmountId(goal.id)} className="btn btn-secondary btn-sm w-full">Birikim Ekle / Çıkar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <SavingsFormModal editItem={editItem} onClose={() => { setShowForm(false); setEditItem(null); }} onSaved={() => { setShowForm(false); setEditItem(null); fetchGoals(); }} />}
      {selectedGoal && <GoalDetailsModal goal={selectedGoal} onDeleteHistoryItem={handleDeleteHistory} onClose={() => setSelectedGoal(null)} />}

      {/* Custom Confirmation Modal */}
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

function SavingsFormModal({ editItem, onClose, onSaved }) {
  // Legacy: gold types were stored in metric. Migrate to currency on edit.
  const editGoldInMetric = editItem?.metric && GOLD_TYPES.includes(editItem.metric);
  const [name, setName] = useState(editItem?.name || '');
  const [currency, setCurrency] = useState(editGoldInMetric ? editItem.metric : (editItem?.currency || '₺'));
  const [metric, setMetric] = useState(editGoldInMetric ? '' : (editItem?.metric || ''));
  const [icon, setIcon] = useState(editItem?.icon || '🎯');
  const [emojiFilter, setEmojiFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredEmojis = emojiFilter ? EMOJI_CATEGORIES[emojiFilter] : ALL_EMOJIS;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const payload = { name: name.trim(), currency, metric, icon, target_amount: editItem?.target_amount || 0 };
      if (editItem) {
        await api.put(`/savings/${editItem.id}`, payload);
      } else {
        await api.post('/savings', payload);
      }
      onSaved();
    } catch {}
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editItem ? 'Hesabı Düzenle' : 'Yeni Tasarruf Hesabı'}</h3>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Hesap Adı</label>
            <input className="input" placeholder="ör: Tatil fonu" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Para/Tasarruf Birimi</label>
              <div className="flex flex-wrap gap-2">
                {/* Currency Units */}
                {['₺', '$', '€'].map(u => (
                  <button key={u} type="button" onClick={() => setCurrency(u === currency ? '' : u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${currency === u ? 'btn-primary' : 'bg-[var(--bg-secondary)]'}`}
                    style={{ color: currency === u ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {u}
                  </button>
                ))}
                {/* Gold Units */}
                {GOLD_TYPES.map(u => (
                  <button key={u} type="button" onClick={() => setCurrency(u === currency ? '' : u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${currency === u ? 'btn-primary' : 'bg-[var(--bg-secondary)]'}`}
                    style={{ color: currency === u ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Ölçü Birimi</label>
              <div className="flex flex-wrap gap-2">
                {['Gr', 'Adet'].map(u => (
                  <button key={u} type="button" onClick={() => setMetric(u === metric ? '' : u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${metric === u ? 'btn-primary' : 'bg-[var(--bg-secondary)]'}`}
                    style={{ color: metric === u ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>İkon</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button type="button" onClick={() => setEmojiFilter('')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${!emojiFilter ? 'text-white' : 'hover:opacity-80'}`}
                style={{ background: !emojiFilter ? 'var(--primary)' : 'var(--bg-secondary)', color: !emojiFilter ? 'white' : 'var(--text-secondary)' }}>
                Tümü
              </button>
              {EMOJI_CATEGORY_KEYS.map(cat => (
                <button key={cat} type="button" onClick={() => setEmojiFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${emojiFilter === cat ? 'text-white' : 'hover:opacity-80'}`}
                  style={{ background: emojiFilter === cat ? 'var(--primary)' : 'var(--bg-secondary)', color: emojiFilter === cat ? 'white' : 'var(--text-secondary)' }}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1" style={{ scrollbarWidth: 'thin' }}>
              {filteredEmojis.map(e => (
                <button key={e} type="button" onClick={() => setIcon(e)} className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all ${icon === e ? 'ring-2 ring-[var(--primary)] scale-110' : 'hover:bg-[var(--bg-secondary)]'}`}>{e}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Kaydediliyor...' : editItem ? 'Güncelle' : 'Oluştur'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function GoalDetailsModal({ goal, onClose, onDeleteHistoryItem }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try { const { data } = await api.get(`/savings/${goal.id}/history`); setHistory(data.history); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [goal.id, goal.current_amount]); // Refresh when goal changes or balance updates (due to delete)

  const onDeleteHistory = async (historyId) => {
    await onDeleteHistoryItem(goal.id, historyId);
  };

  const exportToPDF = (goal, history) => {
    try {
      const doc = new jsPDF();
      
      doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.setFont('Roboto');

      doc.setFontSize(18);
      doc.text(`${goal.name} - Hesap Dökümü`, 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);
      
      const tableData = history.map(item => [
        new Date(item.date).toLocaleDateString('tr-TR'),
        item.type === 'out' ? 'Çıkış' : 'Giriş',
        `${item.amount} ${item.metric || goal.currency}`,
        `${item.unit_price || 0} ₺`,
        `${(item.amount * (item.unit_price || 0)).toFixed(2)} ₺`
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Tarih', 'İşlem', 'Miktar', 'Birim Fiyat', 'Toplam']],
        body: tableData,
        styles: { font: 'Roboto', fontSize: 10 },
        headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [79, 70, 229] },
        theme: 'striped'
      });

      const b64 = doc.output('datauristring');
      const link = document.createElement('a');
      link.href = b64;
      link.download = `${goal.name}_dokum.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('PDF dışa aktarılırken bir hata oluştu.');
    }
  };

  const exportToExcel = (goal, history) => {
    const data = history.map(item => ({
      'Tarih': new Date(item.date).toLocaleDateString('tr-TR'),
      'İşlem Tipi': item.type === 'out' ? 'Çıkış' : 'Giriş',
      'Miktar': item.amount,
      'Birim': item.metric || goal.currency,
      'Birim Fiyat (₺)': item.unit_price || 0,
      'Toplam Tutar (₺)': (item.amount * (item.unit_price || 0)).toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Geçmiş');
    XLSX.writeFile(wb, `${goal.name}_dokum.xlsx`);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content p-0 max-w-lg overflow-hidden">
        <div className="p-6 gradient-primary text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl">
                {goal.icon || '🎯'}
              </div>
              <div>
                <h3 className="text-xl font-bold">{goal.name}</h3>
                <p className="text-sm opacity-80">Hesap Detayları</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => exportToPDF(goal, history)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="PDF İndir"><FileText size={20} /></button>
              <button onClick={() => exportToExcel(goal, history)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Excel İndir"><FileSpreadsheet size={20} /></button>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
              <p className="text-xs opacity-70 mb-1">Mevcut Birikim</p>
              <p className="text-lg font-bold">
                {formatValue(goal.current_amount, '', goal.metric || goal.unit)}
                {goal.metric && goal.currency && goal.currency !== '₺' && ` ${goal.currency}`}
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
              <p className="text-xs opacity-70 mb-1">Toplam Değer</p>
              <p className="text-lg font-bold">{formatMoney(goal.current_value || 0)}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[var(--bg-primary)]">
          <div className="flex items-center gap-2 mb-4">
            <History size={18} style={{ color: 'var(--primary)' }} />
            <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Birikim Geçmişi</h4>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Henüz işlem kaydı bulunmuyor.</p>
              </div>
            ) : (
              (() => {
                let runningAmount = 0;
                let runningValue = 0;
                // History is desc, so we need to calculate running totals from bottom up
                const historyWithTotals = [...history].reverse().map(item => {
                  const isOut = item.type === 'out';
                  runningAmount += Number(item.amount || 0) * (isOut ? -1 : 1);
                  runningValue += Number(item.value || 0) * (isOut ? -1 : 1);
                  return { ...item, runningAmount, runningValue };
                }).reverse();

                return historyWithTotals.map((item, idx) => {
                  const isOut = item.type === 'out';
                  const maliyet = item.unit_price || (item.amount > 0 && item.value > 0 ? (item.value / item.amount) : null);
                  const transactionTotal = item.value || (item.amount * (item.unit_price || 0));

                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-xl animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isOut ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {isOut ? <Minus size={16} /> : <Plus size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-bold text-sm ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {item.amount > 0 && `${isOut ? '-' : '+'}${formatValue(item.amount, '', item.metric)}`}
                              {item.metric && goal.currency && goal.currency !== '₺' && <span className="ml-1">{goal.currency}</span>}
                              {item.amount > 0 && maliyet > 0 && ' / '}
                              {maliyet > 0 && `${isOut ? '-' : '+'}${formatValue(maliyet, '₺', '')}`}
                            </p>
                          </div>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right shrink-0">
                          <p className={`text-[11px] font-bold ${isOut ? 'text-rose-500' : 'text-[var(--primary)]'}`}>
                             {isOut ? '-' : '+'}{formatValue(transactionTotal, '₺', '')}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Bakiye: {formatValue(item.runningAmount, '', item.metric || goal.unit)} {goal.currency !== '₺' ? goal.currency : ''}
                          </p>
                        </div>
                        <button onClick={() => onDeleteHistory(item.id)} className="p-1.5 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded-lg transition-all" title="İşlemi Sil">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
