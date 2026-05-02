import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/payees
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('payees')
      .where('user_id', '==', req.user.id)
      .get();
      
    const payees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    payees.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    res.json({ payees });
  } catch (err) {
    console.error('Payees list error:', err);
    res.status(500).json({ error: 'Ödeme yerleri listelenirken hata oluştu.' });
  }
});

// POST /api/payees
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'İsim zorunludur.' });

    const newPayee = {
      name,
      user_id: req.user.id,
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('payees').add(newPayee);
    res.status(201).json({ payee: { id: docRef.id, ...newPayee } });
  } catch (err) {
    console.error('Payee create error:', err);
    res.status(500).json({ error: 'Ödeme yeri oluşturulurken hata oluştu.' });
  }
});

// PUT /api/payees/:id
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const docRef = db.collection('payees').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    await docRef.update({ name });
    res.json({ message: 'Güncellendi.' });
  } catch (err) {
    console.error('Payee update error:', err);
    res.status(500).json({ error: 'Güncellenirken hata oluştu.' });
  }
});

// DELETE /api/payees/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('payees').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    await docRef.delete();
    res.json({ message: 'Silindi.' });
  } catch (err) {
    console.error('Payee delete error:', err);
    res.status(500).json({ error: 'Silinirken hata oluştu.' });
  }
});

export default router;
