import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  INITIAL_SETTINGS
} from '../data/mockData';
import { authHeaders, portalApi } from '../lib/portalApi';

// Use the API server that delivered the dashboard so live issues stay in sync.
const API_BASE = window.location.origin;

const defaultSettingsForProfile = (profile = {}) => ({
  ...INITIAL_SETTINGS,
  orgProfile: {
    ...INITIAL_SETTINGS.orgProfile,
    name: profile.organizationName || '',
    email: profile.email || '',
    domain: profile.email?.split('@')[1] || '',
    contactPhone: '',
    address: ''
  },
  designationPermissions: [],
  profileAppearance: {
    ...INITIAL_SETTINGS.profileAppearance,
    adminName: profile.name || '',
    adminDesignation: profile.designation || 'Organization Admin',
    adminEmail: profile.email || ''
  }
});

const RoadGuardContext = createContext();

export const RoadGuardProvider = ({ children }) => {
  // Citizen issues come only from the backend. Old demo rows in localStorage
  // must never be presented as reported incidents.
  const [issues, setIssues] = useState([]);
  const [commandCenterSimulations, setCommandCenterSimulations] = useState([]);
  const [issuesLoaded, setIssuesLoaded] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [accessRoles, setAccessRoles] = useState([]);
  const [employeeTransferRequests, setEmployeeTransferRequests] = useState([]);

  const [tasks, setTasks] = useState([]);
  const [taskHistoryEvents, setTaskHistoryEvents] = useState([]);
  const [organizationProfile, setOrganizationProfile] = useState(null);
  const organizationProfileCache = useRef({ value: null, updatedAt: 0 });

  const [notifications, setNotifications] = useState([]);
  const [systemNotifications, setSystemNotifications] = useState([]);

  const [auditLogs, setAuditLogs] = useState([]);
  const [issueEventLogs, setIssueEventLogs] = useState([]);

  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  const [toast, setToast] = useState(null);

  // These are PostgreSQL-backed records; clear obsolete browser-only caches.
  useEffect(() => {
    for (const key of ['rg_issues', 'rg_employees', 'rg_tasks', 'rg_notifications', 'rg_audit_logs', 'rg_settings']) {
      try { localStorage.removeItem(key); } catch { /* storage may be unavailable */ }
    }
  }, []);

  // Toast Helper
  const showToast = (message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Audit Log Helper
  const logAuditEvent = (actor, eventType, targetEntity, description, result = 'SUCCESS') => {
    const newLog = {
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      actor,
      eventType,
      targetEntity,
      description,
      result
    };
    portalApi('/audit-events', { method: 'POST', body: JSON.stringify(newLog) })
      .then(() => portalApi('/audit-events'))
      .then(saved => setAuditLogs(saved))
      .catch(error => console.error('Could not save audit activity to PostgreSQL:', error.message));
  };

  // Issue Handlers
  const updateIssue = async (issueId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(issueId)}`, {
        method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error(await response.text());
      await syncFromBackend();
    } catch (error) { showToast(`Could not update issue: ${error.message}`, 'error'); }
  };

  const addAdminNote = (issueId, text) => {
    if (!text.trim()) return;
    const author = settings.profileAppearance?.adminName || "Admin";
    const newNote = {
      id: Date.now(),
      author,
      text,
      timestamp: new Date().toLocaleString()
    };
    const issue = issues.find(item => String(item.id) === String(issueId));
    const savedNotes = [...(issue?.adminNotes || []), newNote].map(note => ({
      id: note.id, actor: note.author, note: note.text, timestamp: note.timestamp
    }));
    fetch(`${API_BASE}/api/issues/${encodeURIComponent(issueId)}`, {
      method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ admin_notes: savedNotes })
    }).then(async response => {
      if (!response.ok) throw new Error(await response.text());
      await syncFromBackend();
      logAuditEvent(author, 'ADMIN_NOTE_ADDED', issueId, `Added administrative note to issue ${issueId}`);
      showToast(`Note added to ${issueId}`, 'success');
    }).catch(error => showToast(`Could not save note: ${error.message}`, 'error'));
  };

  const assignEmployeeToIssue = async (issueId, employeeId, employeeNameOverride = null) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp && !employeeNameOverride) throw new Error('Assigned employee could not be found');
    const assignedName = employeeNameOverride || emp.name;
    const current = issues.find(item => String(item.id) === String(issueId));
    const newHistoryEntry = {
      timestamp: new Date().toISOString(), status: 'Assigned',
      actor: settings.profileAppearance?.adminName || 'Admin',
      note: `Assigned to ${assignedName}${emp?.designation ? ` (${emp.designation})` : ''}`
    };
    const history = [...(current?.taskHistory || []), newHistoryEntry];
    const response = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(issueId)}`, {
      method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: current?.status === 'Unassigned' ? 'Assigned' : current?.status, assignedEmployeeId: Number(employeeId), assignedEmployeeName: assignedName, task_history: history, actor: settings.profileAppearance?.adminName || 'Admin' })
    });
    if (!response.ok) throw new Error(await response.text());

    setIssues(prev =>
      prev.map(item => {
        if (item.id === issueId) {
          const newHistory = [
            ...(item.taskHistory || []),
            {
              timestamp: new Date().toLocaleString(),
              status: "Assigned",
              actor: settings.profileAppearance?.adminName || "Admin",
              note: newHistoryEntry.note
            }
          ];
          return {
            ...item,
            status: item.status === "Unassigned" ? "Assigned" : item.status,
            assignedEmployeeId: emp?.id || String(employeeId),
            assignedEmployeeName: assignedName,
            taskHistory: newHistory,
            lastUpdated: new Date().toLocaleString()
          };
        }
        return item;
      })
    );

    // Increment employee assigned task count
    if (emp) setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, assignedTasks: (e.assignedTasks || 0) + 1 } : e));

    showToast(`Issue ${issueId} assigned to ${assignedName}`, 'success');
  };

  const resolveIssue = async (issueId, resolutionNotes = "") => {
    const currentAdmin = settings.profileAppearance?.adminName || "Admin";
    try {
      const response = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(issueId)}`, {
        method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'Resolved', resolutionNotes: resolutionNotes || 'Issue resolved successfully by team.', resolutionDate: new Date().toISOString(), actor: currentAdmin })
      });
      if (!response.ok) throw new Error(await response.text());
      await syncFromBackend();
    } catch (error) { showToast(`Could not resolve issue: ${error.message}`, 'error'); return; }
    showToast(`Issue ${issueId} marked as Resolved`, 'success');
  };

  const reopenIssue = async (issueId) => {
    const currentAdmin = settings.profileAppearance?.adminName || "Admin";
    try {
      const response = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(issueId)}`, {
        method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'In Progress', resolutionNotes: null, resolutionDate: null, actor: currentAdmin })
      });
      if (!response.ok) throw new Error(await response.text());
      await syncFromBackend();
    } catch (error) { showToast(`Could not reopen issue: ${error.message}`, 'error'); return; }
    showToast(`Issue ${issueId} reopened`, 'info');
  };

  // Task Handlers
  const createTask = async (taskData) => {
    let issueBefore = null;
    let assignedTarget = null;
    try {
      if (taskData.departmentId) {
        const saved = await portalApi('/tasks/assign-department', { method: 'POST', body: JSON.stringify({
          departmentId: Number(taskData.departmentId), title: taskData.title, description: taskData.description || '',
          priority: taskData.priority || 'Medium', dueDate: taskData.dueDate || ''
        }) });
        const departmentTask = { ...saved, id: String(saved.id), assignedEmployeeId: '', assignedEmployeeName: saved.departmentName ? `Department: ${saved.departmentName}` : 'Department assignment' };
        setTasks(prev => [departmentTask, ...prev]);
        showToast(`Task ${saved.id} assigned to department`, 'success');
        return true;
      }
      // Persist the linked issue assignment first. This keeps simulation reports
      // and citizen issues on the same path and prevents creating an unlinked task
      // when the issue service rejects the assignment.
      if (taskData.linkedIssueId) {
        const targetEmployee = taskData.assignedEmployeeId
          ? employees.find(employee => employee.id === String(taskData.assignedEmployeeId))
          : employees.find(employee => employee.status === 'Active' && employee.designation === taskData.designation);
        if (!targetEmployee) throw new Error('Choose an active employee for this simulation report');
        assignedTarget = targetEmployee;
        issueBefore = issues.find(item => String(item.id) === String(taskData.linkedIssueId));
        await assignEmployeeToIssue(taskData.linkedIssueId, targetEmployee.id, targetEmployee.name);
      }
      const saved = await portalApi('/tasks', { method: 'POST', body: JSON.stringify({
        title: taskData.title,
        description: taskData.description || '',
        issueId: taskData.linkedIssueId || '',
        employeeId: taskData.assignedEmployeeId ? Number(taskData.assignedEmployeeId) : null,
        designation: taskData.designation || null,
        priority: taskData.priority || 'Medium',
        dueDate: taskData.dueDate || ''
      }) });
      const newTaskId = String(saved.id);
      const newTask = { ...saved, id: newTaskId, linkedIssueId: saved.issueId, assignedEmployeeId: String(saved.employeeId), assignedEmployeeName: saved.employeeName };
      setTasks(prev => [newTask, ...prev]);
      showToast(`Task ${newTaskId} created successfully`, 'success');
      return true;
    } catch (error) {
      // If task creation fails after linking the issue, restore its previous
      // assignment so the report does not claim a task exists when it does not.
      if (taskData.linkedIssueId && issueBefore && assignedTarget) {
        try {
          const rollback = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(taskData.linkedIssueId)}`, {
            method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              status: issueBefore.status,
              assignedEmployeeId: issueBefore.assignedEmployeeId ?? null,
              assignedEmployeeName: issueBefore.assignedEmployeeName ?? null,
              task_history: issueBefore.taskHistory || [],
              actor: settings.profileAppearance?.adminName || 'Admin'
            })
          });
          if (rollback.ok) await syncFromBackend();
        } catch { /* keep the original task error visible */ }
      }
      showToast(`Could not assign task: ${error.message}`, 'error');
      return false;
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const saved = await portalApi(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, ...saved, id: String(saved.id), linkedIssueId: saved.issueId } : t));
    } catch (error) { showToast(error.message, 'error'); return; }

    showToast(`Task ${taskId} status updated to ${newStatus}`, 'info');
  };

  // Employee Handlers
  const mapEmployee = (employee) => ({
    ...employee,
    id: String(employee.id),
    name: employee.fullName,
    status: employee.approvalStatus === 'APPROVED'
      ? (employee.accountActive === false ? 'Deactivated' : 'Active')
      : employee.approvalStatus === 'REJECTED' ? 'Rejected' : 'Pending Approval',
    assignedTasks: 0,
    completedTasks: 0
  });

  const approveEmployee = async (empId) => {
    const currentAdmin = settings.profileAppearance?.adminName || "Admin";
    const emp = employees.find(e => e.id === empId);
    const replaceExistingHead = emp?.departmentRole === 'HEAD';
    try {
      const updated = await portalApi(`/employees/${empId}/approval`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED', replaceExistingHead }) });
      setEmployees(prev => prev.map(e => e.id === String(empId) ? mapEmployee(updated) : e));
    } catch (error) { showToast(error.message, 'error'); return; }

    logAuditEvent(currentAdmin, "EMPLOYEE_APPROVED", empId, `Approved registration for ${emp?.name || empId}`);
    showToast(`Employee ${emp?.name} registration approved!`, 'success');
  };

  const approveEmployeeAsAdmin = async (empId) => {
    const emp = employees.find(e => e.id === empId);
    const authorityType = window.prompt('Authority type for the additional Admin (for example IAS, IPS, Municipal Commissioner):');
    if (authorityType == null || !authorityType.trim()) return;
    const authorityTitle = window.prompt('Designation to display for this Admin (for example District Collector):');
    if (authorityTitle == null || !authorityTitle.trim()) return;
    try {
      await portalApi(`/employees/${empId}/approval`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED', accountRole: 'ADMIN', authorityType: authorityType.trim(), authorityTitle: authorityTitle.trim() }) });
      setEmployees(previous => previous.filter(e => e.id !== String(empId)));
      logAuditEvent(settings.profileAppearance?.adminName || 'Admin', 'ADDITIONAL_ADMIN_APPROVED', empId, `Approved ${emp?.name || empId} as Admin (${authorityType.trim()}, ${authorityTitle.trim()}).`);
      showToast(`${emp?.name || 'Account'} approved as an additional Admin.`, 'success');
    } catch (error) { showToast(error.message, 'error'); }
  };

  const rejectEmployee = async (empId) => {
    const currentAdmin = settings.profileAppearance?.adminName || "Admin";
    const emp = employees.find(e => e.id === empId);

    try {
      const updated = await portalApi(`/employees/${empId}/approval`, { method: 'PATCH', body: JSON.stringify({ status: 'REJECTED' }) });
      setEmployees(prev => prev.map(e => e.id === String(empId) ? mapEmployee(updated) : e));
    } catch (error) { showToast(error.message, 'error'); return; }

    logAuditEvent(currentAdmin, "EMPLOYEE_REJECTED", empId, `Rejected registration for ${emp?.name || empId}`);
    showToast(`Registration for ${emp?.name} rejected`, 'warning');
  };

  const toggleEmployeeStatus = async (empId) => {
    const currentAdmin = settings.profileAppearance?.adminName || "Admin";
    let newStatus = "Active";

    const employee = employees.find(e => e.id === empId);
    newStatus = employee?.status === 'Active' ? 'Deactivated' : 'Active';
    try {
      const updated = await portalApi(`/employees/${empId}/active`, { method: 'PATCH', body: JSON.stringify({ active: newStatus === 'Active' }) });
      setEmployees(prev => prev.map(e => e.id === String(empId) ? mapEmployee(updated) : e));
    } catch (error) { showToast(error.message, 'error'); return; }

    logAuditEvent(currentAdmin, "EMPLOYEE_STATUS_TOGGLE", empId, `Changed employee status to ${newStatus}`);
    showToast(`Employee status updated to ${newStatus}`, 'info');
  };

  const updateEmployeeDesignation = async (empId, newDesignation) => {
    const currentAdmin = settings.profileAppearance?.adminName || "Admin";
    try {
      const updated = await portalApi(`/employees/${empId}/designation`, { method: 'PATCH', body: JSON.stringify({ designation: newDesignation }) });
      setEmployees(prev => prev.map(e => e.id === String(empId) ? mapEmployee(updated) : e));
    } catch (error) { showToast(error.message, 'error'); return; }

    logAuditEvent(currentAdmin, "EMPLOYEE_ROLE_UPDATED", empId, `Updated designation to ${newDesignation}`);
    showToast(`Designation updated to ${newDesignation}`, 'success');
  };

  const saveAccessRole = async (role) => {
    try {
      const saved = await portalApi(role.id ? `/admin/roles/${role.id}` : '/admin/roles', {
        method: role.id ? 'PUT' : 'POST',
        body: JSON.stringify({ name: role.name, description: role.description || '', permissions: role.permissions || [] })
      });
      await syncOrganizationData();
      showToast(`Access role “${saved.name}” saved.`, 'success');
      return saved;
    } catch (error) { showToast(error.message, 'error'); throw error; }
  };

  const deleteAccessRole = async (roleId) => {
    try {
      await portalApi(`/admin/roles/${roleId}`, { method: 'DELETE' });
      await syncOrganizationData();
      showToast('Role deleted and access revoked from assigned employees.', 'success');
    } catch (error) { showToast(error.message, 'error'); throw error; }
  };

  const updateEmployeeAccess = async (employeeId, access) => {
    try {
      await portalApi(`/admin/employees/${employeeId}/access`, {
        method: 'PUT', body: JSON.stringify({ roleId: access.roleId || null, managerId: access.managerId || null })
      });
      await syncOrganizationData();
      showToast('Employee access and reporting manager updated.', 'success');
    } catch (error) { showToast(error.message, 'error'); throw error; }
  };

  // Notification Handlers
  const markNotificationRead = (id) => {
    if (systemNotifications.some(notification => String(notification.id) === String(id))) {
      portalApi(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }).catch(() => {});
      setSystemNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      return;
    }
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllNotificationsRead = () => {
    portalApi('/notifications/read-all', { method: 'POST' }).catch(() => {});
    setSystemNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast("All notifications marked as read", 'info');
  };

  // Settings Handler
  const saveSettings = async (newSettings) => {
    try {
      const saved = await portalApi('/organization/dashboard-settings', {
        method: 'PUT', body: JSON.stringify(newSettings)
      });
      setSettings(saved);
      logAuditEvent(saved.profileAppearance?.adminName || 'Admin', 'SETTINGS_UPDATED', 'ORG_CONFIG', 'Updated organisation settings and priority thresholds');
      showToast('Organisation settings saved to the database.', 'success');
    } catch (error) { showToast(`Could not save settings: ${error.message}`, 'error'); }
  };

  // Reset Demo State Handler
  const resetDemoState = () => {
    saveSettings(defaultSettingsForProfile(organizationProfile));
  };

  // ── Sync real citizen reports from backend ──
  const syncFromBackend = useCallback(async () => {
    try {
      const [res, statsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/issues`),
        fetch(`${API_BASE}/api/stats`).catch(() => null)
      ]);
      if (!res.ok) return;
      const data = await res.json();
      if (statsResponse?.ok) {
        const stats = await statsResponse.json();
        setCommandCenterSimulations(Array.isArray(stats.simulations) ? stats.simulations : []);
      }
      setIssuesLoaded(true);
      const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
      if (auth?.role === 'ADMIN') {
        fetch(`${API_BASE}/api/system/events?limit=200`, { headers: authHeaders() })
          .then(response => response.ok ? response.json() : [])
          .then(events => setIssueEventLogs(Array.isArray(events) ? events : []))
          .catch(() => setIssueEventLogs([]));
      } else {
        setIssueEventLogs([]);
      }
      const backendIssues = (data.issues || []).map(issue => ({
        // Map backend fields → admin dashboard schema
        id: issue.id,
        title: issue.type || 'Citizen Report',
        category: mapTypeToCategory(issue.type),
        description: issue.description || 'No description available.',
        locationName: issue.location || 'GPS Coordinates',
        latitude: issue.coords ? issue.coords[0] : 0,
        longitude: issue.coords ? issue.coords[1] : 0,
        reportCount: issue.report_count || 1,
        priorityScore: issue.priority_score || 1,
        // Duplicate counts above five are always shown as High, including older
        // backend rows whose stored label may still say Critical.
        priority: (issue.report_count || 1) > 5
          ? 'High'
          : (issue.priority || priorityFromScore(issue.priority_score || 1)),
        // Normalize older/lowercase backend status values so resolved issues are
        // excluded consistently from active queues and dashboard totals.
        status: String(issue.status || 'Unassigned').toLowerCase() === 'resolved' ? 'Resolved'
          : String(issue.status || 'Unassigned').toLowerCase() === 'in progress' ? 'In Progress'
          : String(issue.status || 'Unassigned').toLowerCase() === 'assigned' ? 'Assigned'
          : String(issue.status || 'Unassigned').toLowerCase() === 'unassigned' ? 'Unassigned'
          : issue.status || 'Unassigned',
        severity: issue.severity || 'MEDIUM',
        assignedEmployeeId: issue.assignedEmployeeId || null,
        assignedEmployeeName: issue.assignedEmployeeName || null,
        reportedDate: issue.reported_at ? new Date(issue.reported_at).toLocaleDateString() : 'Date unavailable',
        reportedAt: issue.reported_at || issue.created_at || null,
        resolutionDate: issue.resolutionDate || issue.resolution_date || null,
        lastUpdated: issue.last_updated || null,
        // photos: thumbnail only for list view (full photos fetched on demand)
        photos: issue.thumbnail ? [issue.thumbnail] : [],
        photo_count: issue.photo_count || 0,
        adminNotes: (issue.admin_notes || []).map(n => ({
          id: n.id || Date.now(),
          author: n.actor || 'Admin',
          text: n.note || '',
          timestamp: n.timestamp || new Date().toLocaleString()
        })),
        taskHistory: (issue.task_history || []).map(h => ({
          timestamp: h.timestamp || '',
          status: h.status || '',
          actor: h.actor || 'System',
          note: h.note || ''
        })),
        isFromBackend: true,
      }));

      // The backend response is authoritative, including an empty result.
      // Deduplicate by canonical issue ID in case an API response repeats a row.
      const uniqueIssues = [...new Map(backendIssues.map(issue => [String(issue.id), issue])).values()];
      setIssues(uniqueIssues.sort(
        (a, b) => (b.priorityScore || 0) - (a.priorityScore || 0)
      ));
    } catch (err) {
      // Do not fall back to cached/demo reports when the source of truth is unavailable.
      setIssues([]);
      setIssuesLoaded(true);
      console.error('Unable to load real issues from backend:', err.message);
    }
  }, []);

  // Helper: map incident type string → admin dashboard category
  function mapTypeToCategory(type) {
    if (!type) return 'Road Hazard';
    const t = type.toLowerCase();
    if (t.includes('blockage') || t.includes('roadblock') || t.includes('blocked') || t.includes('road closure') || t.includes('closed road') || t.includes('obstruction')) return 'Road Blockage';
    if (t.includes('pothole') || t.includes('damage') || t.includes('crack')) return 'Pothole';
    if (t.includes('flood') || t.includes('water')) return 'Waterlogging / Flood';
    if (t.includes('accident') || t.includes('crash')) return 'Accident';
    if (t.includes('tree') || t.includes('debris')) return 'Fallen Tree / Debris';
    if (t.includes('signal') || t.includes('traffic')) return 'Broken Traffic Signal';
    if (t.includes('breakdown') || t.includes('vehicle')) return 'Vehicle Breakdown';
    return 'Road Hazard';
  }

  function priorityFromScore(score) {
    if (score >= 3) return 'High';
    if (score >= 2) return 'Medium';
    return 'Low';
  }

  const syncOrganizationData = useCallback(async () => {
    const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
    if (!auth?.username || auth.role === 'EMPLOYEE') { organizationProfileCache.current = { value: null, updatedAt: 0 }; setEmployees([]); setAccessRoles([]); setEmployeeTransferRequests([]); setTasks([]); setTaskHistoryEvents([]); setOrganizationProfile(null); setSystemNotifications([]); setAuditLogs([]); return; }
    try {
      const refreshProfile = !organizationProfileCache.current.value || Date.now() - organizationProfileCache.current.updatedAt >= 60000;
      const [profileResponse, serverTasks, alerts] = await Promise.all([
        refreshProfile ? portalApi('/me').catch(error => { console.error('Unable to load organization profile:', error.message); return null; }) : Promise.resolve(organizationProfileCache.current.value),
        portalApi('/tasks').catch(error => { console.error('Unable to load organization tasks:', error.message); return null; }),
        portalApi('/notifications').catch(() => [])
      ]);
      const profile = profileResponse || organizationProfileCache.current.value;
      if (profileResponse) {
        organizationProfileCache.current = { value: profileResponse, updatedAt: Date.now() };
        setOrganizationProfile(profileResponse);
      }
      setSystemNotifications(alerts);
      // Profile settings are independent of task loading; keep them current even
      // if the task endpoint is temporarily unavailable.
      if (!profile) return;
      if (profile.dashboardSettings) {
        try { setSettings(JSON.parse(profile.dashboardSettings)); }
        catch (error) {
          console.error('Saved organization settings are invalid:', error.message);
          setSettings(defaultSettingsForProfile(profile));
        }
      } else if (profile.role === 'ADMIN') setSettings(defaultSettingsForProfile(profile));
      // A task endpoint failure should not hide a successfully loaded profile
      // or replace the last task list with an empty one.
      if (!Array.isArray(serverTasks)) return;
      const mappedTasks = serverTasks.map(task => ({
        ...task,
        id: String(task.id),
        linkedIssueId: task.issueId,
        assignedEmployeeId: String(task.employeeId),
        assignedEmployeeName: task.employeeName,
        createdDate: task.createdAt?.slice(0, 10),
        dueDate: task.dueDate || ''
      }));
      setTasks(mappedTasks);
      if (profile.role === 'ADMIN') {
        const [serverEmployees, transferRequests, historyEvents, savedAuditEvents, serverRoles] = await Promise.all([
          portalApi('/employees'), portalApi('/employees/organization-change-requests').catch(() => []), portalApi('/tasks/history').catch(() => []), portalApi('/audit-events').catch(() => []), portalApi('/admin/roles').catch(() => [])
        ]);
        setTaskHistoryEvents(historyEvents);
        setAuditLogs(savedAuditEvents);
        const taskCounts = new Map();
        mappedTasks.forEach(task => {
          const counts = taskCounts.get(task.assignedEmployeeId) || { assignedTasks: 0, completedTasks: 0 };
          if (task.status === 'Resolved') counts.completedTasks += 1;
          else counts.assignedTasks += 1;
          taskCounts.set(task.assignedEmployeeId, counts);
        });
        setEmployees(serverEmployees.map(employee => ({ ...mapEmployee(employee), ...(taskCounts.get(String(employee.id)) || {}) })));
        setAccessRoles(serverRoles);
        setEmployeeTransferRequests(transferRequests.map(mapEmployee));
      } else { setEmployees([]); setAccessRoles([]); setEmployeeTransferRequests([]); setTaskHistoryEvents([]); }
    } catch (error) {
      console.error('Unable to load organization data:', error.message);
    }
  }, []);

  const updateProfileImage = async (profileImage) => {
    const result = await portalApi('/me/profile-image', { method: 'PUT', body: JSON.stringify({ profileImage }) });
    const updatedProfile = { ...(organizationProfileCache.current.value || {}), profileImage: result.profileImage || null };
    organizationProfileCache.current = { value: updatedProfile, updatedAt: Date.now() };
    setOrganizationProfile(prev => ({ ...(prev || {}), profileImage: result.profileImage || null }));
    return result.profileImage || null;
  };

  const reviewEmployeeTransfer = async (employeeId, status) => {
    try {
      await portalApi(`/employees/${employeeId}/organization-change`, {
        method: 'PATCH', body: JSON.stringify({ status })
      });
      await syncOrganizationData();
      showToast(status === 'APPROVED' ? 'Employee organization change approved.' : 'Employee organization change rejected.', status === 'APPROVED' ? 'success' : 'info');
    } catch (error) { showToast(error.message, 'error'); }
  };

  useEffect(() => {
    let stopped = false;
    let timer;
    const poll = async () => {
      await syncOrganizationData();
      if (!stopped) timer = setTimeout(poll, 15000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [syncOrganizationData]);

  // Poll backend every 15 seconds for live updates; schedule after each
  // request completes so slow database responses cannot stack up.
  useEffect(() => {
    let stopped = false;
    let timer;
    const poll = async () => {
      await syncFromBackend();
      if (!stopped) timer = setTimeout(poll, 15000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [syncFromBackend]);

  // Derived Statistics
  const combinedNotifications = [...systemNotifications, ...notifications.filter(n => !String(n.id).startsWith('overdue:'))];
  const unreadNotificationsCount = combinedNotifications.filter(n => !n.read).length;
  const activeIssues = issues.filter(i => String(i.status || '').toLowerCase() !== "resolved");
  const resolvedIssuesList = issues.filter(i => String(i.status || '').toLowerCase() === "resolved");
  const pendingIssues = issues.filter(i => i.status === "Unassigned");
  const highPriorityIssues = issues.filter(i => (i.priority === "Critical" || i.priority === "High") && i.status !== "Resolved");
  const inProgressIssues = issues.filter(i => i.status === "In Progress");
  const activeEmployeesCount = employees.filter(e => e.status === "Active").length;

  return (
    <RoadGuardContext.Provider
      value={{
        issues,
        commandCenterSimulations,
        issuesLoaded,
        activeIssues,
        resolvedIssuesList,
        pendingIssues,
        highPriorityIssues,
        inProgressIssues,
        employees,
        accessRoles,
        employeeTransferRequests,
        organizationProfile,
        activeEmployeesCount,
        tasks,
        taskHistoryEvents,
        notifications: combinedNotifications,
        unreadNotificationsCount,
        auditLogs: [...auditLogs, ...issueEventLogs].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)),
        settings,
        toast,
        updateIssue,
        addAdminNote,
        assignEmployeeToIssue,
        resolveIssue,
        reopenIssue,
        createTask,
        updateTaskStatus,
        approveEmployee,
        approveEmployeeAsAdmin,
        rejectEmployee,
        toggleEmployeeStatus,
        updateEmployeeDesignation,
        saveAccessRole,
        deleteAccessRole,
        updateEmployeeAccess,
        markNotificationRead,
        markAllNotificationsRead,
        saveSettings,
        resetDemoState,
        showToast,
        logAuditEvent,
        syncFromBackend,
        syncOrganizationData,
        updateProfileImage,
        reviewEmployeeTransfer
      }}
    >
      {children}
    </RoadGuardContext.Provider>
  );
};

export const useRoadGuard = () => {
  const context = useContext(RoadGuardContext);
  if (!context) {
    throw new Error('useRoadGuard must be used within a RoadGuardProvider');
  }
  return context;
};
