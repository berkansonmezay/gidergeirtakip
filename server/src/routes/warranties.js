import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';

const router = Router();
router.use(authenticateToken);
router.use(cacheMiddleware(120));
router.use(invalidateCacheMiddleware);

// GET all warranties for user
router.get('/', async (req, res) => {
  try {
    const userIdStr = String(req.user.id);
    const userIdNum = Number(req.user.id);
    const idArray = isNaN(userIdNum) ? [userIdStr] : [userIdStr, userIdNum];

    const snapshot = await db.collection('warranties')
      .where('user_id', 'in', idArray)
      .get();

    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    items.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    res.json({ items });
  } catch (err) {
    console.error('Error fetching warranties:', err);
    res.status(500).json({ error: 'Garanti belgeleri yüklenirken hata oluştu.' });
  }
});

// POST new warranty
router.post('/', async (req, res) => {
  try {
    const {
      product_name, brand, model, serial_number, category,
      purchase_date, warranty_end_date, purchase_price,
      store_name, document_type, photo_base64, photo_thumbnail,
      notification_enabled, notes
    } = req.body;

    if (!product_name) return res.status(400).json({ error: 'Ürün adı zorunludur.' });

    const newItem = {
      product_name: product_name.trim(),
      brand: (brand || '').trim(),
      model: (model || '').trim(),
      serial_number: (serial_number || '').trim(),
      category: category || 'diger',
      purchase_date: purchase_date || null,
      warranty_end_date: warranty_end_date || null,
      purchase_price: purchase_price ? Number(purchase_price) : 0,
      store_name: (store_name || '').trim(),
      document_type: document_type || 'fatura',
      photo_base64: photo_base64 || null,
      photo_thumbnail: photo_thumbnail || null,
      notification_enabled: notification_enabled || false,
      notification_sent: false,
      notes: (notes || '').trim(),
      user_id: String(req.user.id),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await db.collection('warranties').add(newItem);
    res.status(201).json({ message: 'Kayıt oluşturuldu.', item: { id: docRef.id, ...newItem } });
  } catch (err) {
    console.error('Error creating warranty:', err);
    res.status(500).json({ error: 'Kayıt oluşturulurken hata oluştu.' });
  }
});

// PUT update warranty
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection('warranties').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    const existing = doc.data();
    const {
      product_name, brand, model, serial_number, category,
      purchase_date, warranty_end_date, purchase_price,
      store_name, document_type, photo_base64, photo_thumbnail,
      notification_enabled, notes
    } = req.body;

    const updates = {
      product_name: product_name !== undefined ? product_name.trim() : existing.product_name,
      brand: brand !== undefined ? brand.trim() : existing.brand,
      model: model !== undefined ? model.trim() : existing.model,
      serial_number: serial_number !== undefined ? serial_number.trim() : existing.serial_number,
      category: category !== undefined ? category : existing.category,
      purchase_date: purchase_date !== undefined ? purchase_date : existing.purchase_date,
      warranty_end_date: warranty_end_date !== undefined ? warranty_end_date : existing.warranty_end_date,
      purchase_price: purchase_price !== undefined ? Number(purchase_price) : existing.purchase_price,
      store_name: store_name !== undefined ? store_name.trim() : existing.store_name,
      document_type: document_type !== undefined ? document_type : existing.document_type,
      photo_base64: photo_base64 !== undefined ? photo_base64 : existing.photo_base64,
      photo_thumbnail: photo_thumbnail !== undefined ? photo_thumbnail : existing.photo_thumbnail,
      notification_enabled: notification_enabled !== undefined ? notification_enabled : existing.notification_enabled,
      notes: notes !== undefined ? notes.trim() : existing.notes,
      updated_at: new Date().toISOString()
    };

    await docRef.update(updates);
    res.json({ message: 'Kayıt güncellendi.', item: { id: req.params.id, ...existing, ...updates } });
  } catch (err) {
    console.error('Error updating warranty:', err);
    res.status(500).json({ error: 'Güncelleme sırasında hata oluştu.' });
  }
});

// PUT toggle notification
router.put('/:id/notification', async (req, res) => {
  try {
    const docRef = db.collection('warranties').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    const current = doc.data().notification_enabled;
    await docRef.update({
      notification_enabled: !current,
      updated_at: new Date().toISOString()
    });

    res.json({ message: !current ? 'Bildirim aktif edildi.' : 'Bildirim kapatıldı.', notification_enabled: !current });
  } catch (err) {
    console.error('Error toggling notification:', err);
    res.status(500).json({ error: 'Bildirim ayarı değiştirilirken hata oluştu.' });
  }
});

// DELETE warranty
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('warranties').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    await docRef.delete();
    res.json({ message: 'Kayıt silindi.' });
  } catch (err) {
    console.error('Error deleting warranty:', err);
    res.status(500).json({ error: 'Silme sırasında hata oluştu.' });
  }
});

export default router;
