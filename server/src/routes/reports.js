import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';

const router = Router();
router.use(authenticateToken);
router.use(cacheMiddleware(120));
router.use(invalidateCacheMiddleware);

// GET /api/reports/monthly
router.get('/monthly', async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const data = [];
    const now = new Date();
    
    // We can fetch all transactions for the last N months in one query to save reads
    const startDateAll = new Date(now.getFullYear(), now.getMonth() - parseInt(months) + 1, 1).toISOString().split('T')[0];
    const snapshot = await db.collection('transactions')
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();
      
    const allTx = snapshot.docs.map(d => d.data()).filter(t => t.date >= startDateAll);

    const monthNames = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const txInMonth = allTx.filter(t => t.date >= start && t.date <= end);
      const inc = txInMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const exp = txInMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      data.push({ 
        month: monthNames[d.getMonth()], 
        year: d.getFullYear(), 
        monthNum: d.getMonth() + 1, 
        income: inc, 
        expense: exp, 
        balance: inc - exp 
      });
    }
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

// GET /api/reports/category-breakdown
router.get('/category-breakdown', async (req, res) => {
  try {
    const { type = 'expense', start_date, end_date } = req.query;
    const now = new Date();
    const sd = start_date || new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
    const ed = end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const snapshot = await db.collection('transactions')
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();
      
    const docs = snapshot.docs.filter(doc => {
      const t = doc.data();
      return t.type === type && t.date >= sd && t.date <= ed;
    });
      
    const categoryTotals = {};
    const categoryCounts = {};
    const categoryIds = new Set();
    
    let grandTotal = 0;
    
    docs.forEach(doc => {
      const t = doc.data();
      const cid = String(t.category_id);
      categoryIds.add(cid);
      
      if (!categoryTotals[cid]) categoryTotals[cid] = 0;
      if (!categoryCounts[cid]) categoryCounts[cid] = 0;
      
      const amt = Number(t.amount || 0);
      categoryTotals[cid] += amt;
      categoryCounts[cid] += 1;
      grandTotal += amt;
    });
    
    const categories = {};
    if (categoryIds.size > 0) {
      const cSnap = await db.collection('categories').where('__name__', 'in', Array.from(categoryIds).slice(0, 30)).get();
      cSnap.docs.forEach(d => categories[d.id] = d.data());
    }
    
    const breakdown = Object.keys(categoryTotals).map(cid => {
      const c = categories[cid] || { name: 'Diğer', icon: '📁', color: '#6366f1' };
      const total = categoryTotals[cid];
      return {
        name: c.name,
        icon: c.icon,
        color: c.color,
        total,
        count: categoryCounts[cid],
        percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
      };
    }).sort((a, b) => b.total - a.total);
    
    res.json({ breakdown, total: grandTotal, startDate: sd, endDate: ed });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

// GET /api/reports/trends
router.get('/trends', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const data = [];
    const now = new Date();
    
    const startDateAll = new Date(now.getFullYear(), now.getMonth() - parseInt(months) + 1, 1).toISOString().split('T')[0];
    const snapshot = await db.collection('transactions')
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();
      
    const allTx = snapshot.docs.map(d => d.data()).filter(t => t.date >= startDateAll);
    const monthNames = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const txInMonth = allTx.filter(t => t.date >= start && t.date <= end);
      const inc = txInMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const exp = txInMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      data.push({ 
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, 
        income: inc, 
        expense: exp, 
        savings: inc - exp 
      });
    }
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

// GET /api/reports/top-expenses
router.get('/top-expenses', async (req, res) => {
  try {
    const now = new Date();
    const sd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const snapshot = await db.collection('transactions')
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();
      
    const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.type === 'expense' && t.date >= sd && t.date <= ed);
    txs.sort((a, b) => Number(b.amount) - Number(a.amount));
    const topTxs = txs.slice(0, 5);
    
    const categoryIds = new Set();
    topTxs.forEach(t => { if(t.category_id) categoryIds.add(String(t.category_id)); });
    
    const categories = {};
    if (categoryIds.size > 0) {
      const cSnap = await db.collection('categories').where('__name__', 'in', Array.from(categoryIds).slice(0, 30)).get();
      cSnap.docs.forEach(d => categories[d.id] = d.data());
    }
    
    const expenses = topTxs.map(t => {
      const c = categories[t.category_id] || {};
      return {
        ...t,
        category_name: c.name || null,
        category_icon: c.icon || null,
        category_color: c.color || null
      };
    });
    
    res.json({ expenses });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

export default router;
