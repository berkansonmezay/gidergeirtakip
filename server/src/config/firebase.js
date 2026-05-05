import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable');
  }
} else {
  try {
    const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  } catch (e) {
    console.warn('Could not read serviceAccountKey.json locally. Ensure environment variables are set.');
  }
}

let db;

if (!admin.apps.length && serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
  } catch (err) {
    console.error('Firebase initialization failed:', err);
  }
}

if (!db) {
  console.warn('⚠️ WARNING: Firebase is NOT initialized. Database operations will fail. Please check FIREBASE_SERVICE_ACCOUNT environment variable.');
  // Create a proxy that throws a clear error if the database is used without initialization
  db = new Proxy({}, {
    get: function(target, prop) {
      throw new Error('Firebase Veritabanı bağlantısı kurulamadı. Lütfen Vercel üzerinden FIREBASE_SERVICE_ACCOUNT ortam değişkenini (environment variable) ayarlayın.');
    }
  });
}

export { admin, db };
