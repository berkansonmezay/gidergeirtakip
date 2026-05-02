import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const { status, type } = req.query;
    let query = 'SELECT i.*, c.name as category_name, c.icon as category_icon, p.name as payee_name FROM installments i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN payees p ON i.payee_id = p.id WHERE i.user_id = ?';
    const params = [req.user.id];
    if (status) { query += ' AND i.status = ?'; params.push(status); }
    if (type) { query += ' AND i.type = ?'; params.push(type); }
    query += ' ORDER BY i.created_at DESC';
    
    const installments = db.prepare(query).all(...params);
    
    // Attach nested payments for expandable rows
    const getPayments = db.prepare('SELECT * FROM installment_payments WHERE installment_id = ? ORDER BY payment_number ASC');
    for (let inst of installments) {
      inst.payments = getPayments.all(inst.id);
      inst.paid_amount = inst.payments.filter(p => p.is_paid).reduce((sum, p) => sum + p.amount, 0);
    }
    
    res.json({ installments });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Hata oluştu.' }); 
  }
});

router.get('/payments/all', (req, res) => {
  try {
    const { type } = req.query;
    let query = `
      SELECT 
        p.*, 
        i.description, i.installment_count, i.type as transaction_type, i.payee_id, i.category_id,
        c.name as category_name, c.icon as category_icon, 
        pay.name as payee_name 
      FROM installment_payments p
      JOIN installments i ON p.installment_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN payees pay ON i.payee_id = pay.id
      WHERE i.user_id = ?
    `;
    const params = [req.user.id];
    if (type) {
      query += ' AND i.type = ?';
      params.push(type);
    }
    query += ' ORDER BY p.due_date ASC';
    res.json({ payments: db.prepare(query).all(...params) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const inst = db.prepare('SELECT i.*, c.name as category_name FROM installments i LEFT JOIN categories c ON i.category_id = c.id WHERE i.id = ? AND i.user_id = ?').get(req.params.id, req.user.id);
    if (!inst) return res.status(404).json({ error: 'Bulunamadı.' });
    const payments = db.prepare('SELECT * FROM installment_payments WHERE installment_id = ? ORDER BY payment_number').all(req.params.id);
    res.json({ installment: inst, payments });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.post('/', (req, res) => {
  try {
    const { description, total_amount, installment_count, start_date, category_id, payee_id, type = 'expense' } = req.body;
    if (!description || !total_amount || !installment_count || !start_date) return res.status(400).json({ error: 'Zorunlu alanlar eksik.' });
    const monthly = Math.ceil((total_amount / installment_count) * 100) / 100;
    const sd = new Date(start_date);
    const npd = new Date(sd.getFullYear(), sd.getMonth() + 1, sd.getDate());
    const result = db.prepare('INSERT INTO installments (description,total_amount,installment_count,paid_count,monthly_amount,start_date,next_payment_date,category_id,payee_id,user_id,type,status) VALUES (?,?,?,0,?,?,?,?,?,?,?,\'active\')').run(description, total_amount, installment_count, monthly, start_date, npd.toISOString().split('T')[0], category_id||null, payee_id||null, req.user.id, type);
    const iid = result.lastInsertRowid;
    const ps = db.prepare('INSERT INTO installment_payments (installment_id,payment_number,amount,due_date,is_paid) VALUES (?,?,?,?,0)');
    const ins = db.transaction(() => { for(let i=1;i<=installment_count;i++){const d=new Date(sd.getFullYear(),sd.getMonth()+i,sd.getDate());ps.run(iid,i,monthly,d.toISOString().split('T')[0]);} });
    ins();
    res.status(201).json({ message: 'Taksit oluşturuldu.', installment: db.prepare('SELECT * FROM installments WHERE id=?').get(iid) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/payments/:paymentId/pay', (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    const { date } = req.body;
    const payment = db.prepare('SELECT * FROM installment_payments WHERE id = ?').get(paymentId);
    if (!payment) return res.status(404).json({ error: 'Ödeme bulunamadı.' });
    if (payment.is_paid) return res.status(400).json({ error: 'Zaten ödenmiş.' });

    const payDate = date || new Date().toISOString().split('T')[0];
    db.prepare('UPDATE installment_payments SET is_paid=1, paid_date=? WHERE id=?').run(payDate, paymentId);

    // Recalculate parent
    const instId = payment.installment_id;
    const inst = db.prepare('SELECT * FROM installments WHERE id = ? AND user_id = ?').get(instId, req.user.id);
    if (inst) {
      const paidCount = db.prepare('SELECT COUNT(*) as c FROM installment_payments WHERE installment_id = ? AND is_paid = 1').get(instId).c;
      const nextU = db.prepare('SELECT * FROM installment_payments WHERE installment_id = ? AND is_paid = 0 ORDER BY payment_number LIMIT 1').get(instId);
      const done = paidCount >= inst.installment_count;
      db.prepare('UPDATE installments SET paid_count=?, status=?, next_payment_date=? WHERE id=?').run(paidCount, done ? 'completed' : 'active', nextU ? nextU.due_date : inst.next_payment_date, instId);
    }

    res.json({ message: 'Taksit ödendi.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/payments/:paymentId/unpay', (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    const payment = db.prepare('SELECT * FROM installment_payments WHERE id = ?').get(paymentId);
    if (!payment) return res.status(404).json({ error: 'Ödeme bulunamadı.' });
    if (!payment.is_paid) return res.status(400).json({ error: 'Zaten ödenmemiş.' });

    db.prepare('UPDATE installment_payments SET is_paid=0, paid_date=NULL WHERE id=?').run(paymentId);

    // Recalculate parent
    const instId = payment.installment_id;
    const inst = db.prepare('SELECT * FROM installments WHERE id = ? AND user_id = ?').get(instId, req.user.id);
    if (inst) {
      const paidCount = db.prepare('SELECT COUNT(*) as c FROM installment_payments WHERE installment_id = ? AND is_paid = 1').get(instId).c;
      const nextU = db.prepare('SELECT * FROM installment_payments WHERE installment_id = ? AND is_paid = 0 ORDER BY payment_number LIMIT 1').get(instId);
      db.prepare('UPDATE installments SET paid_count=?, status=?, next_payment_date=? WHERE id=?').run(paidCount, 'active', nextU ? nextU.due_date : inst.next_payment_date, instId);
    }

    res.json({ message: 'Ödeme geri alındı.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM installments WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Bulunamadı.' });
    res.json({ message: 'Silindi.' });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

export default router;
