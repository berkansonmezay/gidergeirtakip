import { db } from '../src/config/firebase.js';
import jwt from 'jsonwebtoken';
import exceljs from 'exceljs';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-only';

async function runTest() {
  console.log('--- EXCEL TAKSİTLİ İŞLEM ENTEGRASYON TESTİ ---');

  // 1. JWT oluştur (id'yi sayısal 1 olarak veriyoruz)
  const token = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  console.log('Test JWT Token oluşturuldu.');

  // 2. Bir gider kategorisi bul (user_id'yi sayısal 1 ve type'ı expense olarak sorguluyoruz)
  const catsSnap = await db.collection('categories')
    .where('user_id', '==', 1)
    .where('type', '==', 'expense')
    .limit(1)
    .get();
    
  if (catsSnap.empty) {
    console.error('Gider kategorisi bulunamadı. Lütfen sisteme en az bir gider kategorisi ekleyin.');
    process.exit(1);
  }
  const catDoc = catsSnap.docs[0];
  const catData = catDoc.data();
  const categoryName = `${catData.icon || '📁'} ${catData.name}`;
  console.log(`Kullanılacak Gider Kategorisi: ${categoryName}`);

  // 3. Excel oluştur
  const workbook = new exceljs.Workbook();
  const ws = workbook.addWorksheet('Gelir-Gider Ekleme');
  ws.columns = [
    { header: 'Tarih (GG.AA.YYYY)', key: 'date', width: 22 },
    { header: 'Tür (Gelir/Gider)', key: 'type', width: 18 },
    { header: 'Harcama Yeri', key: 'payee', width: 25 },
    { header: 'Kategori', key: 'category', width: 25 },
    { header: 'Tutar (₺)', key: 'amount', width: 15 },
    { header: 'Açıklama', key: 'description', width: 35 },
    { header: 'Taksit Sayısı (İsteğe Bağlı)', key: 'installmentCount', width: 25 }
  ];

  // Standart gider - GG.AA.YYYY formatında tarih
  ws.addRow({
    date: '20.05.2026',
    type: 'Gider',
    payee: 'Excel Test Harcama Standart',
    category: categoryName,
    amount: 150.50,
    description: 'Excel Standart Açıklama',
    installmentCount: 1
  });

  // Taksitli gider (3 Taksit) - GG.AA.YYYY formatında tarih
  ws.addRow({
    date: '21.05.2026',
    type: 'Gider',
    payee: 'Excel Test Harcama Taksitli',
    category: categoryName,
    amount: 3000.00,
    description: 'Excel Taksitli Açıklama',
    installmentCount: 3
  });

  const buffer = await workbook.xlsx.writeBuffer();
  console.log('Excel şablonu hafızada oluşturuldu.');

  // 4. API'ye post et
  const formData = new FormData();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  formData.append('file', fileBlob, 'test_import.xlsx');

  console.log('Import API çağrılıyor...');
  const response = await fetch('http://localhost:3001/api/transactions/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const resJson = await response.json();
  console.log('API Yanıt Durumu:', response.status);
  console.log('API Yanıtı:', resJson);

  if (response.status !== 201) {
    console.error('Test başarısız! Yanıt kodu 201 değil.');
    process.exit(1);
  }

  // 5. Veritabanını sorgula ve doğrula
  console.log('Veritabanı doğrulaması yapılıyor...');

  // Standart işlemi kontrol et (Tarih veritabanında YYYY-MM-DD olarak saklanmalıdır)
  const txSnap = await db.collection('transactions')
    .where('user_id', '==', 1)
    .where('date', '==', '2026-05-20')
    .where('description', '==', 'Excel Standart Açıklama')
    .get();

  if (txSnap.empty) {
    console.error('Hata: Standart işlem veritabanında bulunamadı veya tarihi hatalı kaydedilmiş!');
    process.exit(1);
  }
  console.log('✅ Standart işlem başarıyla kaydedilmiş.');
  const testTxDoc = txSnap.docs[0];

  // Taksitli işlemi kontrol et
  const instSnap = await db.collection('installments')
    .where('user_id', '==', 1)
    .where('start_date', '==', '2026-05-21')
    .where('description', '==', 'Excel Taksitli Açıklama')
    .get();

  if (instSnap.empty) {
    console.error('Hata: Taksitli ana işlem (installment) veritabanında bulunamadı veya başlangıç tarihi hatalı!');
    process.exit(1);
  }
  const instDoc = instSnap.docs[0];
  const instData = instDoc.data();
  console.log(`✅ Taksitli ana işlem bulundu. Başlangıç Tarihi: ${instData.start_date}, Taksit Sayısı: ${instData.installment_count}, Toplam Tutar: ${instData.total_amount}`);

  if (instData.installment_count !== 3 || instData.total_amount !== 3000.00) {
    console.error('Hata: Taksit sayısı veya tutarı hatalı!');
    process.exit(1);
  }

  // Taksit ödemelerini kontrol et
  const paymentsSnap = await db.collection('installment_payments')
    .where('installment_id', '==', instDoc.id)
    .get();

  console.log(`✅ Taksit ödemeleri sayısı: ${paymentsSnap.size}`);
  if (paymentsSnap.size !== 3) {
    console.error('Hata: Ödemelerin sayısı 3 olmalıdır!');
    process.exit(1);
  }

  // Tarih sıralı alalım ve ilk taksit tarihini doğrulayalım
  const sortedPayments = paymentsSnap.docs.map(d => d.data()).sort((a, b) => a.payment_number - b.payment_number);
  console.log('1. Taksit Vadesi:', sortedPayments[0].due_date);
  console.log('2. Taksit Vadesi:', sortedPayments[1].due_date);
  console.log('3. Taksit Vadesi:', sortedPayments[2].due_date);

  if (sortedPayments[0].due_date !== '2026-05-21') {
    console.error('Hata: İlk taksit vadesi başlangıç tarihi ile eşleşmeli!');
    process.exit(1);
  }

  let paymentSum = 0;
  paymentsSnap.forEach(pDoc => {
    paymentSum += pDoc.data().amount;
  });

  console.log(`Taksit Ödemeleri Toplamı: ${paymentSum} TL`);
  if (paymentSum !== 3000.00) {
    console.error('Hata: Taksit ödeme tutarlarının toplamı 3000 TL etmiyor!');
    process.exit(1);
  }
  console.log('✅ Taksit ödemeleri başarıyla doğrulanmıştır.');

  // 6. Temizlik
  console.log('Test verileri temizleniyor...');
  await db.collection('transactions').doc(testTxDoc.id).delete();
  await db.collection('installments').doc(instDoc.id).delete();
  const cleanBatch = db.batch();
  paymentsSnap.forEach(pDoc => {
    cleanBatch.delete(pDoc.ref);
  });
  // Temizlenen harcama yerlerini bul ve sil
  const payeesSnap = await db.collection('payees')
    .where('user_id', '==', 1)
    .get();
  payeesSnap.forEach(pDoc => {
    const name = pDoc.data().name;
    if (name === 'Excel Test Harcama Standart' || name === 'Excel Test Harcama Taksitli') {
      cleanBatch.delete(pDoc.ref);
    }
  });

  await cleanBatch.commit();
  console.log('✅ Temizlik tamamlandı.');
  console.log('🎉 Taksitli Excel İçe Aktarma Entegrasyon Testi (GG.AA.YYYY Tarih Formatı ile) BAŞARIYLA TAMAMLANDI!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test sırasında beklenmedik hata:', err);
  process.exit(1);
});
