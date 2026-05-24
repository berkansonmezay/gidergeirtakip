import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initializeCronJobs } from './utils/cron.js';
import { apiLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import installmentRoutes from './routes/installments.js';
import reportRoutes from './routes/reports.js';
import savingsRoutes from './routes/savings.js';
import familyRoutes from './routes/family.js';
import payeeRoutes from './routes/payees.js';
import notificationRoutes from './routes/notifications.js';
import goldPricesRoutes from './routes/goldPrices.js';
import eventRoutes from './routes/events.js';
import userRoutes from './routes/users.js';
import warrantyRoutes from './routes/warranties.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'https://ailebutcesi.vercel.app', 'https://gidergelirtakip.vercel.app'], credentials: true }));
app.use(express.json());
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Aile Bütçesi API çalışıyor! 🏠💰',
    envStats: {
      hasFirebaseEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasJwtEnv: !!process.env.JWT_SECRET
    }
  });
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
app.use('/api/notifications', notificationRoutes);
app.use('/api/gold-prices', goldPricesRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/warranties', warrantyRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
});

// Initialize Cron jobs
initializeCronJobs();

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🏠 Aile Bütçesi API - Port ${PORT}`);
    console.log(`📡 http://localhost:${PORT}/api/health\n`);
  });
}

export default app;
