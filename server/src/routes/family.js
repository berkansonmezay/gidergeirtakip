import { Router } from 'express';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';

const router = Router();
router.use(authenticateToken);
router.use(cacheMiddleware(120));
router.use(invalidateCacheMiddleware);

async function seedUserCategories(userId) {
  try {
    const defaultSnapshot = await db.collection('categories').where('is_default', '==', 1).get();
    const batch = db.batch();
    
    defaultSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const newRef = db.collection('categories').doc();
      batch.set(newRef, {
        name: data.name,
        type: data.type,
        icon: data.icon,
        color: data.color,
        user_id: userId,
        is_default: 0,
        created_at: new Date().toISOString()
      });
    });
    
    await batch.commit();
    console.log(`🎨 Kullanıcı ${userId} için kategoriler kopyalandı.`);
  } catch (err) {
    console.error('Kategoriler kopyalanırken hata:', err);
  }
}

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Aile adı zorunludur.' });

    const newFamily = {
      name,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('families').add(newFamily);
    await db.collection('users').doc(req.user.id).update({ family_id: docRef.id, role: 'family_admin' });
    
    res.status(201).json({ message: 'Aile oluşturuldu.', family: { id: docRef.id, ...newFamily } });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.get('/members', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }
    
    const snapshot = await db.collection('users').where('role', '!=', 'admin').get();
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, name: data.name, username: data.username, email: data.email, role: data.role, created_at: data.created_at };
    });
    
    res.json({ members });
  } catch (err) { 
    console.error('GET /members error:', err);
    res.status(500).json({ error: 'Hata oluştu.' }); 
  }
});

router.post('/members', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'İsim, kullanıcı adı ve şifre zorunludur.' });
    }
    
    const existingUser = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!existingUser.empty) {
      return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
    }

    // Admin's family_id
    const adminDoc = await db.collection('users').doc(req.user.id).get();
    let familyId = adminDoc.data()?.family_id;

    if (!familyId) {
      const docRef = await db.collection('families').add({ name: 'Aile', created_by: req.user.id, created_at: new Date().toISOString() });
      familyId = docRef.id;
      await db.collection('users').doc(req.user.id).update({ family_id: familyId });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 12);

    const newUserRef = await db.collection('users').add({
      name,
      username,
      password_hash: passwordHash,
      role: 'user',
      family_id: familyId,
      created_at: new Date().toISOString()
    });

    await seedUserCategories(newUserRef.id);

    res.status(201).json({ message: 'Kullanıcı oluşturuldu.', member: { id: newUserRef.id, name, username, role: 'user' } });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Hata oluştu.' }); 
  }
});

router.delete('/members/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }
    
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
    }

    await db.collection('users').doc(req.params.id).delete();
    res.json({ message: 'Kullanıcı silindi.' });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.put('/members/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }

    const { id } = req.params;
    const { name, username, password } = req.body;

    if (!name || !username) {
      return res.status(400).json({ error: 'İsim ve kullanıcı adı zorunludur.' });
    }

    const existingUser = await db.collection('users').where('username', '==', username).get();
    const isTaken = existingUser.docs.some(doc => doc.id !== id);
    if (isTaken) {
      return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
    }

    const updates = { name, username };

    if (password) {
      const bcrypt = await import('bcryptjs');
      updates.password_hash = await bcrypt.default.hash(password, 12);
    }

    await db.collection('users').doc(id).update(updates);
    res.json({ message: 'Kullanıcı başarıyla güncellendi.' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

export default router;
