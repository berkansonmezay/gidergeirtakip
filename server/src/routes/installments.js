import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    let queryRef = db.collection('installments').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]);
    
    if (status) queryRef = queryRef.where('status', '==', status);
    if (type) queryRef = queryRef.where('type', '==', type);
    
    const snapshot = await queryRef.get();
    let installments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    installments.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    
    const categoryIds = new Set();
    const payeeIds = new Set();
    installments.forEach(i => {
      if (i.category_id) categoryIds.add(String(i.category_id));
      if (i.payee_id) payeeIds.add(String(i.payee_id));
    });

    const categories = {};
    if (categoryIds.size > 0) {
      const cSnap = await db.collection('categories').where('__name__', 'in', Array.from(categoryIds).slice(0, 30)).get();
      cSnap.docs.forEach(d => categories[d.id] = d.data());
    }

    const payees = {};
    if (payeeIds.size > 0) {
      const pSnap = await db.collection('payees').where('__name__', 'in', Array.from(payeeIds).slice(0, 30)).get();
      pSnap.docs.forEach(d => payees[d.id] = d.data());
    }

    // Load payments for all installments
    if (installments.length > 0) {
      const instIds = installments.map(i => i.id);
      const allPayments = [];
      for (let i = 0; i < instIds.length; i += 30) {
        const chunk = instIds.slice(i, i + 30);
        const paySnap = await db.collection('installment_payments').where('installment_id', 'in', chunk).get();
        paySnap.docs.forEach(d => allPayments.push({ id: d.id, ...d.data() }));
      }

      installments = installments.map(inst => {
        const c = categories[inst.category_id];
        const p = payees[inst.payee_id];
        const payments = allPayments
          .filter(pay => pay.installment_id === inst.id)
          .sort((a, b) => a.payment_number - b.payment_number);
          
        const paid_amount = payments.filter(pay => pay.is_paid === 1).reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);

        return {
          ...inst,
          category_name: c?.name || null,
          category_icon: c?.icon || null,
          payee_name: p?.name || null,
          payments,
          paid_amount
        };
      });
    }
    
    res.json({ installments });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Hata oluştu.' }); 
  }
});

router.get('/payments/all', async (req, res) => {
  try {
    const { type } = req.query;
    
    let queryRef = db.collection('installments').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]);
    if (type) queryRef = queryRef.where('type', '==', type);
    
    const instSnapshot = await queryRef.get();
    const installments = instSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (installments.length === 0) return res.json({ payments: [] });

    const categoryIds = new Set();
    const payeeIds = new Set();
    installments.forEach(i => {
      if (i.category_id) categoryIds.add(String(i.category_id));
      if (i.payee_id) payeeIds.add(String(i.payee_id));
    });

    const categories = {};
    if (categoryIds.size > 0) {
      const cSnap = await db.collection('categories').where('__name__', 'in', Array.from(categoryIds).slice(0, 30)).get();
      cSnap.docs.forEach(d => categories[d.id] = d.data());
    }

    const payees = {};
    if (payeeIds.size > 0) {
      const pSnap = await db.collection('payees').where('__name__', 'in', Array.from(payeeIds).slice(0, 30)).get();
      pSnap.docs.forEach(d => payees[d.id] = d.data());
    }

    const instIds = installments.map(i => i.id);
    const allPayments = [];
    for (let i = 0; i < instIds.length; i += 30) {
      const chunk = instIds.slice(i, i + 30);
      const paySnap = await db.collection('installment_payments').where('installment_id', 'in', chunk).get();
      paySnap.docs.forEach(d => allPayments.push({ id: d.id, ...d.data() }));
    }

    let payments = allPayments.map(p => {
      const inst = installments.find(i => i.id === p.installment_id);
      if (!inst) return null;
      const c = categories[inst.category_id];
      const pay = payees[inst.payee_id];
      
      return {
        ...p,
        description: inst.description,
        installment_count: inst.installment_count,
        transaction_type: inst.type,
        payee_id: inst.payee_id,
        category_id: inst.category_id,
        category_name: c?.name || null,
        category_icon: c?.icon || null,
        payee_name: pay?.name || null
      };
    }).filter(Boolean);

    payments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    res.json({ payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const docRef = db.collection('installments').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    const inst = { id: doc.id, ...doc.data() };
    
    if (inst.category_id) {
      const cDoc = await db.collection('categories').doc(String(inst.category_id)).get();
      if (cDoc.exists) inst.category_name = cDoc.data().name;
    }
    
    const paySnap = await db.collection('installment_payments').where('installment_id', '==', req.params.id).get();
    const payments = paySnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.payment_number - b.payment_number);
    
    res.json({ installment: inst, payments });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.post('/', async (req, res) => {
  try {
    const { description, total_amount, installment_count, start_date, category_id, payee_id, type = 'expense' } = req.body;
    if (!description || !total_amount || !installment_count || !start_date) return res.status(400).json({ error: 'Zorunlu alanlar eksik.' });
    
    const monthly = Math.ceil((Number(total_amount) / Number(installment_count)) * 100) / 100;
    const [sYear, sMonth, sDay] = start_date.split('-');
    const sy = Number(sYear);
    const sm = Number(sMonth) - 1;
    const sdDay = Number(sDay);
    
    const npd = new Date(Date.UTC(sy, sm, sdDay));
    
    const newInst = {
      description,
      total_amount: Number(total_amount),
      installment_count: Number(installment_count),
      paid_count: 0,
      monthly_amount: monthly,
      start_date,
      next_payment_date: npd.toISOString().split('T')[0],
      category_id: category_id ? String(category_id) : null,
      payee_id: payee_id ? String(payee_id) : null,
      user_id: req.user.id,
      type,
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    const docRef = await db.collection('installments').add(newInst);
    const iid = docRef.id;
    
    const batch = db.batch();
    for (let i = 1; i <= Number(installment_count); i++) {
      const d = new Date(Date.UTC(sy, sm + (i - 1), sdDay));
      const pRef = db.collection('installment_payments').doc();
      batch.set(pRef, {
        installment_id: iid,
        payment_number: i,
        amount: monthly,
        due_date: d.toISOString().split('T')[0],
        is_paid: 0,
        paid_date: null
      });
    }
    await batch.commit();
    
    res.status(201).json({ message: 'Taksit oluşturuldu.', installment: { id: iid, ...newInst } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { description, category_id, payee_id, total_amount, installment_count, start_date } = req.body;
    const docRef = db.collection('installments').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    const inst = doc.data();
    const updates = {};
    if (description !== undefined) updates.description = description;
    if (category_id !== undefined) updates.category_id = category_id ? String(category_id) : null;
    if (payee_id !== undefined) updates.payee_id = payee_id ? String(payee_id) : null;

    let recalculatePayments = false;
    let newTotal = inst.total_amount;
    let newCount = inst.installment_count;
    let newStart = inst.start_date;

    if (total_amount !== undefined && Number(total_amount) !== inst.total_amount) { newTotal = Number(total_amount); recalculatePayments = true; }
    if (installment_count !== undefined && Number(installment_count) !== inst.installment_count) { newCount = Number(installment_count); recalculatePayments = true; }
    if (start_date !== undefined && start_date !== inst.start_date) { newStart = start_date; recalculatePayments = true; }

    const batch = db.batch();

    if (recalculatePayments) {
      const paySnap = await db.collection('installment_payments').where('installment_id', '==', req.params.id).get();
      const payments = paySnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.payment_number - b.payment_number);
      
      const paidPayments = payments.filter(p => p.is_paid === 1);
      const paidCount = paidPayments.length;
      
      if (newCount < paidCount) {
        return res.status(400).json({ error: 'Taksit sayısı ödenmiş taksit sayısından az olamaz.' });
      }

      const monthly = Math.ceil((newTotal / newCount) * 100) / 100;
      
      const unpaidPayments = payments.filter(p => p.is_paid === 0);
      unpaidPayments.forEach(p => {
        batch.delete(db.collection('installment_payments').doc(p.id));
      });

      const [nYear, nMonth, nDay] = newStart.split('-');
      const ny = Number(nYear);
      const nm = Number(nMonth) - 1;
      const ndDay = Number(nDay);
      
      for (let i = 1; i <= newCount; i++) {
        const d = new Date(Date.UTC(ny, nm + (i - 1), ndDay));
        const existingPaid = paidPayments.find(p => p.payment_number === i);
        
        if (existingPaid) {
          batch.update(db.collection('installment_payments').doc(existingPaid.id), {
            amount: monthly,
            due_date: d.toISOString().split('T')[0]
          });
          const txSnap = await db.collection('transactions').where('installment_payment_id', '==', existingPaid.id).get();
          txSnap.docs.forEach(txDoc => {
            batch.update(db.collection('transactions').doc(txDoc.id), {
              amount: monthly
            });
          });
        } else {
          const pRef = db.collection('installment_payments').doc();
          batch.set(pRef, {
            installment_id: req.params.id,
            payment_number: i,
            amount: monthly,
            due_date: d.toISOString().split('T')[0],
            is_paid: 0,
            paid_date: null
          });
        }
      }

      updates.total_amount = newTotal;
      updates.installment_count = newCount;
      updates.monthly_amount = monthly;
      updates.start_date = newStart;
      
      const nextD = new Date(Date.UTC(ny, nm + paidCount, ndDay));
      updates.next_payment_date = paidCount < newCount ? nextD.toISOString().split('T')[0] : inst.next_payment_date;
      updates.status = paidCount >= newCount ? 'completed' : 'active';
    }
    
    batch.update(docRef, updates);
    await batch.commit();
    
    res.json({ message: 'Taksit güncellendi.', installment: { id: doc.id, ...doc.data(), ...updates } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/:id/toggle-reminder', async (req, res) => {
  try {
    const docRef = db.collection('installments').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    const current = !!doc.data().reminder_enabled;
    await docRef.update({ reminder_enabled: !current });
    
    res.json({ message: 'Hatırlatıcı durumu güncellendi.', reminder_enabled: !current });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/payments/:paymentId/pay', async (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    const { date } = req.body;
    
    const payRef = db.collection('installment_payments').doc(paymentId);
    const payDoc = await payRef.get();
    if (!payDoc.exists) return res.status(404).json({ error: 'Ödeme bulunamadı.' });
    
    const payment = payDoc.data();
    if (payment.is_paid === 1) return res.status(400).json({ error: 'Zaten ödenmiş.' });

    const payDate = date || new Date().toISOString().split('T')[0];
    await payRef.update({ is_paid: 1, paid_date: payDate });

    // Recalculate parent
    const instId = String(payment.installment_id);
    const instRef = db.collection('installments').doc(instId);
    const instDoc = await instRef.get();
    
    if (instDoc.exists && String(instDoc.data().user_id) === String(req.user.id)) {
      const inst = instDoc.data();
      
      const allPaySnap = await db.collection('installment_payments').where('installment_id', '==', instId).get();
      const allPayments = allPaySnap.docs.map(d => d.data());
      
      const paidCount = allPayments.filter(p => p.is_paid === 1).length;
      const unpaid = allPayments.filter(p => p.is_paid === 0).sort((a, b) => a.payment_number - b.payment_number);
      const nextU = unpaid.length > 0 ? unpaid[0] : null;
      
      const done = paidCount >= inst.installment_count;
      await instRef.update({
        paid_count: paidCount,
        status: done ? 'completed' : 'active',
        next_payment_date: nextU ? nextU.due_date : inst.next_payment_date
      });
      
      // CREATE TRANSACTION FOR DASHBOARD/REPORTS
      await db.collection('transactions').add({
        amount: Number(payment.amount),
        description: inst.description + ` (${payment.payment_number}. Taksit)`,
        date: payDate,
        type: inst.type,
        category_id: inst.category_id || null,
        payee_id: inst.payee_id || null,
        user_id: req.user.id,
        created_at: new Date().toISOString(),
        installment_payment_id: paymentId
      });
    }

    res.json({ message: 'Taksit ödendi.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/payments/:paymentId/unpay', async (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    
    const payRef = db.collection('installment_payments').doc(paymentId);
    const payDoc = await payRef.get();
    if (!payDoc.exists) return res.status(404).json({ error: 'Ödeme bulunamadı.' });
    
    const payment = payDoc.data();
    if (payment.is_paid === 0) return res.status(400).json({ error: 'Zaten ödenmemiş.' });

    await payRef.update({ is_paid: 0, paid_date: null });

    // Recalculate parent
    const instId = String(payment.installment_id);
    const instRef = db.collection('installments').doc(instId);
    const instDoc = await instRef.get();
    
    if (instDoc.exists && String(instDoc.data().user_id) === String(req.user.id)) {
      const inst = instDoc.data();
      
      const allPaySnap = await db.collection('installment_payments').where('installment_id', '==', instId).get();
      const allPayments = allPaySnap.docs.map(d => d.data());
      
      const paidCount = allPayments.filter(p => p.is_paid === 1).length;
      const unpaid = allPayments.filter(p => p.is_paid === 0).sort((a, b) => a.payment_number - b.payment_number);
      const nextU = unpaid.length > 0 ? unpaid[0] : null;
      
      await instRef.update({
        paid_count: paidCount,
        status: 'active',
        next_payment_date: nextU ? nextU.due_date : inst.next_payment_date
      });
      
      // DELETE RELATED TRANSACTION
      const txSnap = await db.collection('transactions').where('installment_payment_id', '==', paymentId).get();
      for (const doc of txSnap.docs) {
        await db.collection('transactions').doc(doc.id).delete();
      }
    }

    res.json({ message: 'Ödeme geri alındı.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('installments').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Bulunamadı.' });
    }
    
    // Delete payments first
    const paySnap = await db.collection('installment_payments').where('installment_id', '==', req.params.id).get();
    const batch = db.batch();
    paySnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    // Delete installment
    await docRef.delete();
    
    res.json({ message: 'Silindi.' });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

export default router;
