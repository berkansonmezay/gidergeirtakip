import bcrypt from 'bcryptjs';
import { db } from './src/config/firebase.js';

async function createAdmin() {
  try {
    const passwordHash = await bcrypt.hash('123', 12);
    const userRef = db.collection('users').doc();
    
    await userRef.set({
      username: 'admin',
      email: 'admin@bce.com',
      password_hash: passwordHash,
      name: 'Yönetici',
      role: 'admin',
      created_at: new Date().toISOString()
    });

    console.log('✅ Admin kullanıcısı başarıyla oluşturuldu!');
    console.log('Kullanıcı adı: admin');
    console.log('Şifre: 123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

createAdmin();
