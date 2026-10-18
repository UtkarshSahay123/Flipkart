import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Topbar } from '../components/common/Topbar';
import { Toast } from '../components/common/Toast';

export const AdminLayout = () => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
    if (!auth?.accessToken) {
      sessionStorage.removeItem('roadguard.auth');
      navigate('/admin/signin.html', { replace: true });
    }
    else if (auth.role === 'EMPLOYEE') navigate('/employee', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F9FD] text-[#0A2342] flex flex-col font-sans">
      {/* Top Navigation */}
      <Topbar
        openMobileMenu={() => setIsMobileOpen(true)}
        isCollapsed={isCollapsed}
      />

      {/* Side Navigation */}
      <Sidebar
        isCollapsed={isCollapsed}
        toggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        closeMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 pt-20 pb-12 px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          isCollapsed ? 'lg:pl-24' : 'lg:pl-72'
        }`}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>

      {/* Toast Banners */}
      <Toast />
    </div>
  );
};
