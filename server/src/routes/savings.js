import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    console.log('Fetching goals for user:', req.user.id);
    const snapshot = await db.collection('savings_goals')
      .where('user_id', '==', String(req.user.id))
      .get();
      
    const goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Found ${goals.length} goals.`);
    goals.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    res.json({ goals });
  } catch (err) { 
    console.error('Error fetching goals:', err);
    res.status(500).json({ error: 'Hata oluştu.' }); 
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, target_amount, deadline, icon, currency, metric } = req.body;
    if (!name) return res.status(400).json({ error: 'Ad zorunludur.' });
    
    const newGoal = {
      name,
      target_amount: target_amount ? Number(target_amount) : 0,
      current_amount: 0,
      icon: icon || '🎯',
      currency: currency || '₺',
      metric: metric || '',
      deadline: deadline || null,
      user_id: String(req.user.id),
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
    
    if (!doc.exists || doc.data().user_id !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    const g = doc.data();
    const { name, icon, target_amount, current_amount, current_value, deadline, add_amount, add_unit_price, type = 'in', currency, metric } = req.body;
    
    const transAmount = Number(add_amount || 0);
    const transUnitPrice = Number(add_unit_price || 0);
    let transValue = 0;
    
    if (transAmount > 0 && transUnitPrice > 0) {
      transValue = transAmount * transUnitPrice;
    } else if (transAmount > 0 && transUnitPrice === 0 && (!g.metric || g.metric === '')) {
      transValue = transAmount;
    } else if (transAmount === 0 && transUnitPrice > 0) {
      transValue = transUnitPrice;
    }

    let newCurrentAmount = Number(g.current_amount || 0);
    let newCurrentValue = Number(g.current_value || 0);

    if (add_amount || add_unit_price) {
      const isOut = String(type).toLowerCase() === 'out';
      if (isOut) {
        newCurrentAmount -= transAmount;
        newCurrentValue -= transValue;
      } else {
        newCurrentAmount += transAmount;
        newCurrentValue += transValue;
      }
    } else {
      if (current_amount !== undefined) newCurrentAmount = Number(current_amount);
      if (current_value !== undefined) newCurrentValue = Number(current_value);
    }
    
    const newTarget = Number(target_amount || g.target_amount || 0);
    const isComplete = newCurrentAmount >= newTarget && newTarget > 0;
    
    const updates = {
      name: name || g.name,
      icon: icon !== undefined ? icon : g.icon,
      target_amount: newTarget,
      current_amount: newCurrentAmount,
      current_value: newCurrentValue,
      currency: currency !== undefined ? currency : (g.currency || '₺'),
      metric: metric !== undefined ? metric : (g.metric || ''),
      deadline: deadline !== undefined ? deadline : g.deadline,
      status: isComplete ? 'completed' : 'active'
    };
    
    await docRef.update(updates);
    
    if (add_amount || add_unit_price) {
      const { date } = req.body;
      await docRef.collection('history').add({
        type: String(type).toLowerCase() === 'out' ? 'out' : 'in',
        amount: transAmount,
        unit_price: transUnitPrice,
        value: transValue,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        currency: updates.currency,
        metric: updates.metric
      });
    }
    
    res.json({ message: 'Hedef güncellendi.', goal: { id: req.params.id, ...g, ...updates } });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.get('/:id/history', async (req, res) => {
  try {
    const docRef = db.collection('savings_goals').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    const snapshot = await docRef.collection('history').orderBy('date', 'desc').get();
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ history });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('savings_goals').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== String(req.user.id)) return res.status(404).json({ error: 'Bulunamadı.' });
    await docRef.delete();
    res.json({ message: 'Silindi.' });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.delete('/:id/history/:historyId', async (req, res) => {
  try {
    const goalRef = db.collection('savings_goals').doc(req.params.id);
    const goalDoc = await goalRef.get();
    
    if (!goalDoc.exists || goalDoc.data().user_id !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    const historyRef = goalRef.collection('history').doc(req.params.historyId);
    const historyDoc = await historyRef.get();
    
    if (!historyDoc.exists) {
      return res.status(404).json({ error: 'İşlem bulunamadı.' });
    }
    
    const h = historyDoc.data();
    const g = goalDoc.data();
    const isOut = h.type === 'out';
    
    // Revert the transaction
    let newAmount = Number(g.current_amount || 0);
    let newValue = Number(g.current_value || 0);
    
    if (isOut) {
      newAmount += Number(h.amount || 0);
      newValue += Number(h.value || 0);
    } else {
      newAmount -= Number(h.amount || 0);
      newValue -= Number(h.value || 0);
    }
    
    await db.runTransaction(async (transaction) => {
      transaction.update(goalRef, {
        current_amount: newAmount,
        current_value: newValue
      });
      transaction.delete(historyRef);
    });
    
    res.json({ message: 'İşlem silindi.', newAmount, newValue });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

export default router;
