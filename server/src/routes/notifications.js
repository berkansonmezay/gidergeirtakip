import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const userIdStr = String(req.user.id);
    const userIdNum = Number(req.user.id);
    const idArray = isNaN(userIdNum) ? [userIdStr] : [userIdStr, userIdNum];

    const snapshot = await db.collection('notifications')
      .where('user_id', 'in', idArray)
      .get();
      
    let notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifications.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    notifications = notifications.slice(0, 50);
    
    const unreadSnapshot = await db.collection('notifications')
      .where('user_id', 'in', idArray)
      .where('is_read', '==', 0)
      .get();
      
    const unreadCount = unreadSnapshot.size;
    
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Bildirimleri çekerken hata:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    const userIdStr = String(req.user.id);
    const userIdNum = Number(req.user.id);
    const idArray = isNaN(userIdNum) ? [userIdStr] : [userIdStr, userIdNum];

    const snapshot = await db.collection('notifications')
      .where('user_id', 'in', idArray)
      .where('is_read', '==', 0)
      .get();
      
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { is_read: 1 });
    });
    
    await batch.commit();
    res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi.' });
  } catch (err) {
    console.error('Read-all error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const docRef = db.collection('notifications').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bildirim bulunamadı.' });
    }
    
    await docRef.update({ is_read: 1 });
    res.json({ message: 'Bildirim okundu olarak işaretlendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('notifications').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bildirim bulunamadı.' });
    }
    
    await docRef.delete();
    res.json({ message: 'Bildirim silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

export default router;
