import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { ProfileAvatar } from './ProfileAvatar';
import { endSession } from '../../lib/portalApi';
import {
  Menu,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const Topbar = ({ openMobileMenu, isCollapsed }) => {
  const { notifications, unreadNotificationsCount, markNotificationRead, markAllNotificationsRead, organizationProfile } = useRoadGuard();
  const location = useLocation();
  const navigate = useNavigate();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Map route path to human readable page title
  const getPageTitle = (path) => {
    switch (path) {
      case '/admin/dashboard': return { title: 'Overview Dashboard', breadcrumb: 'Admin / Overview' };
      case '/admin/issues': return { title: 'Issue Management', breadcrumb: 'Admin / Issues' };
      case '/admin/map': return { title: 'Live Hazard Map', breadcrumb: 'Admin / Live Map' };
      case '/admin/employees': return { title: 'Employee Management', breadcrumb: 'Admin / Employees' };
      case '/admin/access-control': return { title: 'Access Control', breadcrumb: 'Admin / Access Control' };
      case '/admin/tasks': return { title: 'Task Assignments', breadcrumb: 'Admin / Tasks' };
      case '/admin/analytics': return { title: 'Analytics & Reports', breadcrumb: 'Admin / Analytics' };
      case '/admin/notifications': return { title: 'Notifications Centre', breadcrumb: 'Admin / Notifications' };
      case '/admin/user-reports': return { title: 'User Reports', breadcrumb: 'Admin / User Reports' };
      case '/admin/resolved': return { title: 'Resolved Issues History', breadcrumb: 'Admin / Resolved' };
      case '/admin/audit-logs': return { title: 'System Audit Logs', breadcrumb: 'Admin / Audit' };
      case '/admin/settings': return { title: 'Organisation Settings', breadcrumb: 'Admin / Settings' };
      case '/admin/profile': return { title: 'Administrator Profile', breadcrumb: 'Admin / Profile' };
      default: return { title: 'Admin Command Centre', breadcrumb: 'Admin' };
    }
  };

  const pageInfo = getPageTitle(location.pathname);
  const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
  const adminName = organizationProfile?.name || auth?.name || 'Organization Admin';
  const orgName = organizationProfile?.organizationName || 'Organization';

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white border-b border-[#D9E1EF] flex items-center justify-between px-4 lg:px-6 transition-all duration-300 ${
        isCollapsed ? 'left-0 lg:left-20' : 'left-0 lg:left-64'
      }`}
    >
      {/* Left side: Hamburger + Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={openMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-[#0755C9] hover:bg-slate-100 rounded-lg"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[11px] font-semibold text-[#52627A] uppercase tracking-wider block">
            {pageInfo.breadcrumb}
          </span>
          <h1 className="text-lg font-bold text-[#0A2342] leading-none mt-0.5">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Right side: Org Badge, Demo Tag, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Org Name Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-[#0A2342]">
          <Building2 className="w-3.5 h-3.5 text-[#0755C9]" />
          <span className="truncate max-w-[200px]">{orgName}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-live"></span>
          <span>Organization Admin</span>
        </div>

        {/* Notifications Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 text-slate-600 hover:text-[#0755C9] hover:bg-slate-100 rounded-lg relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#D9E1EF] rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
              <div className="p-3 bg-[#F7F9FD] border-b border-[#D9E1EF] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[#0A2342]">Notifications</h4>
                  {unreadNotificationsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#0755C9] text-white text-xs font-bold">
                      {unreadNotificationsCount} new
                    </span>
                  )}
                </div>
                <button
                  onClick={markAllNotificationsRead}
                  className="text-xs font-semibold text-[#0755C9] hover:underline"
                >
                  Mark all read
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-500">No notifications</p>
                ) : (
                  notifications.slice(0, 5).map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.link) navigate(n.link);
                        setShowNotifMenu(false);
                      }}
                      className={`p-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        !n.read ? 'bg-blue-50/50 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {n.type === 'critical' ? (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-[#0755C9]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#0A2342] truncate">{n.title}</p>
                          <p className="text-xs text-[#52627A] line-clamp-2 mt-0.5">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">{n.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 bg-[#F7F9FD] border-t border-[#D9E1EF] text-center">
                <Link
                  to="/admin/notifications"
                  onClick={() => setShowNotifMenu(false)}
                  className="text-xs font-bold text-[#0755C9] hover:underline block py-1"
                >
                  View All Notifications ({notifications.length})
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Administrator Profile Dropdown Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ProfileAvatar src={organizationProfile?.profileImage} className="w-8 h-8 border border-[#0755C9]" iconClassName="w-4 h-4" />
            <span className="hidden md:block text-xs font-bold text-[#0A2342]">
              {adminName}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-500 hidden md:block" />
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-[#D9E1EF] rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-slate-100 bg-[#F7F9FD]">
                <p className="text-xs font-bold text-[#0A2342]">{adminName}</p>
                <p className="text-[11px] text-[#52627A]">{organizationProfile?.email || auth?.username}</p>
                {organizationProfile?.organizationJoinCode && <p className="text-[11px] text-blue-700 mt-1">Employee join code: <strong>{organizationProfile.organizationJoinCode}</strong></p>}
                <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-[#0755C9]">
                  Organization Admin
                </span>
              </div>

              <div className="py-1">
                <Link
                  to="/admin/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#0A2342] hover:bg-slate-50 font-medium"
                >
                  <User className="w-4 h-4 text-[#52627A]" />
                  Admin Profile
                </Link>
                <Link
                  to="/admin/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#0A2342] hover:bg-slate-50 font-medium"
                >
                  <Settings className="w-4 h-4 text-[#52627A]" />
                  Organisation Settings
                </Link>
              </div>

              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={async () => {
                    setShowProfileMenu(false);
                    await endSession();
                    window.location.href = '/admin/signin.html';
                  }}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-semibold w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
