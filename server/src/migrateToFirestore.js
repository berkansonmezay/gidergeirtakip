import sqlite3 from 'better-sqlite3';
import { db as firestore } from './config/firebase.js';

const sqliteDb = new sqlite3('./data/family_budget.db');

async function migrateTable(tableName, collectionName) {
  console.log(`Migrating ${tableName}...`);
  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
  
  if (rows.length === 0) {
    console.log(`No records in ${tableName}.`);
    return;
  }

  const batch = firestore.batch();
  let count = 0;

  for (const row of rows) {
    // If table has an 'id' column, use it as the Firestore document ID
    const docId = row.id ? String(row.id) : undefined;
    const docRef = docId ? firestore.collection(collectionName).doc(docId) : firestore.collection(collectionName).doc();
    
    // Clean up nulls
    const cleanedRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (value !== null) cleanedRow[key] = value;
    }

    batch.set(docRef, cleanedRow);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Committed ${count} records for ${tableName}`);
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`Finished migrating ${count} records from ${tableName} to ${collectionName}.`);
}

async function runMigration() {
  try {
    await migrateTable('users', 'users');
    await migrateTable('categories', 'categories');
    await migrateTable('payees', 'payees');
    await migrateTable('transactions', 'transactions');
    await migrateTable('installments', 'installments');
    await migrateTable('installment_payments', 'installment_payments');
    await migrateTable('savings_goals', 'savings_goals');
    await migrateTable('families', 'families');
    await migrateTable('notifications', 'notifications');
    await migrateTable('refresh_tokens', 'refresh_tokens');
    
    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
