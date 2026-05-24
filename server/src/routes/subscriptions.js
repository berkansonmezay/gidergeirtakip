import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET all subscriptions for user
router.get('/', async (req, res) => {
  try {
    const userIdStr = String(req.user.id);
    const userIdNum = Number(req.user.id);
    const idArray = isNaN(userIdNum) ? [userIdStr] : [userIdStr, userIdNum];

    const snapshot = await db.collection('subscriptions')
      .where('user_id', 'in', idArray)
      .get();

    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort active first, then by next_billing_date
    items.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      const dateA = new Date(a.next_billing_date || 0).getTime();
      const dateB = new Date(b.next_billing_date || 0).getTime();
      return dateA - dateB;
    });
    
    res.json({ items });
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Abonelikler yüklenirken hata oluştu.' });
  }
});

// POST new subscription
router.post('/', async (req, res) => {
  try {
    const {
      name, category, amount, currency, billing_cycle,
      next_billing_date, status, reminder_enabled, url, icon, notes
    } = req.body;

    if (!name || amount === undefined) {
      return res.status(400).json({ error: 'İsim ve tutar zorunludur.' });
    }

    const newItem = {
      name: name.trim(),
      category: category || 'diger',
      amount: Number(amount) || 0,
      currency: currency || '₺',
      billing_cycle: billing_cycle || 'monthly',
      next_billing_date: next_billing_date || null,
      status: status || 'active',
      reminder_enabled: reminder_enabled !== undefined ? reminder_enabled : true,
      url: (url || '').trim(),
      icon: icon || '🔄',
      notes: (notes || '').trim(),
      user_id: String(req.user.id),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await db.collection('subscriptions').add(newItem);
    res.status(201).json({ message: 'Abonelik oluşturuldu.', item: { id: docRef.id, ...newItem } });
  } catch (err) {
    console.error('Error creating subscription:', err);
    res.status(500).json({ error: 'Kayıt oluşturulurken hata oluştu.' });
  }
});

// PUT update subscription
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection('subscriptions').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    const existing = doc.data();
    const {
      name, category, amount, currency, billing_cycle,
      next_billing_date, status, reminder_enabled, url, icon, notes
    } = req.body;

    const updates = {
      name: name !== undefined ? name.trim() : existing.name,
      category: category !== undefined ? category : existing.category,
      amount: amount !== undefined ? Number(amount) : existing.amount,
      currency: currency !== undefined ? currency : existing.currency,
      billing_cycle: billing_cycle !== undefined ? billing_cycle : existing.billing_cycle,
      next_billing_date: next_billing_date !== undefined ? next_billing_date : existing.next_billing_date,
      status: status !== undefined ? status : existing.status,
      reminder_enabled: reminder_enabled !== undefined ? reminder_enabled : existing.reminder_enabled,
      url: url !== undefined ? url.trim() : existing.url,
      icon: icon !== undefined ? icon : existing.icon,
      notes: notes !== undefined ? notes.trim() : existing.notes,
      updated_at: new Date().toISOString()
    };

    await docRef.update(updates);
    res.json({ message: 'Abonelik güncellendi.', item: { id: req.params.id, ...existing, ...updates } });
  } catch (err) {
    console.error('Error updating subscription:', err);
    res.status(500).json({ error: 'Güncelleme sırasında hata oluştu.' });
  }
});

// DELETE subscription
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('subscriptions').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    await docRef.delete();
    res.json({ message: 'Abonelik silindi.' });
  } catch (err) {
    console.error('Error deleting subscription:', err);
    res.status(500).json({ error: 'Silme sırasında hata oluştu.' });
  }
});

export default router;
