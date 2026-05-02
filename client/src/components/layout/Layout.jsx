import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import QuickAddModal from '../forms/QuickAddModal';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [initialType, setInitialType] = useState('expense');
  
  useEffect(() => {
    const handleOpen = (e) => {
      if (e.detail?.type) setInitialType(e.detail.type);
      setQuickAddOpen(true);
    };
    window.addEventListener('open-quick-add', handleOpen);
    return () => window.removeEventListener('open-quick-add', handleOpen);
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col md:ml-[260px] min-h-screen transition-all">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onQuickAdd={() => setQuickAddOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} initialType={initialType} />}
    </div>
  );
}
