import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db, { seedDemoData, seedUserCategories } from '../config/database.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Şifre kuralları kontrolü
function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('Şifre en az 8 karakter olmalıdır.');
  if (!/[A-Z]/.test(password)) errors.push('En az bir büyük harf gereklidir.');
  if (!/[a-z]/.test(password)) errors.push('En az bir küçük harf gereklidir.');
  if (!/[0-9]/.test(password)) errors.push('En az bir rakam gereklidir.');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('En az bir özel karakter gereklidir.');
  return errors;
}

function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Save refresh token
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

// (Kayıt olma özelliği devredışı bırakıldı - Kullanıcılar Admin tarafından eklenecek)

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body; // Actually frontend will send 'email' field but it contains either email or username

    if (!email || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı/Email ve şifre gereklidir.' });
    }

    // Gelen veri email formatında mı yoksa kullanıcı adı mı kontrol edip ona göre sorgula
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(email, email);
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı adı, email veya şifre hatalı.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Kullanıcı adı, email veya şifre hatalı.' });
    }

    const tokens = generateTokens(user);

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
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token gereklidir.' });
    }

    const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
    if (!stored) {
      return res.status(401).json({ error: 'Geçersiz refresh token.' });
    }

    if (new Date(stored.expires_at) < new Date()) {
      db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
      return res.status(401).json({ error: 'Refresh token süresi dolmuş.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(stored.user_id);
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const tokens = generateTokens(user);

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
router.post('/logout', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Çıkış başarılı.' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
  
  if (user) {
    // MVP: Log to console instead of sending email
    const resetToken = uuidv4();
    console.log(`\n🔑 Şifre sıfırlama linki (${user.email}): http://localhost:5173/reset-password?token=${resetToken}\n`);
  }
  
  // Always return success to prevent email enumeration
  res.json({ message: 'Şifre sıfırlama bağlantısı email adresinize gönderildi.' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, family_id, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }
  res.json({ user });
});

export default router;
