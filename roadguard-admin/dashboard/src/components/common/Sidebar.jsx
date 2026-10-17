import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { ProfileAvatar } from './ProfileAvatar';
import {
  LayoutDashboard,
  AlertCircle,
  MessageSquareWarning,
  MapPin,
  Users,
  CheckSquare,
  BarChart3,
  Bell,
  CheckCircle2,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldAlert,
  ShieldCheck,
  Building2
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, toggleCollapse, isMobileOpen, closeMobile }) => {
  const { settings, unreadNotificationsCount, organizationProfile } = useRoadGuard();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Issue Management', path: '/admin/issues', icon: AlertCircle },
    { label: 'Live Issue Map', path: '/admin/map', icon: MapPin },
    { label: 'Employee Management', path: '/admin/employees', icon: Users },
    { label: 'Departments', path: '/admin/departments', icon: Building2 },
    { label: 'Access Control', path: '/admin/access-control', icon: ShieldCheck },
    { label: 'Task Assignments', path: '/admin/tasks', icon: CheckSquare },
    { label: 'Analytics & Reports', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Notifications', path: '/admin/notifications', icon: Bell, badge: unreadNotificationsCount },
    { label: 'User Reports', path: '/admin/user-reports', icon: MessageSquareWarning },
    { label: 'Resolved Issues', path: '/admin/resolved', icon: CheckCircle2 },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: FileText },
    { label: 'Organisation Settings', path: '/admin/settings', icon: Settings },
  ];

  const adminProfile = settings.profileAppearance || {};

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-[#EEF3FF] border-r border-[#D9E1EF] flex flex-col transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header / Logo */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#D9E1EF] bg-white">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src="/shield-logo.svg" alt="Road Guard Logo" className="w-9 h-9 shrink-0" />
            {(!isCollapsed || isMobileOpen) && (
              <div className="leading-tight truncate">
                <span className="font-extrabold text-lg tracking-tight text-[#0A2342] block">
                  Road Guard
                </span>
                <span className="text-[10px] font-semibold text-[#52627A] uppercase tracking-wider block">
                  Command Centre
                </span>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={closeMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1 text-slate-500 hover:text-[#0755C9] hover:bg-blue-50 rounded-lg transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobile}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all relative group ${
                    isActive
                      ? 'bg-[#0755C9] text-white shadow-sm font-semibold'
                      : 'text-[#0A2342]/80 hover:bg-white hover:text-[#0755C9]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#52627A] group-hover:text-[#0755C9]'}`} />
                    {(!isCollapsed || isMobileOpen) && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}

                    {/* Badge Count */}
                    {item.badge > 0 && (
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          isActive
                            ? 'bg-white text-[#0755C9]'
                            : 'bg-red-500 text-white'
                        } ${isCollapsed && !isMobileOpen ? 'absolute -top-1 -right-1 px-1.5 py-0.2' : ''}`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Active Bar Indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r"></span>
                    )}

                    {/* Tooltip for collapsed mode */}
                    {isCollapsed && !isMobileOpen && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                        {item.label}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Administrator Profile Card at Bottom */}
        <div className="p-3 border-t border-[#D9E1EF] bg-white">
          <div
            className={`flex items-center gap-3 p-2 rounded-lg bg-[#F7F9FD] border border-[#D9E1EF] ${
              isCollapsed && !isMobileOpen ? 'justify-center' : ''
            }`}
          >
            <ProfileAvatar src={organizationProfile?.profileImage} className="w-9 h-9 border-2 border-[#0755C9] shrink-0" iconClassName="w-5 h-5" />
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0A2342] truncate">
                  {adminProfile.adminName || 'Manoj Reddy'}
                </p>
                <p className="text-[11px] text-[#52627A] truncate">
                  {adminProfile.adminDesignation || 'Chief Supervisor'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
