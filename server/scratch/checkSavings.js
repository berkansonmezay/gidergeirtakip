import { db } from '../src/config/firebase.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSavings() {
  try {
    const snapshot = await db.collection('savings_goals').get();
    console.log(`Total savings goals in DB: ${snapshot.size}`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}, Name: ${data.name}, User_ID: ${data.user_id} (Type: ${typeof data.user_id})`);
    });
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
checkSavings();
