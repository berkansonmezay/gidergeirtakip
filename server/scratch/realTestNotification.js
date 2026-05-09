import { db } from '../src/config/firebase.js';

async function findRealRecord() {
  try {
    // 1. Get an admin user (we know the user is using the admin account or a test account)
    const usersSnapshot = await db.collection('users').get();
    let targetUser = null;
    
    // Prioritize berkansonmezay@gmail.com, then any admin, then any user
    targetUser = usersSnapshot.docs.find(d => d.data().email === 'berkansonmezay@gmail.com');
    if (!targetUser) targetUser = usersSnapshot.docs.find(d => d.data().role === 'admin');
    if (!targetUser) targetUser = usersSnapshot.docs[0];

    if (!targetUser) {
      console.log('Veritabanında hiç kullanıcı bulunamadı.');
      process.exit(0);
    }
    
    const user = targetUser.data();
    console.log(`Hedef Kullanıcı: ${user.name} (${user.email}) - ID: ${targetUser.id}`);

    // 2. Find a real installment for this user or ANY user if this user has none
    let instSnapshot = await db.collection('installments').where('user_id', 'in', [targetUser.id, Number(targetUser.id)]).limit(1).get();
    
    if (instSnapshot.empty) {
      console.log('Bu kullanıcının taksidi yok. Sistemdeki herhangi bir taksit aranıyor...');
      instSnapshot = await db.collection('installments').limit(1).get();
    }

    if (instSnapshot.empty) {
      console.log('Sistemde hiç gerçek taksit kaydı yok. Lütfen arayüzden önce bir taksit ekleyin.');
      process.exit(0);
    }

    const installment = instSnapshot.docs[0].data();
    console.log(`Gerçek Taksit Bulundu: ${installment.description} (Toplam: ${installment.total_amount} ₺)`);

    // 3. Find a payment for this installment
    const paySnapshot = await db.collection('installment_payments').where('installment_id', '==', instSnapshot.docs[0].id).limit(1).get();
    
    let paymentAmount = installment.total_amount / (installment.total_installments || 1);
    let dueDate = new Date().toISOString().split('T')[0];
    
    if (!paySnapshot.empty) {
      const pay = paySnapshot.docs[0].data();
      paymentAmount = pay.amount;
      dueDate = pay.due_date;
      console.log(`Gerçek Ödeme Bulundu: Tutar: ${paymentAmount} ₺, Tarih: ${dueDate}`);
    } else {
      console.log(`Ödeme planı bulunamadı. Tahmini ödeme tutarı ile devam ediliyor.`);
    }

    // Now import email script and send
    const { sendInstallmentReminderEmail } = await import('../src/utils/email.js');
    
    console.log(`\n📧 ${user.email} adresine e-posta gönderiliyor...`);
    await sendInstallmentReminderEmail(
      user.email,
      user.name || 'Kullanıcı',
      installment.description,
      paymentAmount,
      dueDate
    );
    
    // Send App Notification
    await db.collection('notifications').add({
      user_id: targetUser.id,
      type: 'installment_reminder',
      title: 'Taksit Ödeme Hatırlatması',
      message: `Yarın (${dueDate}) "${installment.description}" için ${paymentAmount} ₺ ödemeniz bulunmaktadır.`,
      is_read: 0,
      created_at: new Date().toISOString()
    });

    console.log('\n✅ Gerçek kayıtla test e-postası ve bildirimi başarıyla gönderildi.');

  } catch (e) {
    console.error('Hata:', e);
  }
  process.exit(0);
}

findRealRecord();
