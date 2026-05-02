import cron from 'node-cron';
import db from '../config/database.js';
import { sendInstallmentReminderEmail } from './email.js';

/**
 * Initializes all cron jobs for the application.
 */
export const initializeCronJobs = () => {
  // Run every day at 09:00 AM
  // Format: second minute hour day-of-month month day-of-week
  // cron.schedule('0 9 * * *', ...)

  // For testing purposes, we can also run it every minute if needed, 
  // but let's stick to the production schedule and provide a way to test.
  
  const schedule = process.env.CRON_SCHEDULE_INSTALLMENT_REMINDER || '0 9 * * *';

  cron.schedule(schedule, async () => {
    console.log('⏰ [Cron] Taksit ödeme hatırlatıcı kontrolü başlatılıyor...');
    
    try {
      // Calculate tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Query database for unpaid installment payments due tomorrow
      const query = `
        SELECT 
          p.id as payment_id,
          p.amount,
          p.due_date,
          i.description as installment_desc,
          u.name as user_name,
          u.email as user_email
        FROM installment_payments p
        JOIN installments i ON p.installment_id = i.id
        JOIN users u ON i.user_id = u.id
        WHERE p.due_date = ? AND p.is_paid = 0 AND i.status = 'active'
      `;

      const paymentsDueTomorrow = db.prepare(query).all(tomorrowStr);

      if (paymentsDueTomorrow.length === 0) {
        console.log('ℹ️ [Cron] Yarın için yaklaşan taksit ödemesi bulunamadı.');
        return;
      }

      console.log(`ℹ️ [Cron] Yarın için ${paymentsDueTomorrow.length} adet taksit ödemesi bulundu. Hatırlatıcılar gönderiliyor...`);

      for (const payment of paymentsDueTomorrow) {
        if (payment.user_email) {
          await sendInstallmentReminderEmail(
            payment.user_email,
            payment.user_name,
            payment.installment_desc,
            payment.amount,
            payment.due_date
          );
        } else {
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
