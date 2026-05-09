import { db } from '../src/config/firebase.js';
import dotenv from 'dotenv';
dotenv.config();

async function listUsers() {
  const snapshot = await db.collection('users').get();
  snapshot.docs.forEach(doc => {
    console.log(`ID: ${doc.id}, Email: ${doc.data().email}, Role: ${doc.data().role}`);
  });
  process.exit(0);
}
listUsers();
