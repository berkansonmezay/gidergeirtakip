import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT i.*, c.name as category_name, c.icon as category_icon FROM installments i LEFT JOIN categories c ON i.category_id = c.id WHERE i.user_id = ?';
    const params = [req.user.id];
    if (status) { query += ' AND i.status = ?'; params.push(status); }
    query += ' ORDER BY i.next_payment_date ASC';
    res.json({ installments: db.prepare(query).all(...params) });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
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
    const { description, total_amount, installment_count, start_date, category_id } = req.body;
    if (!description || !total_amount || !installment_count || !start_date) return res.status(400).json({ error: 'Zorunlu alanlar eksik.' });
    const monthly = Math.ceil((total_amount / installment_count) * 100) / 100;
    const sd = new Date(start_date);
    const npd = new Date(sd.getFullYear(), sd.getMonth() + 1, sd.getDate());
    const result = db.prepare('INSERT INTO installments (description,total_amount,installment_count,paid_count,monthly_amount,start_date,next_payment_date,category_id,user_id,status) VALUES (?,?,?,0,?,?,?,?,?,\'active\')').run(description, total_amount, installment_count, monthly, start_date, npd.toISOString().split('T')[0], category_id||null, req.user.id);
    const iid = result.lastInsertRowid;
    const ps = db.prepare('INSERT INTO installment_payments (installment_id,payment_number,amount,due_date,is_paid) VALUES (?,?,?,?,0)');
    const ins = db.transaction(() => { for(let i=1;i<=installment_count;i++){const d=new Date(sd.getFullYear(),sd.getMonth()+i,sd.getDate());ps.run(iid,i,monthly,d.toISOString().split('T')[0]);} });
    ins();
    res.status(201).json({ message: 'Taksit oluşturuldu.', installment: db.prepare('SELECT * FROM installments WHERE id=?').get(iid) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/:id/pay', (req, res) => {
  try {
    const inst = db.prepare('SELECT * FROM installments WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!inst) return res.status(404).json({ error: 'Bulunamadı.' });
    const np = db.prepare('SELECT * FROM installment_payments WHERE installment_id=? AND is_paid=0 ORDER BY payment_number LIMIT 1').get(req.params.id);
    if (!np) return res.status(400).json({ error: 'Tüm taksitler ödenmiş.' });
    const today = new Date().toISOString().split('T')[0];
    db.prepare('UPDATE installment_payments SET is_paid=1, paid_date=? WHERE id=?').run(today, np.id);
    const newPaid = inst.paid_count + 1;
    const done = newPaid >= inst.installment_count;
    const nextU = db.prepare('SELECT * FROM installment_payments WHERE installment_id=? AND is_paid=0 ORDER BY payment_number LIMIT 1').get(req.params.id);
    db.prepare('UPDATE installments SET paid_count=?, status=?, next_payment_date=? WHERE id=?').run(newPaid, done?'completed':'active', nextU?nextU.due_date:inst.next_payment_date, req.params.id);
    res.json({ message: 'Taksit ödendi.', installment: db.prepare('SELECT * FROM installments WHERE id=?').get(req.params.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/:id/unpay', (req, res) => {
  try {
    const inst = db.prepare('SELECT * FROM installments WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!inst) return res.status(404).json({ error: 'Bulunamadı.' });
    
    const lastPaid = db.prepare('SELECT * FROM installment_payments WHERE installment_id=? AND is_paid=1 ORDER BY payment_number DESC LIMIT 1').get(req.params.id);
    if (!lastPaid) return res.status(400).json({ error: 'Ödenmiş taksit bulunamadı.' });

    db.prepare('UPDATE installment_payments SET is_paid=0, paid_date=NULL WHERE id=?').run(lastPaid.id);
    
    const newPaid = inst.paid_count - 1;
    // The next payment date should be the one we just unpaid
    db.prepare('UPDATE installments SET paid_count=?, status=\'active\', next_payment_date=? WHERE id=?').run(newPaid, lastPaid.due_date, req.params.id);
    
    res.json({ message: 'Ödeme geri alındı.', installment: db.prepare('SELECT * FROM installments WHERE id=?').get(req.params.id) });
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
