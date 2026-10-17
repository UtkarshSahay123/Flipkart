import React, { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw, Users, ClipboardList, Pencil, X } from 'lucide-react';
import { portalApi } from '../../lib/portalApi';
import { useRoadGuard } from '../../context/RoadGuardContext';

export function DepartmentsPage() {
  const { showToast, organizationProfile } = useRoadGuard();
  const [departments, setDepartments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try { setDepartments(await portalApi('/admin/departments/overview')); }
    catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(false); }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);
  const openDepartment = async department => {
    setSelected(department); setMembers([]); setTasks([]);
    try {
      const [people, assignments] = await Promise.all([portalApi(`/departments/${department.id}/members`), portalApi(`/departments/${department.id}/tasks`)]);
      setMembers(people); setTasks(assignments);
    } catch (error) { showToast(error.message, 'error'); }
  };
  const saveDepartment = async event => {
    event.preventDefault();
    try {
      await portalApi('/admin/departments', { method: 'POST', body: JSON.stringify({ id: editingId || null, name }) });
      setName(''); setEditingId(null); await refresh(); showToast('Department saved.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
  };
  const edit = department => { setEditingId(department.id); setName(department.name); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Organization structure</p><h1 className="mt-1 text-2xl font-extrabold text-[#0A2342]">Departments Overview</h1><p className="mt-1 text-sm text-slate-500">{organizationProfile?.authorityType ? `${organizationProfile.authorityType} · ` : ''}{organizationProfile?.authorityTitle || organizationProfile?.designation || 'Organization Administrator'} · Review department leadership, membership, and task progress.</p></div><button onClick={refresh} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`}/>Refresh</button></header>
    <form onSubmit={saveDepartment} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="min-w-64 flex-1 text-sm font-semibold">{editingId ? 'Rename department' : 'Add department'}<input value={name} onChange={event => setName(event.target.value)} maxLength={120} required placeholder="Department name" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/></label><button className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">{editingId ? 'Save name' : 'Add department'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setName(''); }} className="rounded-lg border border-slate-300 px-3 py-2.5"><X className="h-4 w-4"/></button>}</form>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{departments.map(department => <article key={department.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${selected?.id === department.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Building2 className="h-5 w-5"/></span><div><h2 className="font-bold text-slate-900">{department.name}</h2><p className="text-xs text-slate-500">{department.head?.name || 'Head not assigned'}</p>{department.head && <p className="text-xs text-slate-500">{department.head.designation} · {department.head.email}</p>}</div></div><button onClick={() => edit(department)} title="Rename department" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4"/></button></div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-slate-50 p-3"><Users className="mb-1 h-4 w-4 text-blue-700"/><strong>{department.memberCount}</strong><p className="text-xs text-slate-500">Members</p></div><div className="rounded-lg bg-slate-50 p-3"><ClipboardList className="mb-1 h-4 w-4 text-blue-700"/><strong>{Number(department.pendingTasks) + Number(department.inProgressTasks) + Number(department.resolvedTasks)}</strong><p className="text-xs text-slate-500">Tasks</p></div></div>
      <div className="mt-3 flex gap-2 text-xs"><span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">Pending {department.pendingTasks}</span><span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">In progress {department.inProgressTasks}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">Resolved {department.resolvedTasks}</span></div>
      <button onClick={() => openDepartment(department)} className="mt-4 w-full rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">View department</button>
    </article>)}</div>
    {selected && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-lg font-bold">{selected.name}</h2><p className="text-sm text-slate-500">Members, department tasks and progress</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button></div><div className="grid gap-5 p-5 lg:grid-cols-2"><div><h3 className="mb-3 font-bold">Members ({members.length})</h3><ul className="divide-y divide-slate-100">{members.map(member => <li key={member.id} className="flex justify-between gap-3 py-3 text-sm"><span><strong>{member.name}</strong><span className="block text-xs text-slate-500">{member.designation || member.departmentRole}</span></span><span className="text-xs text-slate-500">{member.departmentRole || member.role}</span></li>)}</ul></div><div><h3 className="mb-3 font-bold">Department tasks ({tasks.length})</h3><ul className="divide-y divide-slate-100">{tasks.map(task => <li key={task.id} className="py-3 text-sm"><strong>{task.title}</strong><span className="float-right rounded-full bg-slate-100 px-2 py-0.5 text-xs">{task.status}</span><p className="mt-1 text-xs text-slate-500">{task.employeeName} · {task.priority}{task.issueId ? ` · Issue ${task.issueId}` : ''}</p></li>)}</ul></div></div></section>}
  </div>;
}
