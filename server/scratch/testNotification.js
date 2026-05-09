import { db } from '../src/config/firebase.js';
import { sendInstallmentReminderEmail } from '../src/utils/email.js';
import dotenv from 'dotenv';
dotenv.config();

async function sendTest() {
  try {
    const usersSnapshot = await db.collection('users').where('email', '==', 'test@admin.com').limit(1).get();
    if (usersSnapshot.empty) {
      console.log('User test@admin.com not found');
      return;
    }
    const adminDoc = usersSnapshot.docs[0];
    const admin = adminDoc.data();
    
    console.log(`Sending to: ${admin.email}`);
    
    // Send Test Email
    await sendInstallmentReminderEmail(
      admin.email,
      admin.name || 'Admin',
      'TEST: Örnek Taksit',
      1500,
      new Date().toISOString()
    );
    
    // Add Notification to DB
    await db.collection('notifications').add({
      user_id: adminDoc.id,
      type: 'installment_reminder',
      title: 'Test Bildirimi',
      message: 'Bu bir test bildirimidir.',
      is_read: 0,
      created_at: new Date().toISOString()
    });
    
    console.log('Test messages sent successfully.');
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

sendTest();
