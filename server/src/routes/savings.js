import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const goals = db.prepare('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ goals });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.post('/', (req, res) => {
  try {
    const { name, target_amount, deadline } = req.body;
    if (!name || !target_amount) return res.status(400).json({ error: 'Ad ve hedef tutar zorunludur.' });
    const r = db.prepare('INSERT INTO savings_goals (name, target_amount, current_amount, deadline, user_id) VALUES (?,?,0,?,?)').run(name, target_amount, deadline || null, req.user.id);
    res.status(201).json({ message: 'Hedef oluşturuldu.', goal: db.prepare('SELECT * FROM savings_goals WHERE id=?').get(r.lastInsertRowid) });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/:id', (req, res) => {
  try {
    const g = db.prepare('SELECT * FROM savings_goals WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!g) return res.status(404).json({ error: 'Bulunamadı.' });
    const { name, target_amount, current_amount, deadline, add_amount } = req.body;
    const newCurrent = add_amount ? g.current_amount + add_amount : (current_amount !== undefined ? current_amount : g.current_amount);
    const newTarget = target_amount || g.target_amount;
    const isComplete = newCurrent >= newTarget;
    db.prepare('UPDATE savings_goals SET name=?, target_amount=?, current_amount=?, deadline=?, status=? WHERE id=?').run(
      name || g.name, newTarget, newCurrent, deadline !== undefined ? deadline : g.deadline, isComplete ? 'completed' : 'active', req.params.id
    );
    res.json({ message: 'Hedef güncellendi.', goal: db.prepare('SELECT * FROM savings_goals WHERE id=?').get(req.params.id) });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM savings_goals WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Bulunamadı.' });
    res.json({ message: 'Silindi.' });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

export default router;
