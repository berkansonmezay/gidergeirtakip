import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/categories
router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM categories WHERE user_id = ?';
    const params = [req.user.id];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY name ASC';
    const categories = db.prepare(query).all(...params);
    res.json({ categories });
  } catch (err) {
    console.error('Categories list error:', err);
    res.status(500).json({ error: 'Kategoriler listelenirken hata oluştu.' });
  }
});

// POST /api/categories
router.post('/', (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Kategori adı ve türü zorunludur.' });
    }
    const result = db.prepare(`
      INSERT INTO categories (name, type, icon, color, user_id, is_default)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(name, type, icon || '📁', color || '#6366f1', req.user.id);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Kategori oluşturuldu.', category });
  } catch (err) {
    console.error('Category create error:', err);
    res.status(500).json({ error: 'Kategori oluşturulurken hata oluştu.' });
  }
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  try {
    const { name, icon, color } = req.body;
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Kategori bulunamadı.' });
    }
    db.prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?').run(
      name || existing.name,
      icon || existing.icon,
      color || existing.color,
      id
    );

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json({ message: 'Kategori güncellendi.', category });
  } catch (err) {
    console.error('Category update error:', err);
    res.status(500).json({ error: 'Kategori güncellenirken hata oluştu.' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Kategori bulunamadı.' });
    }

    // Set transactions to null category
    db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);

    res.json({ message: 'Kategori silindi.' });
  } catch (err) {
    console.error('Category delete error:', err);
    res.status(500).json({ error: 'Kategori silinirken hata oluştu.' });
  }
});

// GET /api/categories/:id/stats
router.get('/:id/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as avg_amount
      FROM transactions 
      WHERE category_id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    res.json({ stats });
  } catch (err) {
    console.error('Category stats error:', err);
    res.status(500).json({ error: 'Kategori istatistikleri alınırken hata oluştu.' });
  }
});

export default router;
