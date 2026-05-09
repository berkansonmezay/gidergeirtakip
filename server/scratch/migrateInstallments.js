import { db } from '../src/config/firebase.js';

async function migrate() {
  try {
    const paySnap = await db.collection('installment_payments').where('is_paid', '==', 1).get();
    let migrated = 0;
    
    for (const doc of paySnap.docs) {
      const payment = doc.data();
      const paymentId = doc.id;
      
      const txSnap = await db.collection('transactions').where('installment_payment_id', '==', paymentId).get();
      
      if (txSnap.empty) {
        const instRef = db.collection('installments').doc(String(payment.installment_id));
        const instDoc = await instRef.get();
        
        if (instDoc.exists) {
          const inst = instDoc.data();
          await db.collection('transactions').add({
            amount: Number(payment.amount),
            description: inst.description + ` (${payment.payment_number}. Taksit)`,
            date: payment.paid_date || payment.due_date,
            type: inst.type,
            category_id: inst.category_id || null,
            payee_id: inst.payee_id || null,
            user_id: inst.user_id,
            created_at: new Date().toISOString(),
            installment_payment_id: paymentId
          });
          migrated++;
        }
      }
    }
    console.log(`✅ ${migrated} adet ödenmiş taksit işlemi 'transactions' koleksiyonuna taşındı.`);
  } catch (err) {
    console.error('Migration hatası:', err);
  }
  process.exit(0);
}

migrate();
