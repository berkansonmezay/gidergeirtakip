import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/reports/monthly
router.get('/monthly', (req, res) => {
  try {
    const { months = 6 } = req.query;
    const data = [];
    const now = new Date();
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const inc = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE user_id=? AND type=\'income\' AND date>=? AND date<=?').get(req.user.id, start, end);
      const exp = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE user_id=? AND type=\'expense\' AND date>=? AND date<=?').get(req.user.id, start, end);
      const monthNames = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
      data.push({ month: monthNames[d.getMonth()], year: d.getFullYear(), monthNum: d.getMonth()+1, income: inc.t, expense: exp.t, balance: inc.t - exp.t });
    }
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

// GET /api/reports/category-breakdown
router.get('/category-breakdown', (req, res) => {
  try {
    const { type = 'expense', start_date, end_date } = req.query;
    const now = new Date();
    const sd = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const ed = end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const data = db.prepare(`
      SELECT c.name, c.icon, c.color, SUM(t.amount) as total, COUNT(t.id) as count
      FROM transactions t JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = ? AND t.date >= ? AND t.date <= ?
      GROUP BY c.id ORDER BY total DESC
    `).all(req.user.id, type, sd, ed);
    const grandTotal = data.reduce((s, d) => s + d.total, 0);
    const breakdown = data.map(d => ({ ...d, percentage: grandTotal > 0 ? Math.round((d.total / grandTotal) * 100) : 0 }));
    res.json({ breakdown, total: grandTotal, startDate: sd, endDate: ed });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

// GET /api/reports/trends
router.get('/trends', (req, res) => {
  try {
    const { months = 12 } = req.query;
    const data = [];
    const now = new Date();
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const inc = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE user_id=? AND type=\'income\' AND date>=? AND date<=?').get(req.user.id, start, end);
      const exp = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE user_id=? AND type=\'expense\' AND date>=? AND date<=?').get(req.user.id, start, end);
      const monthNames = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
      data.push({ label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, income: inc.t, expense: exp.t, savings: inc.t - exp.t });
    }
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

// GET /api/reports/top-expenses
router.get('/top-expenses', (req, res) => {
  try {
    const now = new Date();
    const sd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const data = db.prepare(`
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
      ORDER BY t.amount DESC LIMIT 5
    `).all(req.user.id, sd, ed);
    res.json({ expenses: data });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

export default router;
