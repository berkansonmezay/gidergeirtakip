import nodemailer from 'nodemailer';

// Create a reusable transporter object using the default SMTP transport
const createTransporter = async () => {
  // If SMTP is not configured, we can use ethereal email for testing
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('⚠️ SMTP ayarları eksik. Test amaçlı Ethereal Email hesabı oluşturuluyor...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('✅ Ethereal Test Hesabı oluşturuldu:', testAccount.user);
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
    } catch (err) {
      console.error('❌ Ethereal Email hesabı oluşturulamadı:', err);
      // Fallback to a dummy transporter that just logs
      return {
        sendMail: async (info) => {
          console.log('\n================ DUMMY EMAIL ================');
          console.log('To:', info.to);
          console.log('Subject:', info.subject);
          console.log('Text:', info.text);
          console.log('============================================\n');
          return { messageId: 'dummy-id' };
        }
      };
    }
  }

  // Use configured SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

let transporterInstance = null;

const getTransporter = async () => {
  if (!transporterInstance) {
    transporterInstance = await createTransporter();
  }
  return transporterInstance;
};

/**
 * Sends a reminder email for an upcoming installment payment.
 * @param {string} toEmail - User's email address
 * @param {string} userName - User's name
 * @param {string} installmentDesc - Description of the installment
 * @param {number} amount - Amount to be paid
 * @param {string} dueDate - Due date in string format (YYYY-MM-DD)
 */
export const sendInstallmentReminderEmail = async (toEmail, userName, installmentDesc, amount, dueDate) => {
  if (!toEmail) {
    console.warn(`[Email] Kullanıcının e-posta adresi olmadığı için '${installmentDesc}' hatırlatıcısı gönderilemedi.`);
    return;
  }

  const transporter = await getTransporter();
  
  // Format the date (e.g., from 2024-05-03 to 03.05.2024)
  let formattedDate = dueDate;
  try {
    const d = new Date(dueDate);
    formattedDate = d.toLocaleDateString('tr-TR');
  } catch (e) {
    // keep original string if parsing fails
  }

  // Format amount
  const formattedAmount = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Aile Bütçesi" <noreply@ailebutcesi.local>',
    to: toEmail,
    subject: `Hatırlatma: Yarın "${installmentDesc}" taksit ödemeniz var`,
    text: `Merhaba ${userName},\n\nYarın (${formattedDate}) tarihinde "${installmentDesc}" için ${formattedAmount} tutarında taksit ödemeniz bulunmaktadır.\n\nİyi günler dileriz.\nAile Bütçesi Uygulaması`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #6366f1; padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0;">Ödeme Hatırlatması</h2>
        </div>
        <div style="padding: 20px;">
          <p style="font-size: 16px;">Merhaba <strong>${userName}</strong>,</p>
          <p style="font-size: 16px;">Yarın (<strong>${formattedDate}</strong>) tarihinde yapmanız gereken bir taksit ödemeniz bulunmaktadır.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Açıklama:</strong> ${installmentDesc}</p>
            <p style="margin: 5px 0;"><strong>Tutar:</strong> <span style="color: #ef4444; font-weight: bold; font-size: 18px;">${formattedAmount}</span></p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 30px;">
            Ödemenizi yaptıktan sonra uygulamaya girerek "Ödendi" olarak işaretlemeyi unutmayınız.
          </p>
        </div>
        <div style="background-color: #f9fafb; padding: 10px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
          Bu e-posta Aile Bütçesi uygulaması tarafından otomatik olarak gönderilmiştir.
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Hatırlatıcı e-postası gönderildi: ${toEmail} (${installmentDesc})`);
    
    // For Ethereal, log the preview URL
    if (info.messageId && info.messageId !== 'dummy-id' && (!process.env.SMTP_HOST || !process.env.SMTP_USER)) {
      console.log(`👀 E-postayı görüntüle: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    console.error(`❌ E-posta gönderim hatası (${toEmail}):`, error);
  }
};
