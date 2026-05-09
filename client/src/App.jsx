import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Installments from './pages/Installments';
import Reports from './pages/Reports';
import Savings from './pages/Savings';
import Settings from './pages/Settings';
import Payees from './pages/Payees';
import Calendar from './pages/Calendar';
import Help from './pages/Help';
import Events from './pages/Events';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { initTheme } = useThemeStore();
  useEffect(() => { initTheme(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Guest routes */}
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="categories" element={<Categories />} />
          <Route path="installments" element={<Navigate to="expense" replace />} />
          <Route path="installments/:type" element={<Installments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="savings" element={<Savings />} />
          <Route path="payees" element={<Payees />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="events" element={<Events />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
