import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/firebase.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { authenticateToken } from '../middleware/auth.js';
import { resetTransporter } from '../utils/email.js';

const router = Router();

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('Şifre en az 8 karakter olmalıdır.');
  if (!/[A-Z]/.test(password)) errors.push('En az bir büyük harf gereklidir.');
  if (!/[a-z]/.test(password)) errors.push('En az bir küçük harf gereklidir.');
  if (!/[0-9]/.test(password)) errors.push('En az bir rakam gereklidir.');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('En az bir özel karakter gereklidir.');
  return errors;
}

async function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'fallback-secret-for-development-only',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Delete existing refresh tokens for this user
  const tokensSnapshot = await db.collection('refresh_tokens').where('user_id', 'in', [String(user.id), Number(user.id)]).get();
  const batch = db.batch();
  tokensSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Save new refresh token
  await db.collection('refresh_tokens').add({
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt
  });

  return { accessToken, refreshToken };
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı/Email ve şifre gereklidir.' });
    }

    // Gelen veri email formatında mı yoksa kullanıcı adı mı kontrol edip ona göre sorgula
    let userSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnapshot.empty) {
      userSnapshot = await db.collection('users').where('username', '==', email).limit(1).get();
    }

    if (userSnapshot.empty) {
      return res.status(401).json({ error: 'Kullanıcı adı, email veya şifre hatalı.' });
    }

    const userDoc = userSnapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Kullanıcı adı, email veya şifre hatalı.' });
    }

    const tokens = await generateTokens(user);

    res.json({
      message: 'Giriş başarılı!',
      user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role },
      ...tokens,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Giriş sırasında bir hata oluştu.' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token gereklidir.' });
    }

    const tokenSnapshot = await db.collection('refresh_tokens').where('token', '==', refreshToken).limit(1).get();
    if (tokenSnapshot.empty) {
      return res.status(401).json({ error: 'Geçersiz refresh token.' });
    }

    const storedDoc = tokenSnapshot.docs[0];
    const stored = { id: storedDoc.id, ...storedDoc.data() };

    if (new Date(stored.expires_at) < new Date()) {
      await db.collection('refresh_tokens').doc(stored.id).delete();
      return res.status(401).json({ error: 'Refresh token süresi dolmuş.' });
    }

    const userDoc = await db.collection('users').doc(String(stored.user_id)).get();
    if (!userDoc.exists) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const user = { id: userDoc.id, ...userDoc.data() };
    const tokens = await generateTokens(user);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Token yenileme sırasında hata oluştu.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const tokensSnapshot = await db.collection('refresh_tokens').where('user_id', 'in', [String(req.user.id), Number(req.user.id)]).get();
    const batch = db.batch();
    tokensSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    res.json({ message: 'Çıkış başarılı.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Çıkış yaparken bir hata oluştu.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email adresi gereklidir.' });

    const userSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    
    // Always return success to prevent email enumeration
    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const resetToken = uuidv4();
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour

      // Save token to database
      await db.collection('password_resets').add({
        user_id: userDoc.id,
        token: resetToken,
        expires_at: expiresAt
      });

      console.log(`\n🔑 Şifre sıfırlama linki (${email}): http://localhost:5173/reset-password?token=${resetToken}\n`);
      // Here you would normally send an email using your SMTP settings
    }
    
    res.json({ message: 'Eğer hesap mevcutsa, şifre sıfırlama bağlantısı gönderilecektir.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'İşlem sırasında bir hata oluştu.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token ve yeni şifre gereklidir.' });
    }

    const errors = validatePassword(newPassword);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const resetSnapshot = await db.collection('password_resets').where('token', '==', token).limit(1).get();
    if (resetSnapshot.empty) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş token.' });
    }

    const resetDoc = resetSnapshot.docs[0];
    const resetData = resetDoc.data();

    if (new Date(resetData.expires_at) < new Date()) {
      await db.collection('password_resets').doc(resetDoc.id).delete();
      return res.status(400).json({ error: 'Token süresi dolmuş.' });
    }

    // Update user password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.collection('users').doc(resetData.user_id).update({
      password_hash: passwordHash
    });

    // Delete used token
    await db.collection('password_resets').doc(resetDoc.id).delete();

    res.json({ message: 'Şifreniz başarıyla güncellendi.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Şifre güncellenirken bir hata oluştu.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Kullanıcı ID bulunamadı.' });
    const userDoc = await db.collection('users').doc(String(req.user.id)).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
    const user = { id: userDoc.id, ...userDoc.data() };
    delete user.password_hash;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Kullanıcı bilgileri alınırken hata oluştu.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Kullanıcı ID bulunamadı.' });
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Ad ve email gereklidir.' });
    
    // Check if email is already taken by another user
    const emailSnapshot = await db.collection('users').where('email', '==', email).get();
    const otherUser = emailSnapshot.docs.find(doc => doc.id !== String(req.user.id));
    if (otherUser) return res.status(400).json({ error: 'Bu email adresi zaten kullanımda.' });

    await db.collection('users').doc(String(req.user.id)).update({ name, email });
    
    res.json({ message: 'Profil güncellendi.', user: { id: req.user.id, name, email, role: req.user.role } });
  } catch (err) { res.status(500).json({ error: 'Profil güncellenirken hata oluştu.' }); }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Kullanıcı ID bulunamadı.' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mevcut ve yeni şifre gereklidir.' });

    const userDoc = await db.collection('users').doc(String(req.user.id)).get();
    const user = userDoc.data();

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Mevcut şifre hatalı.' });

    const errors = validatePassword(newPassword);
    if (errors.length > 0) return res.status(400).json({ error: errors.join(' ') });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.collection('users').doc(String(req.user.id)).update({ password_hash: passwordHash });

    res.json({ message: 'Şifre başarıyla değiştirildi.' });
  } catch (err) { res.status(500).json({ error: 'Şifre değiştirilirken hata oluştu.' }); }
});

// GET /api/auth/settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Kullanıcı ID bulunamadı.' });
    const userDoc = await db.collection('users').doc(String(req.user.id)).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    
    const settings = userDoc.data().notification_settings || {
      email_reminders: true,
      push_notifications: true
    };
    
    res.json({ settings });
  } catch (err) { 
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Ayarlar alınırken hata oluştu.' }); 
  }
});

// PUT /api/auth/settings
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Kullanıcı ID bulunamadı.' });
    const { email_reminders, push_notifications } = req.body;
    
    await db.collection('users').doc(String(req.user.id)).update({
      notification_settings: {
        email_reminders: !!email_reminders,
        push_notifications: !!push_notifications
      }
    });
    
    res.json({ message: 'Ayarlar güncellendi.' });
  } catch (err) { res.status(500).json({ error: 'Ayarlar güncellenirken hata oluştu.' }); }
});

// GET /api/auth/smtp-settings (Admin Only)
router.get('/smtp-settings', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }
    const doc = await db.collection('system_settings').doc('smtp').get();
    const settings = doc.exists ? doc.data() : { host: '', port: 587, user: '', pass: '', from: '' };
    // Passwords shouldn't be sent to frontend ideally, but since it's an admin panel to edit them, we can send it or send a placeholder. We'll send it for simplicity of editing.
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'SMTP ayarları alınırken hata oluştu.' });
  }
});

// PUT /api/auth/smtp-settings (Admin Only)
router.put('/smtp-settings', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }
    const { host, port, user, pass, from } = req.body;
    
    await db.collection('system_settings').doc('smtp').set({
      host: host || '',
      port: Number(port) || 587,
      user: user || '',
      pass: pass || '',
      from: from || ''
    }, { merge: true });

    // Reset transporter so next email uses new settings
    resetTransporter();

    res.json({ message: 'SMTP ayarları güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: 'SMTP ayarları güncellenirken hata oluştu.' });
  }
});

export default router;
