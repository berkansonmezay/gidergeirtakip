import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/transactions
router.get('/', (req, res) => {
  try {
    const { type, category_id, payee_id, start_date, end_date, search, limit = 50, offset = 0 } = req.query;
    
    let baseQuery = `
      SELECT * FROM (
        SELECT 
          t.id, 
          t.amount, 
          t.description, 
          t.date, 
          t.type, 
          t.category_id, 
          t.payee_id, 
          t.created_at,
          c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as payee_name,
          'transaction' as record_type
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN payees p ON t.payee_id = p.id
        WHERE t.user_id = ?

        UNION ALL

        SELECT 
          ip.id, 
          ip.amount, 
          i.description || ' (' || ip.payment_number || '. Taksit)' as description, 
          ip.paid_date as date, 
          i.type, 
          i.category_id, 
          i.payee_id, 
          i.created_at,
          c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as payee_name,
          'installment_payment' as record_type
        FROM installment_payments ip
        JOIN installments i ON ip.installment_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN payees p ON i.payee_id = p.id
        WHERE i.user_id = ? AND ip.is_paid = 1
      ) as combined
      WHERE 1=1
    `;
    const params = [req.user.id, req.user.id];

    if (type) {
      baseQuery += ' AND type = ?';
      params.push(type);
    }
    if (category_id) {
      baseQuery += ' AND category_id = ?';
      params.push(category_id);
    }
    if (payee_id) {
      baseQuery += ' AND payee_id = ?';
      params.push(payee_id);
    }
    if (start_date) {
      baseQuery += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      baseQuery += ' AND date <= ?';
      params.push(end_date);
    }

    // For the actual results
    let dataQuery = baseQuery + ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    
    const transactions = db.prepare(dataQuery).all(...dataParams);

    // For the total count
    let countQuery = 'SELECT COUNT(*) as total FROM (' + baseQuery + ')';
    const { total } = db.prepare(countQuery).get(...params);

    res.json({ transactions, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    console.error('Transactions list error:', err);
    res.status(500).json({ error: 'İşlemler listelenirken hata oluştu.' });
  }
});

// POST /api/transactions
router.post('/', (req, res) => {
  try {
    const { amount, description, date, type, category_id, payee_id } = req.body;

    if (!amount || !date || !type) {
      return res.status(400).json({ error: 'Tutar, tarih ve tür zorunludur.' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Geçersiz işlem türü.' });
    }

    const result = db.prepare(`
      INSERT INTO transactions (amount, description, date, type, category_id, payee_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(amount, description || '', date, type, category_id || null, payee_id || null, req.user.id);

    const transaction = db.prepare(`
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as payee_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payees p ON t.payee_id = p.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ message: 'İşlem eklendi.', transaction });
  } catch (err) {
    console.error('Transaction create error:', err);
    res.status(500).json({ error: 'İşlem eklenirken hata oluştu.' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, type, category_id, payee_id } = req.body;

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'İşlem bulunamadı.' });
    }

    db.prepare(`
      UPDATE transactions SET amount = ?, description = ?, date = ?, type = ?, category_id = ?, payee_id = ?
      WHERE id = ? AND user_id = ?
    `).run(
      amount || existing.amount,
      description !== undefined ? description : existing.description,
      date || existing.date,
      type || existing.type,
      category_id !== undefined ? category_id : existing.category_id,
      payee_id !== undefined ? payee_id : existing.payee_id,
      id,
      req.user.id
    );

    const transaction = db.prepare(`
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as payee_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payees p ON t.payee_id = p.id
      WHERE t.id = ?
    `).get(id);

    res.json({ message: 'İşlem güncellendi.', transaction });
  } catch (err) {
    console.error('Transaction update error:', err);
    res.status(500).json({ error: 'İşlem güncellenirken hata oluştu.' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'İşlem bulunamadı.' });
    }
    res.json({ message: 'İşlem silindi.' });
  } catch (err) {
    console.error('Transaction delete error:', err);
    res.status(500).json({ error: 'İşlem silinirken hata oluştu.' });
  }
});

// GET /api/transactions/summary
router.get('/summary', (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    const income = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ?
    `).get(req.user.id, startDate, endDate);

    const expense = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?
    `).get(req.user.id, startDate, endDate);

    res.json({
      month: targetMonth,
      year: targetYear,
      totalIncome: income.total,
      totalExpense: expense.total,
      balance: income.total - expense.total,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Özet hesaplanırken hata oluştu.' });
  }
});

export default router;
