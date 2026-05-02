import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'data', 'family_budget.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      family_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS payees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#6366f1',
      user_id INTEGER,
      parent_id INTEGER,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category_id INTEGER,
      payee_id INTEGER,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (payee_id) REFERENCES payees(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      total_amount REAL NOT NULL,
      installment_count INTEGER NOT NULL,
      paid_count INTEGER DEFAULT 0,
      monthly_amount REAL NOT NULL,
      start_date DATE NOT NULL,
      next_payment_date DATE NOT NULL,
      category_id INTEGER,
      payee_id INTEGER,
      user_id INTEGER NOT NULL,
      type TEXT DEFAULT 'expense' CHECK(type IN ('income', 'expense')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (payee_id) REFERENCES payees(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS installment_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installment_id INTEGER NOT NULL,
      payment_number INTEGER NOT NULL,
      amount REAL NOT NULL,
      due_date DATE NOT NULL,
      is_paid INTEGER DEFAULT 0,
      paid_date DATE,
      FOREIGN KEY (installment_id) REFERENCES installments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      deadline DATE,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  
  // Migration for existing installations
  try {
    const columns = db.prepare("PRAGMA table_info(installments)").all();
    const hasType = columns.some(c => c.name === 'type');
    const hasPayee = columns.some(c => c.name === 'payee_id');
    
    if (!hasType) {
      db.exec("ALTER TABLE installments ADD COLUMN type TEXT DEFAULT 'expense' CHECK(type IN ('income', 'expense'))");
      console.log('📦 Taksitler tablosuna \'type\' sütunu eklendi.');
    }
    if (!hasPayee) {
      db.exec("ALTER TABLE installments ADD COLUMN payee_id INTEGER REFERENCES payees(id) ON DELETE SET NULL");
      console.log('📦 Taksitler tablosuna \'payee_id\' sütunu eklendi.');
    }
  } catch (err) {
    console.error('Migration error:', err);
  }

  // Seed default categories if none exist
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE is_default = 1').get();
  if (categoryCount.count === 0) {
    seedDefaultCategories();
  }

  // Seed default admin if none exists
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get('admin');
  if (adminCount.count === 0) {
    const passwordHash = bcrypt.hashSync('123', 12);
    db.prepare('INSERT INTO users (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run('Admin Kullanıcı', 'admin', 'admin@localhost.com', passwordHash, 'admin');
    console.log('👑 Varsayılan admin kullanıcısı oluşturuldu (kullanıcı: admin, şifre: 123).');
  }

  console.log('✅ Veritabanı başarıyla başlatıldı.');
}

function seedDefaultCategories() {
  const defaultCategories = [
    // Gider kategorileri
    { name: 'Gıda & Market', type: 'expense', icon: '🛒', color: '#ef4444' },
    { name: 'Ulaşım', type: 'expense', icon: '🚗', color: '#f97316' },
    { name: 'Faturalar', type: 'expense', icon: '💡', color: '#eab308' },
    { name: 'Kira', type: 'expense', icon: '🏠', color: '#84cc16' },
    { name: 'Sağlık', type: 'expense', icon: '🏥', color: '#22c55e' },
    { name: 'Eğitim', type: 'expense', icon: '📚', color: '#14b8a6' },
    { name: 'Giyim', type: 'expense', icon: '👕', color: '#06b6d4' },
    { name: 'Eğlence', type: 'expense', icon: '🎬', color: '#3b82f6' },
    { name: 'Yemek (Dışarı)', type: 'expense', icon: '🍽️', color: '#6366f1' },
    { name: 'Diğer Gider', type: 'expense', icon: '📦', color: '#8b5cf6' },
    // Gelir kategorileri
    { name: 'Maaş', type: 'income', icon: '💰', color: '#10b981' },
    { name: 'Ek Gelir', type: 'income', icon: '💵', color: '#059669' },
    { name: 'Yatırım Getirisi', type: 'income', icon: '📈', color: '#047857' },
    { name: 'Kira Geliri', type: 'income', icon: '🏢', color: '#065f46' },
    { name: 'Diğer Gelir', type: 'income', icon: '🎁', color: '#34d399' },
  ];

  const stmt = db.prepare(`
    INSERT INTO categories (name, type, icon, color, is_default)
    VALUES (@name, @type, @icon, @color, 1)
  `);

  const insertMany = db.transaction((cats) => {
    for (const cat of cats) stmt.run(cat);
  });

  insertMany(defaultCategories);
  console.log('🎨 Varsayılan kategoriler oluşturuldu.');
}

export function seedUserCategories(userId) {
  const defaultCategories = db.prepare('SELECT * FROM categories WHERE is_default = 1').all();
  
  const stmt = db.prepare(`
    INSERT INTO categories (name, type, icon, color, user_id, is_default)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  const insertMany = db.transaction((cats) => {
    for (const cat of cats) {
      stmt.run(cat.name, cat.type, cat.icon, cat.color, userId);
    }
  });

  insertMany(defaultCategories);
  console.log(`🎨 Kullanıcı ${userId} için kategoriler kopyalandı.`);
}

export function seedDemoData(userId) {
  const now = new Date();
  // Fetch user-specific categories we just created
  const categories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId);
  
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');
  
  const demoTransactions = [];
  
  // Generate 3 months of demo data
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    
    // Monthly salary
    demoTransactions.push({
      amount: 45000,
      description: 'Aylık maaş',
      date: new Date(month.getFullYear(), month.getMonth(), 1).toISOString().split('T')[0],
      type: 'income',
      category_id: incomeCategories.find(c => c.name === 'Maaş')?.id || incomeCategories[0].id,
      user_id: userId,
    });

    // Extra income
    if (monthOffset === 0) {
      demoTransactions.push({
        amount: 5000,
        description: 'Freelance proje ödemesi',
        date: new Date(month.getFullYear(), month.getMonth(), 15).toISOString().split('T')[0],
        type: 'income',
        category_id: incomeCategories.find(c => c.name === 'Ek Gelir')?.id || incomeCategories[1].id,
        user_id: userId,
      });
    }

    // Expenses
    const expenses = [
      { cat: 'Kira', amount: 12000, desc: 'Ev kirası', day: 1 },
      { cat: 'Gıda & Market', amount: 4500 + Math.floor(Math.random() * 1000), desc: 'Market alışverişi', day: 5 },
      { cat: 'Faturalar', amount: 1800 + Math.floor(Math.random() * 400), desc: 'Elektrik & doğalgaz', day: 10 },
      { cat: 'Ulaşım', amount: 2000 + Math.floor(Math.random() * 500), desc: 'Akaryakıt', day: 8 },
      { cat: 'Eğitim', amount: 3500, desc: 'Okul taksiti', day: 15 },
      { cat: 'Sağlık', amount: 800 + Math.floor(Math.random() * 500), desc: 'Eczane', day: 12 },
      { cat: 'Giyim', amount: 1200 + Math.floor(Math.random() * 800), desc: 'Giyim alışverişi', day: 20 },
      { cat: 'Eğlence', amount: 600 + Math.floor(Math.random() * 400), desc: 'Sinema & etkinlik', day: 22 },
      { cat: 'Yemek (Dışarı)', amount: 1500 + Math.floor(Math.random() * 500), desc: 'Restoran', day: 18 },
    ];

    for (const exp of expenses) {
      const catId = expenseCategories.find(c => c.name === exp.cat)?.id || expenseCategories[0].id;
      demoTransactions.push({
        amount: exp.amount,
        description: exp.desc,
        date: new Date(month.getFullYear(), month.getMonth(), exp.day).toISOString().split('T')[0],
        type: 'expense',
        category_id: catId,
        user_id: userId,
      });
    }
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (amount, description, date, type, category_id, user_id)
    VALUES (@amount, @description, @date, @type, @category_id, @user_id)
  `);

  const insertMany = db.transaction((txns) => {
    for (const t of txns) stmt.run(t);
  });

  insertMany(demoTransactions);

  // Demo installment
  const installmentStmt = db.prepare(`
    INSERT INTO installments (description, total_amount, installment_count, paid_count, monthly_amount, start_date, next_payment_date, category_id, user_id, status)
    VALUES (@description, @total_amount, @installment_count, @paid_count, @monthly_amount, @start_date, @next_payment_date, @category_id, @user_id, @status)
  `);

  const phoneInstallment = installmentStmt.run({
    description: 'iPhone 15 Pro',
    total_amount: 75000,
    installment_count: 12,
    paid_count: 3,
    monthly_amount: 6250,
    start_date: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0],
    next_payment_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0],
    category_id: expenseCategories.find(c => c.name === 'Diğer Gider')?.id || expenseCategories[0].id,
    user_id: userId,
    status: 'active',
  });

  // Create payment schedule for phone
  const paymentStmt = db.prepare(`
    INSERT INTO installment_payments (installment_id, payment_number, amount, due_date, is_paid, paid_date)
    VALUES (@installment_id, @payment_number, @amount, @due_date, @is_paid, @paid_date)
  `);

  for (let i = 1; i <= 12; i++) {
    const dueDate = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
    paymentStmt.run({
      installment_id: phoneInstallment.lastInsertRowid,
      payment_number: i,
      amount: 6250,
      due_date: dueDate.toISOString().split('T')[0],
      is_paid: i <= 3 ? 1 : 0,
      paid_date: i <= 3 ? dueDate.toISOString().split('T')[0] : null,
    });
  }

  // Demo savings goal
  db.prepare(`
    INSERT INTO savings_goals (name, target_amount, current_amount, deadline, user_id, status)
    VALUES (@name, @target_amount, @current_amount, @deadline, @user_id, @status)
  `).run({
    name: 'Tatil Fonu',
    target_amount: 30000,
    current_amount: 12500,
    deadline: new Date(now.getFullYear(), now.getMonth() + 4, 1).toISOString().split('T')[0],
    user_id: userId,
    status: 'active',
  });

  db.prepare(`
    INSERT INTO savings_goals (name, target_amount, current_amount, deadline, user_id, status)
    VALUES (@name, @target_amount, @current_amount, @deadline, @user_id, @status)
  `).run({
    name: 'Acil Durum Fonu',
    target_amount: 100000,
    current_amount: 35000,
    deadline: new Date(now.getFullYear() + 1, 0, 1).toISOString().split('T')[0],
    user_id: userId,
    status: 'active',
  });

  console.log('📊 Demo veriler oluşturuldu.');
}

export default db;
