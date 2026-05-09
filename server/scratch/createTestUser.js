import bcrypt from 'bcryptjs';
import { db } from '../src/config/firebase.js';
import dotenv from 'dotenv';
dotenv.config();

async function createTestUser() {
  const passwordHash = await bcrypt.hash('Admin123!', 12);
  const userRef = db.collection('users').doc();
  await userRef.set({
    username: 'testadmin',
    email: 'test@admin.com',
    password_hash: passwordHash,
    name: 'Test Admin',
    role: 'admin',
    created_at: new Date().toISOString()
  });
  console.log('Test user created: test@admin.com / Admin123!');
  process.exit(0);
}
createTestUser();
