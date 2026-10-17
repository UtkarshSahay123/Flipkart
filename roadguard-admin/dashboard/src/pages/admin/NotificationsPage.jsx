import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCheck,
  ArrowRight
} from 'lucide-react';

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadNotificationsCount, markNotificationRead, markAllNotificationsRead } = useRoadGuard();

  const [activeTab, setActiveTab] = useState('All'); // 'All' | 'Unread' | 'Read'

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'Unread') return !n.read;
    if (activeTab === 'Read') return n.read;
    return true;
  });

  const getIcon = (type) => {
    switch (type) {
      case 'critical': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'info': return <Info className="w-5 h-5 text-[#0755C9]" />;
      default: return <Bell className="w-5 h-5 text-purple-600" />;
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'warning': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'success': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'info': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#0755C9]" />
            Municipal Notification Centre
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Automated alerts, critical hazard thresholds, and employee task updates
          </p>
        </div>

        {unreadNotificationsCount > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="px-4 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All as Read ({unreadNotificationsCount})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D9E1EF] pb-3 text-xs font-bold">
        {['All', 'Unread', 'Read'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-[#0755C9] text-white shadow-xs'
                : 'bg-white border border-[#D9E1EF] text-[#52627A] hover:bg-slate-50'
            }`}
          >
            {tab} Notifications {tab === 'Unread' && unreadNotificationsCount > 0 && `(${unreadNotificationsCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description={`No ${activeTab.toLowerCase()} notifications at this time.`}
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                markNotificationRead(n.id);
                if (n.link) navigate(n.link);
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                !n.read
                  ? 'bg-white border-[#0755C9] shadow-sm font-semibold'
                  : 'bg-white/80 border-[#D9E1EF] hover:bg-white'
              }`}
            >
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm text-[#0A2342]">{n.title}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getBadgeStyle(n.type)}`}>
                    {n.type}
                  </span>
                </div>
                <p className="text-xs text-[#52627A] leading-relaxed mb-2">{n.message}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{n.timestamp}</span>
                  <span className="text-[#0755C9] font-bold flex items-center gap-1 hover:underline">
                    View Details <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
