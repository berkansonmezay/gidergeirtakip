import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/payees
router.get('/', (req, res) => {
  try {
    const payees = db.prepare('SELECT * FROM payees WHERE user_id = ? ORDER BY name ASC').all(req.user.id);
    res.json({ payees });
  } catch (err) {
    console.error('Payees list error:', err);
    res.status(500).json({ error: 'Ödeme yerleri listelenirken hata oluştu.' });
  }
});

// POST /api/payees
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'İsim zorunludur.' });

    const result = db.prepare('INSERT INTO payees (name, user_id) VALUES (?, ?)').run(name, req.user.id);
    const payee = db.prepare('SELECT * FROM payees WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ payee });
  } catch (err) {
    console.error('Payee create error:', err);
    res.status(500).json({ error: 'Ödeme yeri oluşturulurken hata oluştu.' });
  }
});

// PUT /api/payees/:id
router.put('/:id', (req, res) => {
  try {
    const { name } = req.body;
    const result = db.prepare('UPDATE payees SET name = ? WHERE id = ? AND user_id = ?').run(name, req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    res.json({ message: 'Güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Güncellenirken hata oluştu.' });
  }
});

// DELETE /api/payees/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM payees WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Silinirken hata oluştu.' });
  }
});

export default router;
