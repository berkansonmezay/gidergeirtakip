import cron from 'node-cron';
import { db } from '../config/firebase.js';
import { sendInstallmentReminderEmail } from './email.js';

/**
 * Initializes all cron jobs for the application.
 */
export const initializeCronJobs = () => {
  const schedule = process.env.CRON_SCHEDULE_INSTALLMENT_REMINDER || '0 9 * * *';

  cron.schedule(schedule, async () => {
    console.log('⏰ [Cron] Taksit ödeme hatırlatıcı kontrolü başlatılıyor...');
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Fetch unpaid payments due tomorrow
      const paySnapshot = await db.collection('installment_payments')
        .where('due_date', '==', tomorrowStr)
        .where('is_paid', '==', 0)
        .get();

      if (paySnapshot.empty) {
        console.log('ℹ️ [Cron] Yarın için yaklaşan taksit ödemesi bulunamadı.');
        return;
      }

      const paymentsDueTomorrow = [];

      // Manually join with installments and users
      for (const payDoc of paySnapshot.docs) {
        const payment = payDoc.data();
        
        const instRef = db.collection('installments').doc(String(payment.installment_id));
        const instDoc = await instRef.get();
        
        if (!instDoc.exists || instDoc.data().status !== 'active') {
          continue;
        }
        
        const installment = instDoc.data();

        // Check if reminder is enabled for THIS installment
        if (!installment.reminder_enabled) {
          continue;
        }
        
        const userRef = db.collection('users').doc(String(installment.user_id));
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) continue;
        
        const user = userDoc.data();
        
        paymentsDueTomorrow.push({
          payment_id: payDoc.id,
          amount: payment.amount,
          due_date: payment.due_date,
          installment_desc: installment.description,
          user_id: userDoc.id,
          user_name: user.name,
          user_email: user.email,
          user_settings: user.notification_settings || { email_reminders: true, push_notifications: true }
        });
      }

      if (paymentsDueTomorrow.length === 0) {
        console.log('ℹ️ [Cron] Yarın için yaklaşan taksit ödemesi bulunamadı (Tüm taksitler aktif değil).');
        return;
      }

      console.log(`ℹ️ [Cron] Yarın için ${paymentsDueTomorrow.length} adet taksit ödemesi bulundu. Hatırlatıcılar gönderiliyor...`);

      for (const payment of paymentsDueTomorrow) {
        const title = 'Taksit Ödeme Hatırlatması';
        const message = `Yarın (${tomorrowStr}) "${payment.installment_desc}" için ${payment.amount} ₺ ödemeniz bulunmaktadır.`;

        // Send App Notification if enabled
        if (payment.user_settings.push_notifications) {
          await db.collection('notifications').add({
            user_id: payment.user_id,
            type: 'installment_reminder',
            title,
            message,
            is_read: 0,
            created_at: new Date().toISOString()
          });
        }

        // Send Email if enabled
        if (payment.user_settings.email_reminders && payment.user_email) {
          await sendInstallmentReminderEmail(
            payment.user_email,
            payment.user_name,
            payment.installment_desc,
            payment.amount,
            payment.due_date
          );
        } else if (payment.user_settings.email_reminders && !payment.user_email) {
          console.warn(`[Cron] Uyarı: Kullanıcı '${payment.user_name}' için e-posta adresi bulunamadı.`);
        }
      }

      console.log('✅ [Cron] Hatırlatıcı kontrolü tamamlandı.');
    } catch (err) {
      console.error('❌ [Cron] Taksit hatırlatıcı kontrolü sırasında hata:', err);
    }
  });

  console.log(`🕒 Cron job başlatıldı: Taksit hatırlatıcıları ('${schedule}' zamanlamasıyla)`);
};
