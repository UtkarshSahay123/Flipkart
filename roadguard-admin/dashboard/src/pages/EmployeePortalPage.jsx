import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarClock, CheckCircle2, ClipboardList, Clock3, ExternalLink, Image as ImageIcon, MapPin, RefreshCw, Search, Upload, UserRound, UsersRound } from 'lucide-react';
import { endSession, portalApi, startSessionActivityMonitor } from '../lib/portalApi';
import { ProfileAvatar } from '../components/common/ProfileAvatar';
import { AccountSecurityPanel } from '../components/common/AccountSecurityPanel';

const filters = ['All', 'Assigned', 'In Progress', 'Resolved'];

export function EmployeePortalPage() {
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [organizationTasks, setOrganizationTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [issueCatalog, setIssueCatalog] = useState([]);
  const [issueCatalogLoading, setIssueCatalogLoading] = useState(false);
  const [subordinates, setSubordinates] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [delegateTarget, setDelegateTarget] = useState(null);
  const [delegateEmployeeId, setDelegateEmployeeId] = useState('');
  const [delegateTitle, setDelegateTitle] = useState('');
  const [delegateNotes, setDelegateNotes] = useState('');
  const [delegatePriority, setDelegatePriority] = useState('Medium');
  const [delegateDueDate, setDelegateDueDate] = useState('');
  const [delegating, setDelegating] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [changeBusy, setChangeBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const me = await portalApi('/me');
      const canAssignTasks = (me.permissions || []).includes('TASK_ASSIGN');
      const canViewIssues = (me.permissions || []).includes('ISSUE_VIEW_ALL');
      setIssueCatalogLoading(canViewIssues);
      const [assigned, events, alerts, directReports, issueResponse, members, statusBoard] = await Promise.all([
        portalApi('/tasks'), portalApi('/me/history'), portalApi('/notifications').catch(() => []),
        canAssignTasks ? portalApi('/me/subordinates') : Promise.resolve([]),
        canViewIssues ? portalApi('/issues').catch(() => null) : Promise.resolve(null),
        portalApi('/me/organization-members').catch(() => []), portalApi('/tasks/status-board').catch(() => [])
      ]);
      setProfile(me);
      setTasks(assigned);
      setOrganizationTasks(Array.isArray(statusBoard) ? statusBoard : []);
      setHistory(events);
      setNotifications(alerts);
      setSubordinates(directReports);
      setOrganizationMembers(Array.isArray(members) ? members : []);
      setIssueCatalog(Array.isArray(issueResponse?.issues) ? issueResponse.issues : []);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); setIssueCatalogLoading(false); }
  }, []);

  const markNotificationRead = async id => {
    setNotifications(previous => previous.map(item => item.id === id ? { ...item, read: true } : item));
    try { await portalApi(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }); }
    catch (e) { setError(e.message); }
  };

  const markAllNotificationsRead = async () => {
    setNotifications(previous => previous.map(item => ({ ...item, read: true })));
    try { await portalApi('/notifications/read-all', { method: 'POST' }); }
    catch (e) { setError(e.message); }
  };

  useEffect(() => {
    const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
    if (!auth?.accessToken) { sessionStorage.removeItem('roadguard.auth'); window.location.replace('/admin/signin.html'); return; }
    if (auth.role !== 'EMPLOYEE') { window.location.replace('/admin/issues'); return; }
    const stopSessionMonitor = startSessionActivityMonitor();
    refresh();
    const timer = setInterval(() => refresh(true), 5000);
    return () => { clearInterval(timer); stopSessionMonitor(); };
  }, [refresh]);

  useEffect(() => {
    const permissions = profile?.permissions || [];
    if (tab === 'Issues' && !permissions.includes('ISSUE_VIEW_ALL')) setTab('Overview');
    if (delegateTarget && !permissions.includes('TASK_ASSIGN')) setDelegateTarget(null);
  }, [profile?.permissions, tab, delegateTarget]);

  const counts = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter(t => t.status === 'In Progress').length,
    assigned: tasks.filter(t => !['In Progress', 'Resolved', 'Cancelled'].includes(t.status)).length,
    resolved: tasks.filter(t => t.status === 'Resolved').length
  }), [tasks]);

  const visibleTasks = useMemo(() => tasks.filter(task => {
    const matchesFilter = filter === 'All' || task.status === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [task.title, task.description, task.issueId, task.status].some(v => String(v || '').toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  }), [tasks, filter, search]);

  const setTaskStatus = async (task, status) => {
    setBusy(task.id); setError('');
    try {
      await portalApi(`/tasks/${task.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (status === 'Resolved' && task.issueId && (profile?.permissions || []).includes('ISSUE_RESOLVE')) {
        await portalApi(`/issues/${encodeURIComponent(task.issueId)}/resolve`, { method: 'POST', body: JSON.stringify({
          resolutionNotes: `Resolved by ${profile?.name || 'assigned employee'}`,
          resolutionDate: new Date().toISOString(), actor: profile?.name || 'Employee'
        }) });
      }
      await refresh(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  const openDelegation = task => {
    const due = new Date();
    due.setDate(due.getDate() + 2);
    setDelegateTarget(task);
    setDelegateEmployeeId('');
    setDelegateTitle(`Follow-up: ${task.title}`.slice(0, 160));
    setDelegateNotes('');
    setDelegatePriority(task.priority || 'Medium');
    setDelegateDueDate(due.toISOString().slice(0, 10));
  };

  const submitDelegation = async event => {
    event.preventDefault();
    if (!delegateTarget || !delegateEmployeeId) return;
    setDelegating(true); setError('');
    try {
      await portalApi('/tasks', { method: 'POST', body: JSON.stringify({
        title: delegateTitle.trim(), description: delegateNotes.trim() || delegateTarget.description || '',
        issueId: delegateTarget.issueId || '', employeeId: Number(delegateEmployeeId),
        parentTaskId: Number(delegateTarget.id), priority: delegatePriority, dueDate: delegateDueDate
      }) });
      setDelegateTarget(null);
      setNotice('Task delegated successfully. The new assignment is now visible in your task list.');
      await refresh(true);
    } catch (e) { setError(e.message); }
    finally { setDelegating(false); }
  };

  const resolveCatalogIssue = async issue => {
    setBusy(`issue-${issue.id}`); setError('');
    try {
      await portalApi(`/issues/${encodeURIComponent(issue.id)}/resolve`, { method: 'POST', body: JSON.stringify({
        resolutionNotes: `Resolved by ${profile?.name || 'employee'}`,
        resolutionDate: new Date().toISOString(), actor: profile?.name || 'Employee'
      }) });
      setNotice(`Issue ${issue.id} marked resolved.`);
      await refresh(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a PNG, JPEG, or WebP image up to 10 MB.'); event.target.value = ''; return;
    }
    setImageBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await portalApi('/me/profile-image', { method: 'PUT', body: JSON.stringify({ profileImage: reader.result }) });
        setProfile(prev => ({ ...prev, profileImage: reader.result }));
      } catch (e) { setError(e.message); }
      finally { setImageBusy(false); }
    };
    reader.onerror = () => { setImageBusy(false); setError('Could not read that image.'); };
    reader.readAsDataURL(file);
  };

  const removeAvatar = async () => {
    setImageBusy(true);
    try { await portalApi('/me/profile-image', { method: 'PUT', body: JSON.stringify({ profileImage: null }) }); setProfile(prev => ({ ...prev, profileImage: null })); }
    catch (e) { setError(e.message); }
    finally { setImageBusy(false); }
  };

  const requestOrganizationChange = async (event) => {
    event.preventDefault();
    setChangeBusy(true); setError('');
    try {
      const result = await portalApi('/me/organization-change', { method: 'POST', body: JSON.stringify({ joinCode }) });
      setProfile(prev => ({ ...prev, organizationChangeStatus: result.status, pendingOrganizationName: result.organizationName }));
      setJoinCode(''); setShowChangeForm(false);
    } catch (e) { setError(e.message); }
    finally { setChangeBusy(false); }
  };

  const logout = async () => { await endSession(); window.location.href = '/admin/signin.html'; };
  const activeTasks = tasks.filter(t => !['Resolved', 'Cancelled'].includes(t.status));
  const canUpdateTasks = (profile?.permissions || []).includes('TASK_UPDATE');
  const canAssignTasks = (profile?.permissions || []).includes('TASK_ASSIGN');
  const canViewIssues = (profile?.permissions || []).includes('ISSUE_VIEW_ALL');
  const canResolveIssues = (profile?.permissions || []).includes('ISSUE_RESOLVE');
  const membersTab = profile?.departmentId ? 'Department members' : 'Organization members';

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-7 text-slate-900 grid place-items-center">
        <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
          {error ? <>
            <h1 className="text-xl font-bold">Employee dashboard unavailable</h1>
            <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>
            <p className="mt-2 text-sm text-slate-600">Your account is unchanged. Try again in a moment.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => refresh()} disabled={refreshing} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{refreshing ? 'Retrying…' : 'Try again'}</button>
              <button onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold">Sign out</button>
            </div>
          </> : <>
            <h1 className="text-xl font-bold">Loading employee dashboard…</h1>
            <p className="mt-2 text-sm text-slate-600">Connecting to your organization services.</p>
          </>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-7 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-wrap justify-between gap-4 items-center shadow-sm">
          <div className="flex items-center gap-4">
            <ProfileAvatar src={profile?.profileImage} className="h-16 w-16 border-2 border-blue-100" iconClassName="h-7 w-7" />
            <div><p className="text-xs uppercase tracking-wider text-blue-700 font-bold">Employee workspace</p>
              <h1 className="text-2xl font-bold mt-1">Welcome, {profile?.name || 'Employee'}</h1>
              <p className="text-sm text-slate-500 mt-1">{profile?.designation || 'Field staff'} · {profile?.organizationName || 'Your organization'}{profile?.departmentName ? ` · ${profile.departmentName} / ${profile.departmentRole === 'HEAD' ? 'Department Head' : 'Department Member'}` : ''}</p>
              <div className="flex items-center gap-3 mt-2"><label className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 cursor-pointer"><Upload className="h-3.5 w-3.5" />{imageBusy ? 'Saving photo…' : 'Set profile photo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadAvatar} disabled={imageBusy} /></label>{profile?.profileImage && <button onClick={removeAvatar} className="text-xs text-slate-500 hover:text-slate-800" disabled={imageBusy}>Remove</button>}</div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => refresh()} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50" disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
            <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm" onClick={logout}>Sign out</button>
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold text-sm">Organization</h2><p className="text-sm text-slate-500">Current: {profile?.organizationName || 'Not assigned'}</p>
            {profile?.organizationChangeStatus === 'PENDING' && <p className="text-xs text-amber-700 mt-1">Move request awaiting approval from {profile.pendingOrganizationName}.</p>}
            {profile?.organizationChangeStatus === 'REJECTED' && <p className="text-xs text-rose-700 mt-1">Your previous organization change request was declined.</p>}
          </div>
          {profile?.organizationChangeStatus !== 'PENDING' && <button onClick={() => setShowChangeForm(value => !value)} className="rounded-lg border border-blue-200 text-blue-700 px-3 py-2 text-sm font-semibold">{showChangeForm ? 'Cancel' : 'Request organization change'}</button>}
          {showChangeForm && <form onSubmit={requestOrganizationChange} className="w-full flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
            <input value={joinCode} onChange={event => setJoinCode(event.target.value)} required placeholder="Enter new organization joining code" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={changeBusy} className="rounded-lg bg-blue-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{changeBusy ? 'Sending…' : 'Send for admin approval'}</button>
            <p className="w-full text-xs text-slate-500">Your current organization stays active until the new organization’s admin approves the request.</p>
          </form>}
        </section>

        <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-5" aria-label="Employee dashboard navigation">
          <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Workspace</p>
          {[
            ['Overview', Activity], ['My tasks', ClipboardList], ['Organization task status', ClipboardList], ...(profile?.departmentId ? [['My department', UsersRound]] : []), ...(canViewIssues ? [['Issues', MapPin]] : []),
            [membersTab, UsersRound], ['Activity', CalendarClock], ['Notifications', Clock3], ['Account', UserRound]
          ].map(([item, Icon]) => <button key={item} onClick={() => setTab(item)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${tab === item ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4 shrink-0" />{item}{item === 'Notifications' && notifications.some(notification => !notification.read) ? <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs">{notifications.filter(notification => !notification.read).length}</span> : null}{item === 'Organization members' ? <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs">{organizationMembers.length}</span> : null}</button>)}
        </aside>
        <div className="min-w-0 space-y-5">
        {error && <div role="alert" className="rounded-lg bg-red-50 text-red-700 p-4 flex justify-between gap-4">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
        {notice && <div role="status" className="rounded-lg bg-emerald-50 text-emerald-700 p-3 text-sm">{notice}</div>}

        {(tab === 'Overview' || tab === 'My tasks') && <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            ['My assignments', counts.total, ClipboardList, 'text-blue-600'], ['In progress', counts.active, Activity, 'text-amber-600'], ['Awaiting start', counts.assigned, Clock3, 'text-violet-600'], ['Resolved', counts.resolved, CheckCircle2, 'text-emerald-600']
          ].map(([label, value, Icon, color]) => <button key={label} onClick={() => { setTab('My tasks'); setFilter(label === 'My assignments' ? 'All' : label === 'Awaiting start' ? 'Assigned' : label); }} className="text-left bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div className="flex justify-between"><span className="text-sm text-slate-500">{label}</span><Icon className={`h-5 w-5 ${color}`} /></div><p className="text-3xl font-bold mt-3">{value}</p><p className="text-xs text-slate-400 mt-1">Tap to view</p>
          </button>)}
        </section>}

        {tab === 'Overview' && <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-bold text-lg">Next up</h2><p className="text-sm text-slate-500">Your most recent open assignments</p></div><button onClick={() => setTab('My tasks')} className="text-sm text-blue-700 font-semibold">View all</button></div>
            {activeTasks.length === 0 ? <div className="p-10 text-center text-slate-500"><CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />You’re all caught up.</div> : <div className="divide-y divide-slate-100">{activeTasks.slice(0, 4).map(task => <TaskRow key={task.id} task={task} busy={busy === task.id} onStatus={setTaskStatus} canUpdate={canUpdateTasks && String(task.employeeId) === String(profile?.id)} canDelegate={canAssignTasks && String(task.employeeId) === String(profile?.id)} onDelegate={openDelegation} compact />)}</div>}
          </section>
          <section className="bg-gradient-to-br from-blue-700 to-indigo-800 rounded-2xl p-6 text-white flex flex-col justify-between min-h-52"><div><p className="text-blue-100 text-sm font-semibold">Field work</p><h2 className="text-2xl font-bold mt-2">Keep your community moving.</h2><p className="text-sm text-blue-100 mt-2">Update task progress as you work so residents and your team see current issue status.</p>{canAssignTasks && <p className="mt-4 text-sm text-blue-100">You can delegate assigned work to {subordinates.length} team member{subordinates.length === 1 ? '' : 's'} below you.</p>}</div></section>
        </div>}

        {tab === 'My tasks' && <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg">My assignments</h2><p className="text-sm text-slate-500">Search, filter, and update your assigned work.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks or issue ID" className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 max-w-full"/></div></div>
            <div className="flex gap-2 mt-4 overflow-x-auto">{filters.map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${filter === item ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item}{item === 'All' ? ` (${counts.total})` : item === 'Assigned' ? ` (${counts.assigned})` : item === 'In Progress' ? ` (${counts.active})` : ` (${counts.resolved})`}</button>)}</div>
          </div>
          {visibleTasks.length === 0 ? <div className="p-10 text-center text-slate-500">No tasks match this view.</div> : <div className="divide-y divide-slate-100">{visibleTasks.map(task => <TaskRow key={task.id} task={task} busy={busy === task.id} onStatus={setTaskStatus} canUpdate={canUpdateTasks && String(task.employeeId) === String(profile?.id)} canDelegate={canAssignTasks && String(task.employeeId) === String(profile?.id)} onDelegate={openDelegation}/>)}</div>}
        </section>}

        {tab === 'Organization task status' && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-bold">Organization task status</h2><p className="text-sm text-slate-500">Read only status updates for tasks assigned across your organization. Refreshes automatically.</p></div>
          {organizationTasks.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No organization tasks are available.</p> : <div className="divide-y divide-slate-100">{organizationTasks.map(task => <article key={task.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">{task.title}</p><p className="mt-1 text-xs text-slate-500">Assigned to {task.employeeName || 'Unassigned'}{task.departmentName ? ` · ${task.departmentName}` : ''}{task.dueDate ? ` · Due ${task.dueDate}` : ''}</p></div><div className="flex shrink-0 items-center gap-3"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{task.status}</span><span className="text-xs text-slate-500">{task.priority || 'Normal'}</span></div></article>)}</div>}
        </section>}

        {tab === 'Issues' && canViewIssues && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-bold">Issue catalog</h2><p className="text-sm text-slate-500">Issues available under your assigned view permission.</p></div>
          {issueCatalogLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading issues…</p> : issueCatalog.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No issues are available.</p> : <div className="divide-y divide-slate-100">{issueCatalog.map(issue => {
            const resolved = String(issue.status || '').toLowerCase() === 'resolved';
            return <article key={issue.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">{issue.type || 'Road issue'} <span className="ml-2 text-xs font-normal text-slate-500">{issue.id}</span></p><p className="mt-1 text-sm text-slate-600">{issue.location || 'Location unavailable'}</p><p className="mt-1 text-xs text-slate-500">{issue.status || 'Reported'}{issue.description ? ` · ${issue.description}` : ''}</p></div>{canResolveIssues && !resolved && <button disabled={busy === `issue-${issue.id}`} onClick={() => resolveCatalogIssue(issue)} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === `issue-${issue.id}` ? 'Saving…' : 'Mark resolved'}</button>}</article>;
          })}</div>}
        </section>}

        {tab === membersTab && <OrganizationMembers members={organizationMembers} title={membersTab} />}
        {tab === 'My department' && profile?.departmentId && <DepartmentWorkspace profile={profile} onMessage={(message, type) => type === 'error' ? setError(message) : setNotice(message)} />}

        {tab === 'Activity' && <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6"><div className="flex gap-3 items-center"><CalendarClock className="h-5 w-5 text-blue-700"/><div><h2 className="font-bold text-lg">My activity</h2><p className="text-sm text-slate-500">A record of your task updates.</p></div></div>
          {history.length === 0 ? <p className="text-sm text-slate-500 mt-6">No task updates recorded yet.</p> : <ol className="mt-6 space-y-4">{history.map(event => <li key={event.id} className="flex gap-3 text-sm"><span className="h-2.5 w-2.5 mt-1.5 rounded-full bg-blue-600 shrink-0"/><div className="flex-1 border-b border-slate-100 pb-3"><p><strong>{event.taskTitle}</strong> · {event.status}</p><p className="text-xs text-slate-500 mt-1">Updated by {event.actor}</p></div><time className="text-xs text-slate-400 shrink-0">{new Date(event.changedAt).toLocaleString()}</time></li>)}</ol>}
        </section>}
        {tab === 'Notifications' && <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3"><div><h2 className="font-bold text-lg">Notifications</h2><p className="text-sm text-slate-500">Recent task assignments and updates for your account.</p></div>{notifications.some(item => !item.read) && <button onClick={markAllNotificationsRead} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Mark all as read</button>}</div>
          {notifications.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No notifications yet.</p> : <div className="divide-y divide-slate-100">{notifications.map(item => <button key={item.id} onClick={() => markNotificationRead(item.id)} className={`w-full p-4 text-left hover:bg-slate-50 ${item.read ? 'bg-white' : 'bg-blue-50/60'}`}><span className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">{item.title}</strong><time className="text-xs text-slate-400">{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</time></span><span className="block mt-1 text-sm text-slate-600">{item.message}</span>{!item.read && <span className="block mt-2 text-xs font-semibold text-blue-700">New · click to mark as read</span>}</button>)}</div>}
        </section>}
        {tab === 'Account' && <AccountSecurityPanel username={profile?.username} onMessage={(message, type) => type === 'error' ? setError(message) : setNotice(message)} />}
        <p className="text-center text-xs text-slate-400">Dashboard data refreshes automatically every 5 seconds.</p>
        </div>
        </div>
        {delegateTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={submitDelegation} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delegate-task-title">
            <div><h2 id="delegate-task-title" className="text-lg font-bold">Delegate this task</h2><p className="mt-1 text-sm text-slate-500">Parent task: {delegateTarget.title}</p></div>
            <label className="block text-sm font-semibold">Team member<select className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" value={delegateEmployeeId} onChange={event => setDelegateEmployeeId(event.target.value)} required><option value="">Choose a team member below you</option>{subordinates.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}{employee.designation ? ` (${employee.designation})` : ''}</option>)}</select></label>
            <label className="block text-sm font-semibold">Task title<input className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" value={delegateTitle} maxLength={160} onChange={event => setDelegateTitle(event.target.value)} required /></label>
            <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Priority<select className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" value={delegatePriority} onChange={event => setDelegatePriority(event.target.value)}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><label className="block text-sm font-semibold">Due date<input type="date" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" value={delegateDueDate} onChange={event => setDelegateDueDate(event.target.value)} required /></label></div>
            <label className="block text-sm font-semibold">Instructions<textarea rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" value={delegateNotes} onChange={event => setDelegateNotes(event.target.value)} placeholder="Add instructions for your team member" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDelegateTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={delegating || subordinates.length === 0} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{delegating ? 'Assigning…' : 'Delegate task'}</button></div>
          </form>
        </div>}
      </div>
    </main>
  );
}

function DepartmentWorkspace({ profile, onMessage }) {
  const [members, setMembers] = useState([]); const [tasks, setTasks] = useState([]); const [pending, setPending] = useState([]);
  const [taskId, setTaskId] = useState(''); const [memberId, setMemberId] = useState(''); const [timelines, setTimelines] = useState({});
  const canManage = profile.departmentRole === 'HEAD';
  const refresh = useCallback(async () => {
    try {
      const [people, assignments, requests] = await Promise.all([
        portalApi(`/departments/${profile.departmentId}/members`), portalApi(`/departments/${profile.departmentId}/tasks`),
        canManage ? portalApi(`/departments/${profile.departmentId}/pending-members`) : Promise.resolve([])
      ]);
      setMembers(people); setTasks(assignments); setPending(requests);
    } catch (error) { onMessage(error.message, 'error'); }
  }, [profile.departmentId, canManage, onMessage]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  const assign = async event => {
    event.preventDefault();
    try { await portalApi(`/tasks/${taskId}/assign-member`, { method: 'POST', body: JSON.stringify({ employeeId: Number(memberId) }) }); onMessage('Task assigned to department member.', 'success'); setTaskId(''); setMemberId(''); refresh(); }
    catch (error) { onMessage(error.message, 'error'); }
  };
  const approve = async (id, status) => {
    try { await portalApi(`/departments/approve-member/${id}`, { method: 'POST', body: JSON.stringify({ status }) }); onMessage(`Member ${status.toLowerCase()}.`, 'success'); refresh(); }
    catch (error) { onMessage(error.message, 'error'); }
  };
  const showTimeline = async id => { try { const timeline = await portalApi(`/tasks/${id}/history`); setTimelines(previous => ({ ...previous, [id]: timeline })); } catch (error) { onMessage(error.message, 'error'); } };
  const unassigned = tasks.filter(task => !task.employeeId && task.status !== 'Resolved');
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">{profile.departmentName}</h2><p className="text-sm text-slate-500">Department members: {members.length} · Tasks: {tasks.length}</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{['Assigned to Department','In Progress','Resolved'].map(status => <div key={status} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{status}</p><strong>{tasks.filter(task => status === 'Assigned to Department' ? !task.employeeId && task.status !== 'Resolved' : task.status === status).length}</strong></div>)}</div></section>
    {canManage && pending.length > 0 && <section className="rounded-2xl border border-amber-200 bg-white p-5"><h3 className="font-bold">Pending member approvals ({pending.length})</h3><div className="mt-3 divide-y">{pending.map(person => <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{person.name}</strong><span className="ml-2 text-xs text-slate-500">{person.designation}</span></span><span className="flex gap-2"><button onClick={() => approve(person.id, 'APPROVED')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Approve</button><button onClick={() => approve(person.id, 'REJECTED')} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">Reject</button></span></div>)}</div></section>}
    {canManage && unassigned.length > 0 && <form onSubmit={assign} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5"><label className="min-w-52 flex-1 text-sm font-semibold">Department task<select required value={taskId} onChange={event => setTaskId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"><option value="">Choose task to assign</option>{unassigned.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label className="min-w-52 flex-1 text-sm font-semibold">Department member<select required value={memberId} onChange={event => setMemberId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"><option value="">Choose member</option>{members.filter(person => person.role === 'EMPLOYEE' && person.departmentRole !== 'HEAD').map(person => <option key={person.id} value={person.id}>{person.name} · {person.designation}</option>)}</select></label><button className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Assign to member</button></form>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h3 className="font-bold">Department task progress</h3></div>{tasks.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No department tasks yet.</p> : <ul className="divide-y divide-slate-100">{tasks.map(task => <li key={task.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{task.title}</p><p className="text-xs text-slate-500">{task.employeeName} · {task.priority}{task.issueId ? ` · Issue ${task.issueId}` : ''}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{task.status}</span><button onClick={() => showTimeline(task.id)} className="text-xs font-semibold text-blue-700">Timeline</button></div>{timelines[task.id] && <ol className="mt-3 space-y-2 border-l-2 border-blue-100 pl-4">{timelines[task.id].map(event => <li key={event.id} className="text-xs"><strong>{event.action}</strong> · {event.actor || 'System'} · {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}<p className="text-slate-500">{event.details}</p></li>)}</ol>}</li>)}</ul>}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold">Department members ({members.length})</h3><ul className="mt-3 divide-y divide-slate-100">{members.map(person => <li key={person.id} className="flex justify-between gap-3 py-3 text-sm"><span><strong>{person.name}</strong><span className="ml-2 text-xs text-slate-500">{person.designation}</span></span><span className="text-xs text-slate-500">{person.departmentRole || person.role}</span></li>)}</ul></section>
  </div>;
}

function OrganizationMembers({ members, title = 'Organization members' }) {
  const [search, setSearch] = useState('');
  const filtered = members.filter(member => `${member.name} ${member.designation} ${member.role} ${member.employeeId || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-blue-700"/><div><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-slate-500">People you are permitted to view ({members.length}).</p></div></div>
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search members" aria-label="Search organization members" className="w-56 max-w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"/></div>
    </div>
    {filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{members.length ? 'No members match your search.' : 'No active organization members found.'}</p> : <ul className="divide-y divide-slate-100">{filtered.map(member => <li key={member.id} className="flex items-center gap-3 p-4">
      <ProfileAvatar src={member.profileImage} className="h-11 w-11 border border-slate-200" iconClassName="h-5 w-5"/>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{member.name}{member.isCurrentUser ? <span className="ml-2 text-xs font-medium text-blue-700">You</span> : ''}</p><p className="mt-0.5 truncate text-xs text-slate-500">{member.designation || (member.role === 'ADMIN' ? 'Organization administrator' : 'Employee')}{member.employeeId ? ` · ${member.employeeId}` : ''}</p></div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.role === 'ADMIN' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{member.role === 'ADMIN' ? 'Admin' : 'Employee'}</span>
    </li>)}</ul>}
  </section>;
}

function TaskRow({ task, busy, onStatus, canUpdate = false, canDelegate = false, onDelegate, compact = false }) {
  const [issueDetails, setIssueDetails] = useState(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isResolved = task.status === 'Resolved';
  const isCancelled = task.status === 'Cancelled';
  const loadIssueDetails = async () => {
    if (issueDetails || issueLoading) return;
    setIssueLoading(true); setIssueError('');
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(task.issueId)}`);
      if (!response.ok) throw new Error(response.status === 404 ? 'The linked issue could not be found.' : 'Could not load linked issue details.');
      setIssueDetails(await response.json());
    } catch (error) { setIssueError(error.message); }
    finally { setIssueLoading(false); }
  };
  const toggleIssueDetails = () => {
    if (detailsOpen) { setDetailsOpen(false); return; }
    setDetailsOpen(true);
    loadIssueDetails();
  };
  const coordinates = issueDetails?.coords;
  const hasCoordinates = Array.isArray(coordinates) && coordinates.length >= 2 && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]));
  const latitude = hasCoordinates ? Number(coordinates[0]) : null;
  const longitude = hasCoordinates ? Number(coordinates[1]) : null;
  const mapBounds = hasCoordinates ? `${longitude - 0.004},${latitude - 0.002},${longitude + 0.004},${latitude + 0.002}` : '';
  return <article className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${compact ? '' : 'hover:bg-slate-50/60'}`}>
    <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-slate-900">{task.title}</h3><span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${isResolved ? 'bg-emerald-100 text-emerald-800' : task.status === 'In Progress' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{task.status}</span></div>
      {task.issueId && <p className="text-xs text-blue-700 mt-1">Linked issue {task.issueId}</p>}{task.description && <p className="text-sm text-slate-600 mt-2">{task.description}</p>}
      <p className="text-xs text-slate-400 mt-2">{task.priority || 'Medium'} priority · Updated {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'recently'}{task.dueDate ? ` · Due ${task.dueDate}` : ''}</p>
      {task.issueId && <div className="mt-3">
        <button type="button" onClick={toggleIssueDetails} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100">
          <ImageIcon className="h-4 w-4" />{detailsOpen ? 'Hide issue details' : 'View issue photos & map'}
        </button>
        {detailsOpen && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          {issueLoading && <p className="text-sm text-slate-500">Loading issue details…</p>}
          {issueError && <div className="text-sm text-rose-700">{issueError} <button type="button" onClick={loadIssueDetails} className="underline font-semibold">Retry</button></div>}
          {issueDetails && <>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <p><strong>Issue:</strong> {issueDetails.type || task.issueId}</p>
              <p><strong>Severity:</strong> {issueDetails.severity || 'Not provided'}</p>
              <p><strong>Status:</strong> {issueDetails.status || 'Reported'}</p>
              <p><strong>Reports:</strong> {issueDetails.report_count || 1}</p>
              <p className="sm:col-span-2"><strong>Location:</strong> {issueDetails.location || 'Location name unavailable'}</p>
              {issueDetails.description && <p className="sm:col-span-2 text-slate-600"><strong>Description:</strong> {issueDetails.description}</p>}
            </div>
            {hasCoordinates && <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-blue-700" />Exact issue location</h4>
              <p className="mb-2 text-xs text-slate-600">{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
              <iframe title={`Map for issue ${task.issueId}`} src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(mapBounds)}&layer=mapnik&marker=${latitude}%2C${longitude}`} className="h-56 w-full rounded-lg border border-slate-200" loading="lazy" />
              <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">Open full map <ExternalLink className="h-3 w-3" /></a>
            </section>}
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold"><ImageIcon className="h-4 w-4 text-blue-700" />Issue photos ({issueDetails.photos?.length || 0})</h4>
              {issueDetails.photos?.length ? <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{issueDetails.photos.map((photo, index) => <a key={`${task.issueId}-photo-${index}`} href={photo} download={`RoadGuard_${task.issueId}_photo_${index + 1}`} className="group overflow-hidden rounded-lg border border-slate-200"><img src={photo} alt={`Issue ${task.issueId}, photo ${index + 1}`} className="h-36 w-full object-cover transition-transform group-hover:scale-105"/><span className="block px-2 py-1.5 text-xs font-semibold text-blue-700">Download photo {index + 1}</span></a>)}</div> : <p className="text-sm text-slate-500">No photos were uploaded for this issue.</p>}
            </section>
          </>}
        </div>}
      </div>}
    </div>
    <div className="flex items-center gap-2 shrink-0">{canDelegate && !isResolved && !isCancelled && onDelegate && <button onClick={() => onDelegate(task)} className="text-sm rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50">Delegate</button>}{canUpdate && !isResolved && !isCancelled && task.status !== 'In Progress' && <button disabled={busy} onClick={() => onStatus(task, 'In Progress')} className="text-sm rounded-lg border border-slate-300 px-3 py-2 hover:bg-white disabled:opacity-50">Start task</button>}{canUpdate && !isResolved && !isCancelled && <button disabled={busy} onClick={() => onStatus(task, 'Resolved')} className="text-sm rounded-lg bg-emerald-700 text-white px-3 py-2 hover:bg-emerald-800 disabled:opacity-50">{busy ? 'Saving…' : 'Mark resolved'}</button>}{isResolved && <span className="text-xs text-emerald-700 font-semibold">Completed</span>}{isCancelled && <span className="text-xs text-slate-500 font-semibold">Cancelled</span>}</div>
  </article>;
}
