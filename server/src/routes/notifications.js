import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/notifications
// Kullanıcının bildirimlerini listele
router.get('/', (req, res) => {
  try {
    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).count;
    
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Bildirimleri çekerken hata:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// PUT /api/notifications/read-all
// Tüm bildirimleri okundu olarak işaretle
router.put('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// PUT /api/notifications/:id/read
// Belirli bir bildirimi okundu olarak işaretle
router.put('/:id/read', (req, res) => {
  try {
    const r = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Bildirim bulunamadı.' });
    res.json({ message: 'Bildirim okundu olarak işaretlendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// DELETE /api/notifications/:id
// Belirli bir bildirimi sil
router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Bildirim bulunamadı.' });
    res.json({ message: 'Bildirim silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

export default router;
