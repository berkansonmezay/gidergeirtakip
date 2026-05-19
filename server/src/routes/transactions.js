import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import exceljs from 'exceljs';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

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
    let txRef = db.collection('transactions').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]);
    
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
    let instRef = db.collection('installments').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]);
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
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
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
    
    if (!doc.exists || String(doc.data().user_id) !== String(req.user.id)) {
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
      .where('user_id', 'in', [String(req.user.id), Number(req.user.id)])
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

// GET /api/transactions/template
router.get('/template', async (req, res) => {
  try {
    const catsSnapshot = await db.collection('categories').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]).get();
    const categories = catsSnapshot.docs.map(doc => doc.data());
    categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const payeesSnapshot = await db.collection('payees').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]).get();
    const payees = payeesSnapshot.docs.map(doc => doc.data());
    payees.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const workbook = new exceljs.Workbook();
    workbook.creator = 'Aile Bütçesi';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Gelir-Gider Ekleme');
    const listWs = workbook.addWorksheet('Sistem Verileri');
    listWs.state = 'hidden';

    const categoryOptions = categories.map(c => `${c.icon || '📁'} ${c.name}`);
    categoryOptions.forEach((cat, index) => {
      listWs.getCell(`A${index + 1}`).value = cat;
    });

    const payeeOptions = payees.map(p => p.name);
    payeeOptions.forEach((payee, index) => {
      listWs.getCell(`B${index + 1}`).value = payee;
    });

    const types = ['Gelir', 'Gider'];
    types.forEach((type, index) => {
      listWs.getCell(`C${index + 1}`).value = type;
    });

    ws.columns = [
      { header: 'Tarih (GG.AA.YYYY)', key: 'date', width: 22 },
      { header: 'Tür (Gelir/Gider)', key: 'type', width: 18 },
      { header: 'Harcama Yeri', key: 'payee', width: 25 },
      { header: 'Kategori', key: 'category', width: 25 },
      { header: 'Tutar (₺)', key: 'amount', width: 15 },
      { header: 'Açıklama', key: 'description', width: 35 },
      { header: 'Taksit Sayısı (İsteğe Bağlı)', key: 'installmentCount', width: 25 }
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' }
      };
      cell.font = {
        name: 'Arial', color: { argb: 'FFFFFFFF' }, bold: true, size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const categoryCount = categoryOptions.length;
    const payeeCount = payeeOptions.length;

    for (let i = 2; i <= 200; i++) {
      ws.getCell(`A${i}`).numFmt = 'dd.mm.yyyy';

      ws.getCell(`B${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'Sistem Verileri'!$C$1:$C$2`],
        showErrorMessage: true,
        errorTitle: 'Geçersiz İşlem Türü',
        error: 'Lütfen sadece listeden "Gelir" veya "Gider" seçin.'
      };

      if (payeeCount > 0) {
        ws.getCell(`C${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'Sistem Verileri'!$B$1:$B$${payeeCount}`],
          showErrorMessage: true,
          errorTitle: 'Geçersiz Harcama Yeri',
          error: 'Lütfen listeden bir harcama yeri seçin.'
        };
      }

      if (categoryCount > 0) {
        ws.getCell(`D${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'Sistem Verileri'!$A$1:$A$${categoryCount}`],
          showErrorMessage: true,
          errorTitle: 'Geçersiz Kategori',
          error: 'Lütfen listeden bir kategori seçin.'
        };
      }

      ws.getCell(`E${i}`).dataValidation = {
        type: 'decimal',
        operator: 'greaterThan',
        formulae: ['0'],
        showErrorMessage: true,
        errorTitle: 'Geçersiz Tutar',
        error: 'Tutar 0\'dan büyük bir sayı olmalıdır.'
      };

      ws.getCell(`G${i}`).dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        formulae: ['1'],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Geçersiz Taksit Sayısı',
        error: 'Taksit sayısı boş bırakılabilir veya 1\'den büyük bir tam sayı olmalıdır.'
      };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gelir_gider_sablonu.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Template generation error:', err);
    res.status(500).json({ error: 'Şablon oluşturulurken hata oluştu.' });
  }
});

// POST /api/transactions/import
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Lütfen bir Excel dosyası yükleyin.' });
    }

    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const ws = workbook.getWorksheet('Gelir-Gider Ekleme') || workbook.worksheets[0];
    if (!ws) {
      return res.status(400).json({ error: 'Geçersiz şablon yapısı.' });
    }

    const catsSnapshot = await db.collection('categories').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]).get();
    const categories = catsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const payeesSnapshot = await db.collection('payees').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]).get();
    const payees = payeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const categoryMap = {};
    categories.forEach(c => {
      const formattedKey = `${c.icon || '📁'} ${c.name}`.toLowerCase().trim();
      const standardKey = c.name.toLowerCase().trim();
      categoryMap[formattedKey] = c;
      categoryMap[standardKey] = c;
    });

    const payeeMap = {};
    payees.forEach(p => {
      payeeMap[p.name.toLowerCase().trim()] = p;
    });

    const transactionsToInsert = [];
    const errors = [];
    const newPayeesToCreate = new Set();

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const dateVal = row.getCell(1).value;
      const typeVal = row.getCell(2).value;
      const payeeVal = row.getCell(3).value;
      const categoryVal = row.getCell(4).value;
      const amountVal = row.getCell(5).value;
      const descVal = row.getCell(6).value;
      const instVal = row.getCell(7).value;

      if (!dateVal && !typeVal && !payeeVal && !categoryVal && !amountVal && !descVal && !instVal) {
        return;
      }

      let dateString = '';
      if (dateVal instanceof Date) {
        const year = dateVal.getFullYear();
        const month = String(dateVal.getMonth() + 1).padStart(2, '0');
        const day = String(dateVal.getDate()).padStart(2, '0');
        dateString = `${year}-${month}-${day}`;
      } else if (typeof dateVal === 'string') {
        const cleaned = dateVal.trim();
        const match = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (match) {
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          dateString = `${year}-${month}-${day}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
          dateString = cleaned;
        } else {
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateString = `${year}-${month}-${day}`;
          }
        }
      }

      if (!dateString) {
        errors.push(`Satır ${rowNumber}: Geçersiz tarih formatı (Beklenen: GG.AA.YYYY).`);
        return;
      }

      let type = '';
      if (typeof typeVal === 'string') {
        const cleaned = typeVal.trim().toLowerCase();
        if (cleaned === 'gelir') type = 'income';
        if (cleaned === 'gider') type = 'expense';
      }
      if (!type) {
        errors.push(`Satır ${rowNumber}: Geçersiz işlem türü (Beklenen: Gelir / Gider).`);
        return;
      }

      let amount = 0;
      if (typeof amountVal === 'number') {
        amount = amountVal;
      } else if (typeof amountVal === 'string') {
        amount = parseFloat(amountVal.replace(',', '.'));
      } else if (amountVal && typeof amountVal === 'object' && amountVal.result !== undefined) {
        amount = Number(amountVal.result);
      }
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Satır ${rowNumber}: Tutar 0'dan büyük bir sayı olmalıdır.`);
        return;
      }

      let payeeName = payeeVal ? String(payeeVal).trim() : '';
      if (payeeName) {
        newPayeesToCreate.add(payeeName);
      }

      let categoryId = null;
      let categoryName = categoryVal ? String(categoryVal).trim() : '';
      if (categoryName) {
        const matchedCat = categoryMap[categoryName.toLowerCase()];
        if (matchedCat) {
          if (matchedCat.type !== type) {
            errors.push(`Satır ${rowNumber}: Seçilen kategori ("${categoryName}") işlem türü (${type === 'income' ? 'Gelir' : 'Gider'}) ile uyuşmuyor.`);
            return;
          }
          categoryId = matchedCat.id;
        } else {
          errors.push(`Satır ${rowNumber}: Tanımsız kategori ("${categoryName}").`);
          return;
        }
      }

      const description = descVal ? String(descVal).trim() : '';

      let installmentCount = 1;
      if (instVal !== undefined && instVal !== null) {
        if (typeof instVal === 'number') {
          installmentCount = Math.round(instVal);
        } else if (typeof instVal === 'string' && instVal.trim() !== '') {
          const parsed = parseInt(instVal.trim(), 10);
          if (!isNaN(parsed)) {
            installmentCount = parsed;
          } else {
            errors.push(`Satır ${rowNumber}: Taksit sayısı geçerli bir tam sayı olmalıdır.`);
            return;
          }
        } else if (instVal && typeof instVal === 'object' && instVal.result !== undefined) {
          installmentCount = Math.round(Number(instVal.result));
        }
      }
      if (installmentCount < 1) {
        errors.push(`Satır ${rowNumber}: Taksit sayısı en az 1 olmalıdır.`);
        return;
      }

      transactionsToInsert.push({
        rowNumber,
        date: dateString,
        type,
        payeeName,
        category_id: categoryId,
        amount,
        description,
        installmentCount
      });
    });

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Excel dosyasında doğrulama hataları var.', details: errors });
    }

    if (transactionsToInsert.length === 0) {
      return res.status(400).json({ error: 'Yüklenecek işlem bulunamadı. Lütfen şablonu doldurun.' });
    }

    const finalPayeeMap = { ...payeeMap };
    for (const name of newPayeesToCreate) {
      const key = name.toLowerCase();
      if (!finalPayeeMap[key]) {
        const newPayee = {
          name,
          user_id: req.user.id,
          created_at: new Date().toISOString()
        };
        const pDoc = await db.collection('payees').add(newPayee);
        finalPayeeMap[key] = { id: pDoc.id, ...newPayee };
      }
    }

    let batch = db.batch();
    let batchCount = 0;

    for (const tx of transactionsToInsert) {
      const payeeId = tx.payeeName ? finalPayeeMap[tx.payeeName.toLowerCase()].id : null;

      if (tx.installmentCount > 1) {
        const instRef = db.collection('installments').doc();
        const iid = instRef.id;

        const monthly = Math.ceil((tx.amount / tx.installmentCount) * 100) / 100;
        const [sYear, sMonth, sDay] = tx.date.split('-');
        const sy = Number(sYear);
        const sm = Number(sMonth) - 1;
        const sdDay = Number(sDay);

        const npd = new Date(Date.UTC(sy, sm, sdDay));

        const newInst = {
          description: tx.description,
          total_amount: tx.amount,
          installment_count: tx.installmentCount,
          paid_count: 0,
          monthly_amount: monthly,
          start_date: tx.date,
          next_payment_date: npd.toISOString().split('T')[0],
          category_id: tx.category_id,
          payee_id: payeeId,
          user_id: req.user.id,
          type: tx.type,
          status: 'active',
          created_at: new Date().toISOString()
        };

        batch.set(instRef, newInst);
        batchCount++;

        for (let i = 1; i <= tx.installmentCount; i++) {
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
          batchCount++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      } else {
        const txRef = db.collection('transactions').doc();
        batch.set(txRef, {
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          type: tx.type,
          category_id: tx.category_id,
          payee_id: payeeId,
          user_id: req.user.id,
          created_at: new Date().toISOString()
        });
        batchCount++;
      }

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    res.status(201).json({
      message: 'İşlemler başarıyla içe aktarıldı.',
      count: transactionsToInsert.length
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'İşlemler aktarılırken bir hata oluştu: ' + err.message });
  }
});

export default router;
