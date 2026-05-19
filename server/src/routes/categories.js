import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let categoriesRef = db.collection('categories').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]);

    if (type) {
      categoriesRef = categoriesRef.where('type', '==', type);
    }

    const snapshot = await categoriesRef.get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort in memory to avoid Firestore missing index error
    categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json({ categories });
  } catch (err) {
    console.error('Categories list error:', err);
    res.status(500).json({ error: 'Kategoriler listelenirken hata oluştu.' });
  }
});

// POST /api/categories
router.post('/', async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Kategori adı ve türü zorunludur.' });
    }

    const newCategory = {
      name,
      type,
      icon: icon || '📁',
      color: color || '#6366f1',
      user_id: req.user.id,
      is_default: 0,
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('categories').add(newCategory);
    const category = { id: docRef.id, ...newCategory };

    res.status(201).json({ message: 'Kategori oluşturuldu.', category });
  } catch (err) {
    console.error('Category create error:', err);
    res.status(500).json({ error: 'Kategori oluşturulurken hata oluştu.' });
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    const id = req.params.id;
    
    const docRef = db.collection('categories').doc(id);
    const doc = await docRef.get();

    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Kategori bulunamadı.' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (icon) updates.icon = icon;
    if (color) updates.color = color;

    await docRef.update(updates);
    
    const updatedDoc = await docRef.get();
    res.json({ message: 'Kategori güncellendi.', category: { id, ...updatedDoc.data() } });
  } catch (err) {
    console.error('Category update error:', err);
    res.status(500).json({ error: 'Kategori güncellenirken hata oluştu.' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('categories').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Kategori bulunamadı.' });
    }

    const batch = db.batch();

    // Set transactions to null category
    const txSnapshot = await db.collection('transactions')
      .where('category_id', '==', req.params.id)
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();
      
    txSnapshot.docs.forEach(txDoc => {
      batch.update(txDoc.ref, { category_id: null });
    });

    batch.delete(docRef);
    await batch.commit();

    res.json({ message: 'Kategori silindi.' });
  } catch (err) {
    console.error('Category delete error:', err);
    res.status(500).json({ error: 'Kategori silinirken hata oluştu.' });
  }
});

// GET /api/categories/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const txSnapshot = await db.collection('transactions')
      .where('category_id', '==', req.params.id)
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();

    let total_amount = 0;
    const transaction_count = txSnapshot.size;

    txSnapshot.docs.forEach(doc => {
      total_amount += doc.data().amount || 0;
    });

    const avg_amount = transaction_count > 0 ? total_amount / transaction_count : 0;

    res.json({ stats: { transaction_count, total_amount, avg_amount } });
  } catch (err) {
    console.error('Category stats error:', err);
    res.status(500).json({ error: 'Kategori istatistikleri alınırken hata oluştu.' });
  }
});

export default router;
