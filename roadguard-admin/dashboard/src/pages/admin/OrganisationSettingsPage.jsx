import React, { useEffect, useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { portalApi } from '../../lib/portalApi';
import {
  Settings,
  Building2,
  Sliders,
  Bell,
  Shield,
  User,
  Save,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

export const OrganisationSettingsPage = () => {
  const { settings, saveSettings, resetDemoState, organizationProfile } = useRoadGuard();

  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState(settings);
  const [designationPermissions, setDesignationPermissions] = useState([]);
  const [emailPattern, setEmailPattern] = useState('^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$');
  const [emailPatternMessage, setEmailPatternMessage] = useState('');
  useEffect(() => {
    portalApi('/designations').then(setDesignationPermissions).catch(() => setDesignationPermissions([]));
  }, []);
  useEffect(() => {
    if (organizationProfile?.employeeEmailPattern) setEmailPattern(organizationProfile.employeeEmailPattern);
  }, [organizationProfile?.organizationId]);

  const saveEmailPattern = async () => {
    try {
      const saved = await portalApi('/organization/email-pattern', {
        method: 'PUT', body: JSON.stringify({ pattern: emailPattern })
      });
      setEmailPattern(saved.emailPattern);
      setEmailPatternMessage('Employee email rule saved.');
    } catch (error) { setEmailPatternMessage(error.message); }
  };

  const handleOrgProfileChange = (field, val) => {
    setFormData(prev => ({
      ...prev,
      orgProfile: { ...prev.orgProfile, [field]: val }
    }));
  };

  const handlePriorityRulesChange = (field, val) => {
    setFormData(prev => ({
      ...prev,
      priorityRules: { ...prev.priorityRules, [field]: Number(val) }
    }));
  };

  const handleNotifPrefToggle = (field) => {
    setFormData(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [field]: !prev.notificationPreferences[field]
      }
    }));
  };

  const handlePermissionToggle = async (roleIndex, capField) => {
    const permission = designationPermissions[roleIndex];
    const updated = { ...permission, [capField]: !permission[capField] };
    setDesignationPermissions(prev => prev.map((item, idx) => idx === roleIndex ? updated : item));
    try {
      const saved = await portalApi(`/designations/${encodeURIComponent(permission.designation)}`, {
        method: 'PUT', body: JSON.stringify({
          canReportIssues: updated.canReportIssues,
          canViewAllIssues: updated.canViewAllIssues,
          canUpdateTasks: updated.canUpdateTasks,
          canAssignTasks: updated.canAssignTasks
        })
      });
      setDesignationPermissions(prev => prev.map((item, idx) => idx === roleIndex ? saved : item));
    } catch (error) {
      setDesignationPermissions(prev => prev.map((item, idx) => idx === roleIndex ? permission : item));
      window.alert(error.message);
    }
  };

  const handleProfileAppearanceChange = (field, val) => {
    setFormData(prev => ({
      ...prev,
      profileAppearance: { ...prev.profileAppearance, [field]: val }
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings(formData);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0755C9]" />
            Organisation Settings & Governance
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Configure municipal parameters, hazard priority thresholds, notification policies, and role matrix
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (window.confirm("Reset all settings to default baseline?")) {
                resetDemoState();
              }
            }}
            className="px-3.5 py-2 bg-[#F7F9FD] border border-[#D9E1EF] hover:bg-slate-100 text-[#0A2342] text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D9E1EF] pb-3 text-xs font-bold">
        {[
          { id: 'profile', label: 'Organisation Profile', icon: Building2 },
          { id: 'priority', label: 'Priority Rules', icon: Sliders },
          { id: 'notifications', label: 'Notification Preferences', icon: Bell },
          { id: 'permissions', label: 'Designation Permissions', icon: Shield },
          { id: 'appearance', label: 'Profile & Appearance', icon: User },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-[#0755C9] text-white shadow-xs'
                  : 'bg-white border border-[#D9E1EF] text-[#52627A] hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-[#D9E1EF] shadow-xs space-y-6 text-xs text-[#0A2342]">
        {/* TAB 1: ORG PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0A2342] border-b border-slate-100 pb-2">Municipal Entity Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Organisation Name</label>
                <input
                  type="text"
                  value={formData.orgProfile?.name || ''}
                  onChange={(e) => handleOrgProfileChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Official Domain</label>
                <input
                  type="text"
                  value={formData.orgProfile?.domain || ''}
                  onChange={(e) => handleOrgProfileChange('domain', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Contact Email</label>
                <input
                  type="email"
                  value={formData.orgProfile?.email || ''}
                  onChange={(e) => handleOrgProfileChange('email', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
                />
              </div>
              <div className="md:col-span-2 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <label className="block font-bold text-[#0A2342] mb-1">Employee Email Format Rule</label>
                <p className="text-[11px] text-slate-600 mb-2">Use a Java regular expression. It is checked when an employee requests an OTP and again at registration.</p>
                <input
                  type="text"
                  value={emailPattern}
                  onChange={(e) => { setEmailPattern(e.target.value); setEmailPatternMessage(''); }}
                  placeholder="^[a-zA-Z]+\\.[a-zA-Z0-9]+@yourdomain\\.gov$"
                  className="w-full px-3 py-2 bg-white border border-[#D9E1EF] rounded-lg font-mono text-xs"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={saveEmailPattern} className="px-3 py-1.5 rounded-lg bg-[#0755C9] text-white font-bold">Save email rule</button>
                  {emailPatternMessage && <span role="status" className="text-[11px] text-slate-600">{emailPatternMessage}</span>}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Example: <code>^[a-zA-Z]+\.[a-zA-Z0-9]+@vitapstudent\.ac\.in$</code></p>
              </div>
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Hotline Phone</label>
                <input
                  type="text"
                  value={formData.orgProfile?.contactPhone || ''}
                  onChange={(e) => handleOrgProfileChange('contactPhone', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRIORITY RULES */}
        {activeTab === 'priority' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0A2342] border-b border-slate-100 pb-2">Hazard Elevation & Clustering Thresholds</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Critical Priority Score Threshold (0 - 100)</label>
                <input
                  type="number"
                  value={formData.priorityRules?.criticalScoreThreshold || 85}
                  onChange={(e) => handlePriorityRulesChange('criticalScoreThreshold', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Duplicate Report Grouping Radius (Meters)</label>
                <input
                  type="number"
                  value={formData.priorityRules?.duplicateRadiusMeters || 50}
                  onChange={(e) => handlePriorityRulesChange('duplicateRadiusMeters', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Unattended Hazard Alert Threshold (Hours)</label>
                <input
                  type="number"
                  value={formData.priorityRules?.unattendedWarningHours || 48}
                  onChange={(e) => handlePriorityRulesChange('unattendedWarningHours', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NOTIFICATION PREFERENCES */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0A2342] border-b border-slate-100 pb-2">Dispatch & Operational Alerts</h3>
            <div className="space-y-3">
              {[
                { key: 'criticalAlertsEmail', label: 'Send Email Alerts for Critical Hazards', desc: 'Notify administrators instantly when a hazard priority reaches Critical' },
                { key: 'overdueTasksSms', label: 'Send SMS Reminders for Overdue Tasks', desc: 'Dispatch SMS notifications to field engineers when tasks pass due date' },
                { key: 'employeeRegistrationsWeb', label: 'Web Notifications for Pending Employee Registrations', desc: 'Pop up web alerts when new inspectors register' },
                { key: 'dailyResolutionDigest', label: 'Daily Resolution Summary Digest', desc: 'Send daily summary report of closed issues every evening' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-[#F7F9FD] rounded-lg border border-slate-200">
                  <div>
                    <p className="font-bold text-[#0A2342]">{item.label}</p>
                    <p className="text-[11px] text-[#52627A]">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!formData.notificationPreferences?.[item.key]}
                    onChange={() => handleNotifPrefToggle(item.key)}
                    className="w-4 h-4 accent-[#0755C9] rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: DESIGNATION PERMISSIONS */}
        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0A2342] border-b border-slate-100 pb-2">Designation Capability Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EEF3FF] text-[#52627A] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Role</th>
                    <th className="p-3 text-center">Report Issues</th>
                    <th className="p-3 text-center">View All Issues</th>
                    <th className="p-3 text-center">Update Tasks</th>
                    <th className="p-3 text-center">Eligible for Assignment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {designationPermissions.map((perm, idx) => (
                    <tr key={perm.designation}>
                      <td className="p-3 font-bold text-[#0A2342]">{perm.designation}</td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canReportIssues}
                          onChange={() => handlePermissionToggle(idx, 'canReportIssues')}
                          className="w-4 h-4 accent-[#0755C9]"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canViewAllIssues}
                          className="w-4 h-4 accent-[#0755C9]"
                          onChange={() => handlePermissionToggle(idx, 'canViewAllIssues')}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canUpdateTasks}
                          onChange={() => handlePermissionToggle(idx, 'canUpdateTasks')}
                          className="w-4 h-4 accent-[#0755C9]"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.canAssignTasks}
                          onChange={() => handlePermissionToggle(idx, 'canAssignTasks')}
                          className="w-4 h-4 accent-[#0755C9]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PROFILE & APPEARANCE */}
        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0A2342] border-b border-slate-100 pb-2">Administrator Credentials & Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Admin Display Name</label>
                <input
                  type="text"
                  value={formData.profileAppearance?.adminName || ''}
                  onChange={(e) => handleProfileAppearanceChange('adminName', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Admin Designation</label>
                <input
                  type="text"
                  value={formData.profileAppearance?.adminDesignation || ''}
                  onChange={(e) => handleProfileAppearanceChange('adminDesignation', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Admin Email</label>
                <input
                  type="email"
                  value={formData.profileAppearance?.adminEmail || ''}
                  onChange={(e) => handleProfileAppearanceChange('adminEmail', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="submit"
            className="px-5 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};
