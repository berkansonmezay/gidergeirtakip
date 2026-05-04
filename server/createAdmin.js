import bcrypt from 'bcryptjs';
import { db } from './src/config/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  try {
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    
    if (!adminPassword) {
      console.error('❌ Hata: ADMIN_INITIAL_PASSWORD ortam değişkeni (.env) tanımlanmamış!');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
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
    console.log('Şifre: [.env dosyasındaki ADMIN_INITIAL_PASSWORD]');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

createAdmin();
