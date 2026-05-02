import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('savings_goals')
      .where('user_id', '==', req.user.id)
      .get();
      
    const goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    goals.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    res.json({ goals });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, target_amount, deadline } = req.body;
    if (!name || !target_amount) return res.status(400).json({ error: 'Ad ve hedef tutar zorunludur.' });
    
    const newGoal = {
      name,
      target_amount: Number(target_amount),
      current_amount: 0,
      deadline: deadline || null,
      user_id: req.user.id,
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    const docRef = await db.collection('savings_goals').add(newGoal);
    res.status(201).json({ message: 'Hedef oluşturuldu.', goal: { id: docRef.id, ...newGoal } });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection('savings_goals').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    const g = doc.data();
    const { name, target_amount, current_amount, deadline, add_amount } = req.body;
    
    const newCurrent = add_amount ? g.current_amount + Number(add_amount) : (current_amount !== undefined ? Number(current_amount) : g.current_amount);
    const newTarget = target_amount ? Number(target_amount) : g.target_amount;
    const isComplete = newCurrent >= newTarget;
    
    const updates = {
      name: name || g.name,
      target_amount: newTarget,
      current_amount: newCurrent,
      deadline: deadline !== undefined ? deadline : g.deadline,
      status: isComplete ? 'completed' : 'active'
    };
    
    await docRef.update(updates);
    res.json({ message: 'Hedef güncellendi.', goal: { id: req.params.id, ...g, ...updates } });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('savings_goals').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    await docRef.delete();
    res.json({ message: 'Silindi.' });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

export default router;
