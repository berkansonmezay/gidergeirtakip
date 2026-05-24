import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';

const router = Router();
router.use(authenticateToken);
router.use(cacheMiddleware(120));
router.use(invalidateCacheMiddleware);

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
  }
  next();
};

router.use(requireAdmin);

// Varsayılan kategoriler
const DEFAULT_CATEGORIES = [
  { name: 'Maaş', type: 'income', icon: '💰', color: '#10b981' },
  { name: 'Ek Gelir', type: 'income', icon: '📈', color: '#3b82f6' },
  { name: 'Ev Kirası', type: 'expense', icon: '🏠', color: '#ef4444' },
  { name: 'Market', type: 'expense', icon: '🛒', color: '#f59e0b' },
  { name: 'Faturalar', type: 'expense', icon: '🧾', color: '#6366f1' },
  { name: 'Ulaşım', type: 'expense', icon: '🚌', color: '#8b5cf6' },
  { name: 'Eğlence', type: 'expense', icon: '🎭', color: '#ec4899' },
  { name: 'Sağlık', type: 'expense', icon: '💊', color: '#14b8a6' }
];

// Varsayılan harcama yerleri
const DEFAULT_PAYEES = [
  { name: 'İşveren', type: 'income' },
  { name: 'Ev Sahibi', type: 'expense' },
  { name: 'Süpermarket', type: 'expense' },
  { name: 'Elektrik Dağıtım', type: 'expense' },
  { name: 'Su İdaresi', type: 'expense' },
  { name: 'Telekom', type: 'expense' }
];

// GET /api/users - Kullanıcı listesi
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password_hash; // Güvenlik için şifreyi gizle
      return { id: doc.id, ...data };
    });
    
    // Sort logic (Admin first, then by date)
    users.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    res.json({ users });
  } catch (err) {
    console.error('Kullanıcılar listelenirken hata:', err);
    res.status(500).json({ error: 'Kullanıcılar listelenirken hata oluştu.' });
  }
});

// POST /api/users - Yeni kullanıcı oluştur
router.post('/', async (req, res) => {
  try {
    const { name, email, username, password, role } = req.body;
    
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
    }

    // Check if email or username exists
    const emailCheck = await db.collection('users').where('email', '==', email).get();
    if (!emailCheck.empty) return res.status(400).json({ error: 'Bu email zaten kullanımda.' });

    const usernameCheck = await db.collection('users').where('username', '==', username).get();
    if (!usernameCheck.empty) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda.' });

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = {
      name,
      email,
      username,
      password_hash: passwordHash,
      role: role || 'user',
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection('users').add(newUser);
    const userId = docRef.id;

    // Background job: Varsayılan verileri yükle
    const batch = db.batch();
    
    DEFAULT_CATEGORIES.forEach(cat => {
      const newRef = db.collection('categories').doc();
      batch.set(newRef, { ...cat, user_id: userId, is_default: 1, created_at: new Date().toISOString() });
    });

    DEFAULT_PAYEES.forEach(payee => {
      const newRef = db.collection('payees').doc();
      batch.set(newRef, { ...payee, user_id: userId, is_default: 1, created_at: new Date().toISOString() });
    });

    await batch.commit();

    delete newUser.password_hash;
    res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu ve varsayılan veriler yüklendi.', user: { id: userId, ...newUser } });
  } catch (err) {
    console.error('Kullanıcı oluşturma hatası:', err);
    res.status(500).json({ error: 'Kullanıcı oluşturulurken bir hata oluştu.' });
  }
});

// PUT /api/users/:id - Kullanıcı güncelle
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, email, username, role, password } = req.body;
    
    const docRef = db.collection('users').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const updates = {};
    if (name) updates.name = name;
    if (email && email !== doc.data().email) {
      const check = await db.collection('users').where('email', '==', email).get();
      if (!check.empty) return res.status(400).json({ error: 'Bu email zaten kullanımda.' });
      updates.email = email;
    }
    if (username && username !== doc.data().username) {
      const check = await db.collection('users').where('username', '==', username).get();
      if (!check.empty) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda.' });
      updates.username = username;
    }
    if (role) updates.role = role;
    
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 12);
    }

    await docRef.update(updates);
    res.json({ message: 'Kullanıcı başarıyla güncellendi.' });
  } catch (err) {
    console.error('Kullanıcı güncelleme hatası:', err);
    res.status(500).json({ error: 'Kullanıcı güncellenirken hata oluştu.' });
  }
});

// DELETE /api/users/:id - Kullanıcı sil
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (id === String(req.user.id)) {
      return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
    }

    const docRef = db.collection('users').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    await docRef.delete();
    
    // (Opsiyonel) İleride kullanıcının kategorilerini, işlemlerini temizlemek için bir cloud function veya batch process eklenebilir.
    // Şimdilik sadece kullanıcı kaydı siliniyor (soft/hard delete mantığına göre).

    res.json({ message: 'Kullanıcı başarıyla silindi.' });
  } catch (err) {
    console.error('Kullanıcı silme hatası:', err);
    res.status(500).json({ error: 'Kullanıcı silinirken hata oluştu.' });
  }
});

export default router;
