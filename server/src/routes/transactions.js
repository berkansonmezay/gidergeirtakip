import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// Helper to fetch referenced docs
async function fetchReferences(categoryIds, payeeIds) {
  const categories = {};
  const payees = {};
  
  if (categoryIds.size > 0) {
    const catsSnapshot = await db.collection('categories').where('__name__', 'in', Array.from(categoryIds).slice(0, 30)).get();
    catsSnapshot.docs.forEach(doc => categories[doc.id] = doc.data());
  }
  
  if (payeeIds.size > 0) {
    const payeesSnapshot = await db.collection('payees').where('__name__', 'in', Array.from(payeeIds).slice(0, 30)).get();
    payeesSnapshot.docs.forEach(doc => payees[doc.id] = doc.data());
  }
  
  return { categories, payees };
}

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { type, category_id, payee_id, start_date, end_date, search, limit = 50, offset = 0 } = req.query;
    
    // 1. Fetch transactions
    let txRef = db.collection('transactions').where('user_id', '==', req.user.id);
    
    if (type) txRef = txRef.where('type', '==', type);
    if (category_id) txRef = txRef.where('category_id', '==', String(category_id));
    if (payee_id) txRef = txRef.where('payee_id', '==', String(payee_id));
    
    const txSnapshot = await txRef.get();
    
    let allRecords = txSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data(), record_type: 'transaction' }))
      .filter(t => {
        if (start_date && t.date < start_date) return false;
        if (end_date && t.date > end_date) return false;
        return true;
      });
    
    // 2. Fetch installments
    let instRef = db.collection('installments').where('user_id', '==', req.user.id);
    if (type) instRef = instRef.where('type', '==', type);
    if (category_id) instRef = instRef.where('category_id', '==', String(category_id));
    if (payee_id) instRef = instRef.where('payee_id', '==', String(payee_id));
    
    const instSnapshot = await instRef.get();
    
    const installments = instSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // We need to fetch installment_payments for these installments
    if (installments.length > 0) {
      const instIds = installments.map(i => i.id);
      
      // Firestore 'in' query supports up to 30 elements. Split into chunks if necessary.
      const instChunks = [];
      for (let i = 0; i < instIds.length; i += 30) {
        instChunks.push(instIds.slice(i, i + 30));
      }
      
      let allPayments = [];
      for (const chunk of instChunks) {
        const paySnapshot = await db.collection('installment_payments')
          .where('installment_id', 'in', chunk)
          .where('is_paid', '==', 1)
          .get();
        paySnapshot.docs.forEach(doc => allPayments.push({ id: doc.id, ...doc.data() }));
      }
      
      // Combine installment data with payments
      for (const payment of allPayments) {
        const parentInst = installments.find(i => i.id === String(payment.installment_id));
        if (!parentInst) continue;
        
        // Date filtering
        if (start_date && payment.paid_date < start_date) continue;
        if (end_date && payment.paid_date > end_date) continue;
        
        allRecords.push({
          id: payment.id,
          amount: payment.amount,
          description: parentInst.description + ' (' + payment.payment_number + '. Taksit)',
          date: payment.paid_date,
          type: parentInst.type,
          category_id: parentInst.category_id,
          payee_id: parentInst.payee_id,
          created_at: parentInst.created_at,
          record_type: 'installment_payment'
        });
      }
    }
    
    // Sort by date DESC, created_at DESC
    allRecords.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    
    // Pagination
    const total = allRecords.length;
    const paginatedRecords = allRecords.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    // Resolve categories and payees
    const categoryIds = new Set();
    const payeeIds = new Set();
    paginatedRecords.forEach(r => {
      if (r.category_id) categoryIds.add(String(r.category_id));
      if (r.payee_id) payeeIds.add(String(r.payee_id));
    });
    
    const { categories, payees } = await fetchReferences(categoryIds, payeeIds);
    
    const transactions = paginatedRecords.map(r => ({
      ...r,
      category_name: categories[r.category_id]?.name || null,
      category_icon: categories[r.category_id]?.icon || null,
      category_color: categories[r.category_id]?.color || null,
      payee_name: payees[r.payee_id]?.name || null
    }));
    
    res.json({ transactions, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    console.error('Transactions list error:', err);
    res.status(500).json({ error: 'İşlemler listelenirken hata oluştu.' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { amount, description, date, type, category_id, payee_id } = req.body;

    if (!amount || !date || !type) {
      return res.status(400).json({ error: 'Tutar, tarih ve tür zorunludur.' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Geçersiz işlem türü.' });
    }

    const newTx = {
      amount: Number(amount),
      description: description || '',
      date,
      type,
      category_id: category_id ? String(category_id) : null,
      payee_id: payee_id ? String(payee_id) : null,
      user_id: req.user.id,
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('transactions').add(newTx);
    
    let category_name = null, category_icon = null, category_color = null, payee_name = null;
    
    if (category_id) {
      const cDoc = await db.collection('categories').doc(String(category_id)).get();
      if (cDoc.exists) {
        const cData = cDoc.data();
        category_name = cData.name;
        category_icon = cData.icon;
        category_color = cData.color;
      }
    }
    
    if (payee_id) {
      const pDoc = await db.collection('payees').doc(String(payee_id)).get();
      if (pDoc.exists) payee_name = pDoc.data().name;
    }

    const transaction = { id: docRef.id, ...newTx, category_name, category_icon, category_color, payee_name };
    res.status(201).json({ message: 'İşlem eklendi.', transaction });
  } catch (err) {
    console.error('Transaction create error:', err);
    res.status(500).json({ error: 'İşlem eklenirken hata oluştu.' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, type, category_id, payee_id } = req.body;

    const docRef = db.collection('transactions').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'İşlem bulunamadı.' });
    }

    const updates = {};
    if (amount !== undefined) updates.amount = Number(amount);
    if (description !== undefined) updates.description = description;
    if (date !== undefined) updates.date = date;
    if (type !== undefined) updates.type = type;
    if (category_id !== undefined) updates.category_id = category_id ? String(category_id) : null;
    if (payee_id !== undefined) updates.payee_id = payee_id ? String(payee_id) : null;

    await docRef.update(updates);
    
    const updatedDoc = await docRef.get();
    const tData = updatedDoc.data();
    
    let category_name = null, category_icon = null, category_color = null, payee_name = null;
    if (tData.category_id) {
      const cDoc = await db.collection('categories').doc(String(tData.category_id)).get();
      if (cDoc.exists) {
        const cData = cDoc.data();
        category_name = cData.name;
        category_icon = cData.icon;
        category_color = cData.color;
      }
    }
    if (tData.payee_id) {
      const pDoc = await db.collection('payees').doc(String(tData.payee_id)).get();
      if (pDoc.exists) payee_name = pDoc.data().name;
    }

    const transaction = { id, ...tData, category_name, category_icon, category_color, payee_name };
    res.json({ message: 'İşlem güncellendi.', transaction });
  } catch (err) {
    console.error('Transaction update error:', err);
    res.status(500).json({ error: 'İşlem güncellenirken hata oluştu.' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('transactions').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'İşlem bulunamadı.' });
    }
    
    await docRef.delete();
    res.json({ message: 'İşlem silindi.' });
  } catch (err) {
    console.error('Transaction delete error:', err);
    res.status(500).json({ error: 'İşlem silinirken hata oluştu.' });
  }
});

// GET /api/transactions/summary
router.get('/summary', async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    const snapshot = await db.collection('transactions')
      .where('user_id', '==', req.user.id)
      .get();
      
    // Remove the strict monthly filter to show all-time totals on the summary cards
    const docs = snapshot.docs;
      
    let totalIncome = 0;
    let totalExpense = 0;
    
    docs.forEach(doc => {
      const data = doc.data();
      if (data.type === 'income') totalIncome += Number(data.amount) || 0;
      if (data.type === 'expense') totalExpense += Number(data.amount) || 0;
    });

    const savingsSnapshot = await db.collection('savings_goals')
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
      .get();
      
    let totalSavings = 0;
    savingsSnapshot.docs.forEach(doc => {
      const g = doc.data();
      if (g.status !== 'deleted') {
        totalSavings += Number(g.current_value || 0);
      }
    });

    res.json({
      month: targetMonth,
      year: targetYear,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      totalSavings
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Özet hesaplanırken hata oluştu.' });
  }
});

export default router;
