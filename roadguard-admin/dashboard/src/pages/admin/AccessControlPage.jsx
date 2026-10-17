import React, { useMemo, useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import {
  Search, ShieldCheck, LockKeyhole, Plus, Pencil, Trash2, Users, UserRoundCog
} from 'lucide-react';

const PERMISSIONS = [
  { key: 'ISSUE_REPORT', label: 'Report issues', description: 'Submit new road hazard reports.' },
  { key: 'ISSUE_VIEW_ALL', label: 'View all issues', description: 'Browse the organization issue catalog and map.' },
  { key: 'ISSUE_RESOLVE', label: 'Resolve issues', description: 'Mark issues resolved through the issue API.' },
  { key: 'TASK_UPDATE', label: 'Update assigned tasks', description: 'Change the status of assigned tasks.' },
  { key: 'TASK_ASSIGN', label: 'Delegate tasks', description: 'Assign tasks to employees below in the hierarchy.' }
];

export const AccessControlPage = () => {
  const { employees, accessRoles, saveAccessRole, deleteAccessRole, updateEmployeeAccess } = useRoadGuard();
  const [search, setSearch] = useState('');
  const [roleEditor, setRoleEditor] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [roleId, setRoleId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [error, setError] = useState('');

  const filteredEmployees = useMemo(() => employees.filter(employee =>
    `${employee.name} ${employee.id} ${employee.email} ${employee.designation}`.toLowerCase().includes(search.toLowerCase())
  ), [employees, search]);

  const openRoleEditor = (role = null) => {
    setError('');
    setRoleEditor({ id: role?.id || null, name: role?.name || '', description: role?.description || '', permissions: role?.permissions || [] });
  };

  const openEmployeeEditor = employee => {
    setError('');
    setEditingEmployee(employee);
    setRoleId(employee.rbacEnabled && employee.roleId ? String(employee.roleId) : '');
    setManagerId(employee.managerId ? String(employee.managerId) : '');
  };

  const submitRole = async event => {
    event.preventDefault();
    try { await saveAccessRole(roleEditor); setRoleEditor(null); }
    catch (saveError) { setError(saveError.message); }
  };

  const submitEmployee = async event => {
    event.preventDefault();
    try { await updateEmployeeAccess(editingEmployee.id, { roleId, managerId }); setEditingEmployee(null); }
    catch (saveError) { setError(saveError.message); }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#D9E1EF] bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-[#0755C9]"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-extrabold text-[#0A2342]">Access control & task delegation</h1>
              <p className="mt-1 text-xs text-[#52627A]">Create permission sets, assign them to employees, and define who reports to whom.</p>
            </div>
          </div>
          <button onClick={() => openRoleEditor()} className="inline-flex items-center gap-2 rounded-lg bg-[#0755C9] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0647A8]">
            <Plus className="h-4 w-4" /> Create access role
          </button>
        </div>

        {accessRoles.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accessRoles.map(role => (
              <article key={role.id} className="rounded-lg border border-[#D9E1EF] bg-[#F7F9FD] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><h2 className="text-sm font-bold text-[#0A2342]">{role.name}</h2><p className="mt-1 min-h-8 text-xs text-[#52627A]">{role.description || 'No description provided.'}</p></div>
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[#0755C9]" />
                </div>
                <div className="mt-3 flex min-h-8 flex-wrap content-start gap-1.5">
                  {(role.permissions || []).length ? role.permissions.map(key => <span key={key} className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800">{PERMISSIONS.find(permission => permission.key === key)?.label || key}</span>) : <span className="text-[11px] italic text-slate-400">No permissions granted</span>}
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
                  <button onClick={() => openRoleEditor(role)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0755C9] hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={async () => { if (window.confirm(`Delete “${role.name}” and revoke it from assigned employees?`)) { try { await deleteAccessRole(role.id); } catch { /* Context displays the error. */ } } }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">No access roles have been created. Create a role to start assigning permissions.</div>}
      </section>

      <section className="overflow-hidden rounded-xl border border-[#D9E1EF] bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div><h2 className="flex items-center gap-2 font-extrabold text-[#0A2342]"><Users className="h-4 w-4 text-[#0755C9]" /> Employee role assignment</h2><p className="mt-1 text-xs text-[#52627A]">Choose a permission role and reporting manager for any employee.</p></div>
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search employees..." className="w-full rounded-lg border border-[#D9E1EF] bg-[#F7F9FD] py-2 pl-9 pr-3 text-xs" /></div>
        </div>
        {filteredEmployees.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs text-[#0A2342]"><thead className="bg-[#EEF3FF] text-[10px] uppercase tracking-wide text-[#52627A]"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Designation</th><th className="px-5 py-3">Access role</th><th className="px-5 py-3">Reports to</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredEmployees.map(employee => {
          const assignedRole = accessRoles.find(role => String(role.id) === String(employee.roleId));
          const manager = employees.find(candidate => String(candidate.id) === String(employee.managerId));
          return <tr key={employee.id} className="hover:bg-slate-50"><td className="px-5 py-3"><p className="font-bold">{employee.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{employee.email}</p></td><td className="px-5 py-3">{employee.designation || '—'}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${employee.rbacEnabled && !assignedRole ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{employee.rbacEnabled ? assignedRole?.name || 'Access revoked' : 'Designation defaults'}</span></td><td className="px-5 py-3">{manager?.name || 'Top level'}</td><td className="px-5 py-3">{employee.status}</td><td className="px-5 py-3 text-right"><button onClick={() => openEmployeeEditor(employee)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-bold text-[#0755C9] hover:bg-blue-100"><UserRoundCog className="h-3.5 w-3.5" /> Manage access</button></td></tr>;
        })}</tbody></table></div> : <p className="p-8 text-center text-xs text-slate-500">No employees match this search.</p>}
      </section>

      {editingEmployee && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs"><form onSubmit={submitEmployee} className="my-8 w-full max-w-lg space-y-5 rounded-xl border border-[#D9E1EF] bg-white p-6 shadow-2xl">
        <div><h2 className="flex items-center gap-2 font-bold text-[#0A2342]"><LockKeyhole className="h-5 w-5 text-[#0755C9]" /> Manage employee access</h2><p className="mt-1 text-xs text-[#52627A]">{editingEmployee.name} · {editingEmployee.designation}</p></div>
        <label className="block text-xs font-bold text-[#0A2342]">Permission role<select value={roleId} onChange={event => setRoleId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D9E1EF] bg-[#F7F9FD] px-3 py-2.5 font-medium"><option value="">No role — revoke RBAC permissions</option>{accessRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        <label className="block text-xs font-bold text-[#0A2342]">Reports to<select value={managerId} onChange={event => setManagerId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D9E1EF] bg-[#F7F9FD] px-3 py-2.5 font-medium"><option value="">Top level / no manager</option>{employees.filter(candidate => candidate.status === 'Active' && String(candidate.id) !== String(editingEmployee.id)).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} — {candidate.designation}</option>)}</select></label>
        <p className="rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800">Delegation is enforced by the backend: employees can assign tasks only to active employees below them and must link the delegated task to their own assigned task.</p>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setEditingEmployee(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" className="rounded-lg bg-[#0755C9] px-4 py-2 text-xs font-bold text-white hover:bg-[#0647A8]">Save access</button></div>
      </form></div>}

      {roleEditor && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs"><form onSubmit={submitRole} className="my-8 w-full max-w-xl space-y-5 rounded-xl border border-[#D9E1EF] bg-white p-6 shadow-2xl">
        <div><h2 className="flex items-center gap-2 font-bold text-[#0A2342]"><ShieldCheck className="h-5 w-5 text-[#0755C9]" /> {roleEditor.id ? 'Edit access role' : 'Create access role'}</h2><p className="mt-1 text-xs text-[#52627A]">Changes apply immediately to employees assigned this role.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-[#0A2342]">Role name<input required maxLength={80} value={roleEditor.name} onChange={event => setRoleEditor(current => ({ ...current, name: event.target.value }))} placeholder="Road inspector" className="mt-1 w-full rounded-lg border border-[#D9E1EF] bg-[#F7F9FD] px-3 py-2" /></label><label className="text-xs font-bold text-[#0A2342]">Description<input maxLength={300} value={roleEditor.description} onChange={event => setRoleEditor(current => ({ ...current, description: event.target.value }))} placeholder="Optional" className="mt-1 w-full rounded-lg border border-[#D9E1EF] bg-[#F7F9FD] px-3 py-2" /></label></div>
        <div className="space-y-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Permissions</p>{PERMISSIONS.map(permission => { const checked = roleEditor.permissions.includes(permission.key); return <label key={permission.key} className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><input type="checkbox" checked={checked} onChange={() => setRoleEditor(current => ({ ...current, permissions: checked ? current.permissions.filter(key => key !== permission.key) : [...current.permissions, permission.key] }))} className="mt-0.5 h-4 w-4 accent-[#0755C9]" /><span><span className="block text-xs font-bold text-[#0A2342]">{permission.label}</span><span className="mt-0.5 block text-[11px] text-slate-500">{permission.description}</span></span></label>; })}</div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setRoleEditor(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" className="rounded-lg bg-[#0755C9] px-4 py-2 text-xs font-bold text-white hover:bg-[#0647A8]">Save role</button></div>
      </form></div>}
    </div>
  );
};
