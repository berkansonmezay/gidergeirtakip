import { Router } from 'express';
import { db, admin } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';

const router = Router();
router.use(authenticateToken);
router.use(cacheMiddleware(120));
router.use(invalidateCacheMiddleware);

// GET /api/events
router.get('/', async (req, res) => {
  try {
    // 1. Fetch explicit events
    const snapshot = await db.collection('events')
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();
    const explicitEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Fetch installments with reminders enabled
    const instSnapshot = await db.collection('installments')
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .where('reminder_enabled', '==', true)
      .get();
    
    const installmentEvents = [];
    if (!instSnapshot.empty) {
      const instIds = instSnapshot.docs.map(doc => doc.id);
      
      // Fetch categories for installments to get names
      const categoryIds = new Set();
      instSnapshot.docs.forEach(doc => {
        if (doc.data().category_id) categoryIds.add(doc.data().category_id);
      });

      const categories = {};
      if (categoryIds.size > 0) {
        const catSnap = await db.collection('categories')
          .where(admin.firestore.FieldPath.documentId(), 'in', Array.from(categoryIds).slice(0, 30))
          .get();
        catSnap.docs.forEach(d => categories[d.id] = d.data());
      }

      // Fetch unpaid payments for these installments
      const paymentsSnapshot = await db.collection('installment_payments')
        .where('installment_id', 'in', instIds.slice(0, 30))
        .where('is_paid', '==', 0)
        .get();

      paymentsSnapshot.docs.forEach(doc => {
        const pay = doc.data();
        const inst = instSnapshot.docs.find(d => d.id === pay.installment_id).data();
        const cat = categories[inst.category_id];
        
        installmentEvents.push({
          id: `inst-pay-${doc.id}`,
          title: `${cat?.name || inst.description || 'Ödeme'} (${pay.payment_number}. Taksit)`,
          description: `Açıklama: ${inst.description}\nTutar: ${pay.amount} TL`,
          type: 'payment',
          date: pay.due_date,
          time: null,
          recurrence: 'none',
          color: inst.type === 'income' ? '#10b981' : '#ef4444', 
          user_id: req.user.id,
          is_external: true 
        });
      });
    }

    const events = [...explicitEvents, ...installmentEvents];

    // Sort by date and time
    events.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (a.time || '').localeCompare(b.time || '');
    });
    
    res.json({ events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

// POST /api/events
router.post('/', async (req, res) => {
  try {
    const { title, description, type, date, time, recurrence, color } = req.body;
    if (!title || !date || !type) {
      return res.status(400).json({ error: 'Başlık, tarih ve tip zorunludur.' });
    }
    
    const newEvent = {
      title,
      description: description || '',
      type, // task, event, birthday, payment
      date, // YYYY-MM-DD
      time: time || null, // HH:mm
      recurrence: recurrence || 'none', // none, daily, weekly, monthly, yearly
      color: color || '#3b82f6',
      user_id: req.user.id,
      created_at: new Date().toISOString()
    };
    
    const docRef = await db.collection('events').add(newEvent);
    res.status(201).json({ message: 'Etkinlik oluşturuldu.', event: { id: docRef.id, ...newEvent } });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

// PUT /api/events/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, description, type, date, time, recurrence, color } = req.body;
    const docRef = db.collection('events').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    }
    
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (date !== undefined) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (recurrence !== undefined) updates.recurrence = recurrence;
    if (color !== undefined) updates.color = color;
    
    await docRef.update(updates);
    res.json({ message: 'Etkinlik güncellendi.', event: { id: req.params.id, ...doc.data(), ...updates } });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('events').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    }
    
    await docRef.delete();
    res.json({ message: 'Etkinlik silindi.' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

export default router;
