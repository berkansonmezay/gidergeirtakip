import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Tags, CreditCard, BarChart3, PiggyBank, Users, Settings, LogOut, ChevronLeft, ChevronRight, Wallet, MapPin, Calendar, HelpCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Kontrol Paneli' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'İşlemler' },
  { path: '/categories', icon: Tags, label: 'Kategoriler' },
  { path: '/payees', icon: MapPin, label: 'Harcama Yerleri' },
  { path: '/installments/expense', icon: CreditCard, label: 'Taksitli Borçlar' },
  { path: '/installments/income', icon: Wallet, label: 'Taksitli Alacaklar' },
  { path: '/calendar', icon: Calendar, label: 'Takvim' },
  { path: '/reports', icon: BarChart3, label: 'Raporlar' },
  { path: '/savings', icon: PiggyBank, label: 'Tasarruf' },
  { path: '/settings', icon: Settings, label: 'Ayarlar' },
  { path: '/help', icon: HelpCircle, label: 'Yardım' },
];

export default function Sidebar({ isOpen, onClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
            <Wallet size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Aile Bütçesi</h1>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Finans Yönetimi</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'gradient-primary text-white shadow-md'
                    : 'hover:bg-[var(--bg-secondary)]'
                  }
                  ${collapsed ? 'justify-center' : ''}`
                }
                style={({ isActive }) => isActive ? {} : { color: 'var(--text-secondary)' }}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={20} />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
          
          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center w-full mt-2 py-2 rounded-xl transition-all hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-muted)' }}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}
