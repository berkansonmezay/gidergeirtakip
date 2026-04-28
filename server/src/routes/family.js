import { Router } from 'express';
import db, { seedUserCategories } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Aile adı zorunludur.' });
    const r = db.prepare('INSERT INTO families (name, created_by) VALUES (?,?)').run(name, req.user.id);
    db.prepare('UPDATE users SET family_id=?, role=\'family_admin\' WHERE id=?').run(r.lastInsertRowid, req.user.id);
    res.status(201).json({ message: 'Aile oluşturuldu.', family: db.prepare('SELECT * FROM families WHERE id=?').get(r.lastInsertRowid) });
  } catch (err) { res.status(500).json({ error: 'Hata oluştu.' }); }
});

router.get('/members', (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }
    const members = db.prepare("SELECT id, name, username, email, role, created_at FROM users WHERE role != 'admin'").all();
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
    
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
    }

    // Admin's family_id
    let adminUser = db.prepare('SELECT family_id FROM users WHERE id=?').get(req.user.id);
    let familyId = adminUser?.family_id;

    if (!familyId) {
      // Create a default family for admin if none exists
      const r = db.prepare('INSERT INTO families (name, created_by) VALUES (?,?)').run('Aile', req.user.id);
      familyId = r.lastInsertRowid;
      db.prepare('UPDATE users SET family_id=? WHERE id=?').run(familyId, req.user.id);
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 12);

    const result = db.prepare(
      'INSERT INTO users (name, username, password_hash, role, family_id) VALUES (?, ?, ?, ?, ?)'
    ).run(name, username, passwordHash, 'user', familyId);

    seedUserCategories(result.lastInsertRowid);

    res.status(201).json({ message: 'Kullanıcı oluşturuldu.', member: { id: result.lastInsertRowid, name, username, role: 'user' } });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Hata oluştu.' }); 
  }
});

router.delete('/members/:id', (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }
    
    // Güvenlik: Adminin kendisini silmesini engelle
    if (req.params.id == req.user.id) {
      return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
    }

    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
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

    // Check if the username is taken by another user
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
    if (existingUser) {
      return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
    }

    let query = 'UPDATE users SET name = ?, username = ?';
    let params = [name, username];

    if (password) {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash(password, 12);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }

    query += ' WHERE id = ?';
    params.push(id);

    db.prepare(query).run(...params);
    res.json({ message: 'Kullanıcı başarıyla güncellendi.' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Hata oluştu.' });
  }
});

export default router;
