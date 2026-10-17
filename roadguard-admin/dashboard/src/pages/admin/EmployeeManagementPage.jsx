import React, { useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { DESIGNATIONS } from '../../data/mockData';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserX,
  Edit,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Briefcase
} from 'lucide-react';

export const EmployeeManagementPage = () => {
  const {
    employees,
    employeeTransferRequests,
    reviewEmployeeTransfer,
    tasks,
    approveEmployee,
    approveEmployeeAsAdmin,
    rejectEmployee,
    toggleEmployeeStatus,
    updateEmployeeDesignation
  } = useRoadGuard();

  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'approve' | 'reject' | 'toggle', emp }
  const [editingEmp, setEditingEmp] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [viewHistoryEmp, setViewHistoryEmp] = useState(null);

  // Filtering
  const filteredEmployees = employees.filter(emp => {
    const matchSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      String(emp.id ?? '').toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation.toLowerCase().includes(search.toLowerCase()) ||
      (emp.departmentName || '').toLowerCase().includes(search.toLowerCase());

    const matchDesignation = designationFilter === 'All' || emp.designation === designationFilter;
    const matchStatus = statusFilter === 'All' || emp.status === statusFilter;

    return matchSearch && matchDesignation && matchStatus;
  });

  const pendingApprovals = employees.filter(e => e.status === 'Pending Approval');

  const handleEditRoleSubmit = (e) => {
    e.preventDefault();
    if (!editingEmp || !newRole) return;
    updateEmployeeDesignation(editingEmp.id, newRole);
    setEditingEmp(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight">
            Employee Administration & Field Staff
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Manage municipal officers, inspectors, engineers, and approve new personnel registrations
          </p>
        </div>

        {/* Quick Pending Counter */}
        {pendingApprovals.length > 0 && (
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs font-bold text-amber-800 animate-pulse">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>{pendingApprovals.length} Pending Approval(s)</span>
          </div>
        )}
      </div>

      {employeeTransferRequests.length > 0 && <section className="bg-white p-5 rounded-xl border border-amber-200 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="font-bold text-[#0A2342]">Organization change requests</h2><p className="text-xs text-[#52627A] mt-1">Approving moves the employee into this organization and removes them from their current organization.</p></div><span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold">{employeeTransferRequests.length} pending</span></div>
        <div className="divide-y divide-slate-100">{employeeTransferRequests.map(emp => <div key={emp.id} className="py-3 flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-sm">{emp.name} <span className="font-normal text-slate-500">· {emp.designation}</span></p><p className="text-xs text-slate-500">{emp.email} · Current organization: {emp.organizationName}</p></div><div className="flex gap-2"><button onClick={() => reviewEmployeeTransfer(emp.id, 'APPROVED')} className="rounded-lg bg-emerald-700 text-white px-3 py-2 text-xs font-bold">Approve move</button><button onClick={() => reviewEmployeeTransfer(emp.id, 'REJECTED')} className="rounded-lg border border-rose-200 text-rose-700 px-3 py-2 text-xs font-bold">Reject</button></div></div>)}</div>
      </section>}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee by name, ID, email, designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Designation Filter */}
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Designations</option>
            {DESIGNATIONS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Deactivated">Deactivated</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Employee Table */}
      {filteredEmployees.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="Try modifying search query or designation filter."
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#D9E1EF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#0A2342]">
              <thead className="bg-[#EEF3FF] border-b border-[#D9E1EF] text-[#52627A] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3 text-center">Active Tasks</th>
                  <th className="px-4 py-3 text-center">Completed</th>
                  <th className="px-4 py-3">Reg Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProfileAvatar
                          src={emp.profileImage}
                          className="w-9 h-9 border border-[#D9E1EF] shrink-0"
                          iconClassName="w-4 h-4"
                        />
                        <div>
                          <p className="font-bold text-[#0A2342]">{emp.name}</p>
                          <p className="text-[11px] text-[#52627A]">{emp.email}{emp.departmentName ? ` · ${emp.departmentName} ${emp.departmentRole === 'HEAD' ? '(Department Head)' : '(Department Member)'}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#0755C9]">{emp.id}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Briefcase className="w-3.5 h-3.5 text-[#0755C9]" />
                        {emp.designation}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0755C9] font-bold">
                        {emp.assignedTasks}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                        {emp.completedTasks}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">{emp.registrationDate}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {emp.status === 'Pending Approval' ? (
                          <>
                            <button
                              onClick={() => setConfirmDialog({ type: 'approve', emp })}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setConfirmDialog({ type: 'reject', emp })}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition-colors"
                            >
                              Reject
                            </button>
                            <button onClick={() => approveEmployeeAsAdmin(emp.id)} className="rounded border border-violet-200 px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-50" title="Approve as an additional organization Admin">Admin</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingEmp(emp);
                                setNewRole(emp.designation);
                              }}
                              className="p-1.5 bg-slate-100 text-[#0A2342] hover:bg-slate-200 rounded-lg transition-colors"
                              title="Edit Designation"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setConfirmDialog({ type: 'toggle', emp })}
                              className={`p-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                emp.status === 'Active'
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                              title={emp.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                            >
                              {emp.status === 'Active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>

                            <button
                              onClick={() => setViewHistoryEmp(emp)}
                              className="px-2 py-1 bg-blue-50 text-[#0755C9] hover:bg-blue-100 rounded text-[11px] font-bold transition-colors"
                            >
                              Tasks
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Designation Edit Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#D9E1EF] shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0A2342] flex items-center gap-2">
              <Edit className="w-5 h-5 text-[#0755C9]" />
              Update Employee Designation
            </h3>
            <p className="text-xs text-[#52627A]">
              Change official municipal title for <strong>{editingEmp.name}</strong> ({editingEmp.id})
            </p>
            <form onSubmit={handleEditRoleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Select Designation</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
                >
                  {DESIGNATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-[#0755C9] hover:bg-[#0647A8] text-white font-bold rounded-lg"
                >
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task History Modal */}
      {viewHistoryEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 border border-[#D9E1EF] shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0A2342]">{viewHistoryEmp.name}'s Task History</h3>
                <p className="text-xs text-[#52627A]">{viewHistoryEmp.designation} • {viewHistoryEmp.completedTasks} completed</p>
              </div>
              <button onClick={() => setViewHistoryEmp(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {tasks.filter(t => t.assignedEmployeeId === viewHistoryEmp.id).length === 0 ? (
                <p className="p-4 text-center text-slate-400 italic">No tasks assigned to this employee.</p>
              ) : (
                tasks
                  .filter(t => t.assignedEmployeeId === viewHistoryEmp.id)
                  .map(t => (
                    <div key={t.id} className="p-3 bg-[#F7F9FD] rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0755C9]">{t.id}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="font-bold text-[#0A2342]">{t.title}</p>
                      <p className="text-slate-500 text-[11px]">Due Date: {t.dueDate} • Priority: {t.priority}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmationDialog
          isOpen={!!confirmDialog}
          onClose={() => setConfirmDialog(null)}
          title={
            confirmDialog.type === 'approve'
              ? 'Approve Registration'
              : confirmDialog.type === 'reject'
              ? 'Reject Registration'
              : 'Toggle Account Status'
          }
          message={
            confirmDialog.type === 'approve'
              ? confirmDialog.emp.departmentRole === 'HEAD'
                ? `Approve ${confirmDialog.emp.name} as an active Department Head? If this department already has a Head, they will become a member.`
                : `Are you sure you want to approve ${confirmDialog.emp.name} as an active ${confirmDialog.emp.designation}?`
              : confirmDialog.type === 'reject'
              ? `Reject registration for ${confirmDialog.emp.name}?`
              : `Change account status for ${confirmDialog.emp.name} to ${confirmDialog.emp.status === 'Active' ? 'Deactivated' : 'Active'}?`
          }
          confirmText={confirmDialog.type === 'approve' ? 'Approve' : confirmDialog.type === 'reject' ? 'Reject' : 'Confirm Toggle'}
          confirmStyle={confirmDialog.type === 'reject' ? 'danger' : 'primary'}
          onConfirm={() => {
            if (confirmDialog.type === 'approve') approveEmployee(confirmDialog.emp.id);
            else if (confirmDialog.type === 'reject') rejectEmployee(confirmDialog.emp.id);
            else toggleEmployeeStatus(confirmDialog.emp.id);
          }}
        />
      )}
    </div>
  );
};
