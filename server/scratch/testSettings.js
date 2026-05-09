import { db } from '../src/config/firebase.js';
import dotenv from 'dotenv';
dotenv.config();

async function testSettings() {
  try {
    const userId = "F4KY57x0lJYP4rhLTaZy"; // Existing admin ID from listUsers.js
    console.log(`Testing with user ID: ${userId}`);
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
        console.log("User not found");
        return;
    }
    const settings = userDoc.data().notification_settings || {
      email_reminders: true,
      push_notifications: true
    };
    console.log("Settings:", settings);
  } catch (err) {
    console.error("Caught error:", err);
  }
  process.exit(0);
}
testSettings();
