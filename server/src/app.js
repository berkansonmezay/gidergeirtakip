import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database.js';
import { apiLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import installmentRoutes from './routes/installments.js';
import reportRoutes from './routes/reports.js';
import savingsRoutes from './routes/savings.js';
import familyRoutes from './routes/family.js';
import payeeRoutes from './routes/payees.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json());
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Aile Bütçesi API çalışıyor! 🏠💰' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/payees', payeeRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
});

// Initialize DB and start
initializeDatabase();
app.listen(PORT, () => {
  console.log(`\n🏠 Aile Bütçesi API - Port ${PORT}`);
  console.log(`📡 http://localhost:${PORT}/api/health\n`);
});
