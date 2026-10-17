import React, { useEffect, useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { portalApi } from '../../lib/portalApi';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { MetricCard } from '../../components/common/MetricCard';
import { EmptyState } from '../../components/common/EmptyState';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  XCircle,
  Eye,
  Edit
} from 'lucide-react';

export const TaskAssignmentsPage = () => {
  const { tasks, employees, issues, createTask, updateTaskStatus } = useRoadGuard();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('All');
  const [departments, setDepartments] = useState([]);
  const [departmentLoadError, setDepartmentLoadError] = useState('');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);

  // Form State for New Task
  const [title, setTitle] = useState('');
  const [linkedIssueId, setLinkedIssueId] = useState('');
  const [empId, setEmpId] = useState('');
  const [assignmentMode, setAssignmentMode] = useState('employee');
  const [designation, setDesignation] = useState('');
  const [priority, setPriority] = useState('High');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [description, setDescription] = useState('');

  useEffect(() => {
    portalApi('/admin/departments/overview').then(rows => setDepartments(Array.isArray(rows) ? rows : []))
      .catch(error => setDepartmentLoadError(error.message || 'Could not load departments'));
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Derived Task Metrics
  const totalTasks = tasks.length;
  const assignedTasks = tasks.filter(t => t.status === 'Assigned').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const overdueTasks = tasks.filter(t => t.status !== 'Resolved' && t.dueDate < todayStr).length;
  const completedTasks = tasks.filter(t => t.status === 'Resolved').length;

  // Filtered Tasks
  const filteredTasks = tasks.filter(t => {
    const matchSearch =
      String(t.id ?? '').toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.assignedEmployeeName.toLowerCase().includes(search.toLowerCase()) ||
      (t.linkedIssueId && t.linkedIssueId.toLowerCase().includes(search.toLowerCase()));

    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    const matchEmp = employeeFilter === 'All' || t.assignedEmployeeId === employeeFilter;

    return matchSearch && matchStatus && matchPriority && matchEmp;
  });

  const selectedDepartment = departments.find(department => String(department.id) === String(empId));
  const selectedDepartmentStaffCount = selectedDepartment
    ? Number(selectedDepartment.memberCount || 0) + (selectedDepartment.head ? 1 : 0) : 0;
  const departmentHasStaff = selectedDepartmentStaffCount > 0;

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!title || (assignmentMode === 'employee' && !empId) || (assignmentMode === 'designation' && !designation) || (assignmentMode === 'department' && (!empId || !departmentHasStaff))) return;

    const created = await createTask({
      title,
      linkedIssueId: assignmentMode === 'department' ? null : (linkedIssueId || null),
      assignedEmployeeId: assignmentMode === 'employee' ? empId : null,
      designation: assignmentMode === 'designation' ? designation : null,
      departmentId: assignmentMode === 'department' ? empId : null,
      priority,
      dueDate,
      description
    });

    if (!created) return;
    setShowCreateModal(false);
    setTitle('');
    setLinkedIssueId('');
    setEmpId('');
    setDesignation('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight">
            Task Assignment Workspace
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Dispatch, track, and manage field maintenance tasks across municipal personnel
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create New Task
        </button>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Tasks"
          value={totalTasks}
          subtext="All dispatched directives"
          icon={CheckSquare}
          color="blue"
        />
        <MetricCard
          title="Assigned"
          value={assignedTasks}
          subtext="Pending start"
          icon={UserCheck}
          color="indigo"
        />
        <MetricCard
          title="In Progress"
          value={inProgressTasks}
          subtext="Crew active on site"
          icon={Clock}
          color="amber"
        />
        <MetricCard
          title="Overdue Tasks"
          value={overdueTasks}
          subtext="Passed target date"
          icon={AlertTriangle}
          color="red"
          badgeText="Attention Required"
        />
        <MetricCard
          title="Completed"
          value={completedTasks}
          subtext="Resolved & verified"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search task by ID, title, staff, linked issue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Statuses</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Staff Filter */}
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Field Personnel</option>
            {employees.filter(e => e.status === 'Active').map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task Table */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="Try refining your search query or task filters."
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#D9E1EF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#0A2342]">
              <thead className="bg-[#EEF3FF] border-b border-[#D9E1EF] text-[#52627A] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Task ID</th>
                  <th className="px-4 py-3">Task Directive</th>
                  <th className="px-4 py-3">Linked Hazard</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTasks.map((t) => {
                  const isOverdue = t.status !== 'Resolved' && t.dueDate < todayStr;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-[#0755C9]">{t.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0A2342]">{t.title}</p>
                        <p className="text-[11px] text-[#52627A] truncate max-w-[220px]">{t.description}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {t.linkedIssueId ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0755C9] font-bold">
                            {t.linkedIssueId}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#0A2342]">{t.assignedEmployeeName}</td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${isOverdue ? 'text-rose-600 font-extrabold flex items-center gap-1' : 'text-slate-600'}`}>
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          {t.dueDate}
                          {isOverdue && <span className="text-[9px] uppercase px-1 rounded bg-rose-100 text-rose-800">Overdue</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <select
                            value={t.status}
                            onChange={(e) => updateTaskStatus(t.id, e.target.value)}
                            className="px-2 py-1 bg-[#F7F9FD] border border-[#D9E1EF] rounded text-[11px] font-bold text-[#0A2342]"
                          >
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                          <button
                            onClick={() => setSelectedTaskDetail(t)}
                            className="p-1.5 bg-blue-50 text-[#0755C9] hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 border border-[#D9E1EF] shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0A2342] flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#0755C9]" />
              Create & Dispatch Task
            </h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patching pothole, traffic signal repair..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342] focus:outline-none focus:border-[#0755C9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0A2342] mb-1">Assign by *</label>
                  <select
                    value={assignmentMode}
                    onChange={(e) => { setAssignmentMode(e.target.value); setEmpId(''); if (e.target.value === 'department') setLinkedIssueId(''); }}
                    className="w-full mb-2 px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
                  >
                    <option value="employee">Employee</option>
                    <option value="designation">Designation</option>
                    <option value="department">Department</option>
                  </select>
                  {assignmentMode === 'department' ? (
                    <>
                      <select required value={empId} onChange={(e) => setEmpId(e.target.value)} className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]">
                        <option value="">-- Choose Department --</option>
                        {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                      </select>
                      {departmentLoadError && <p role="alert" className="mt-2 text-[11px] text-rose-700">{departmentLoadError}</p>}
                      {selectedDepartment && !departmentHasStaff && <p role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] font-semibold text-amber-900">No members or department head are assigned to {selectedDepartment.name}. Add a department member or head before assigning a task.</p>}
                    </>
                  ) : assignmentMode === 'employee' ? (
                    <select required value={empId} onChange={(e) => setEmpId(e.target.value)} className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]">
                      <option value="">-- Choose Employee --</option>
                      {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>)}
                    </select>
                  ) : (
                    <select required value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]">
                      <option value="">-- Choose Designation --</option>
                      {[...new Set(employees.filter(e => e.status === 'Active').map(e => e.designation))].map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-[#0A2342] mb-1">Link Unresolved Hazard</label>
                  <select
                    value={linkedIssueId}
                    onChange={(e) => setLinkedIssueId(e.target.value)}
                    disabled={assignmentMode === 'department'}
                    className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
                  >
                    <option value="">{assignmentMode === 'department' ? '-- Department task (no individual hazard link) --' : '-- None / General Directive --'}</option>
                    {issues.filter(i => i.status !== 'Resolved').map(i => (
                      <option key={i.id} value={i.id}>{i.id} - {i.category} ({i.locationName})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0A2342] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#0A2342] mb-1">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0A2342] mb-1">Detailed Work Instructions</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specific maintenance tasks, safety protocols, equipment..."
                  className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignmentMode === 'department' && (!selectedDepartment || !departmentHasStaff)}
                  className="px-4 py-2 text-xs bg-[#0755C9] hover:bg-[#0647A8] text-white font-bold rounded-lg"
                >
                  Dispatch Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#D9E1EF] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-extrabold text-[#0755C9] text-xs">{selectedTaskDetail.id}</span>
                <h3 className="text-base font-bold text-[#0A2342]">{selectedTaskDetail.title}</h3>
              </div>
              <StatusBadge status={selectedTaskDetail.status} />
            </div>

            <div className="space-y-2 text-xs text-[#0A2342]">
              <p><strong>Assigned Staff:</strong> {selectedTaskDetail.assignedEmployeeName}</p>
              <p><strong>Linked Issue ID:</strong> {selectedTaskDetail.linkedIssueId || 'None'}</p>
              <p><strong>Priority:</strong> {selectedTaskDetail.priority}</p>
              <p><strong>Created Date:</strong> {selectedTaskDetail.createdDate}</p>
              <p><strong>Target Due Date:</strong> {selectedTaskDetail.dueDate}</p>
              <div className="p-3 bg-[#F7F9FD] rounded-lg border border-slate-200 mt-2">
                <strong className="block text-slate-500 mb-1">Instructions:</strong>
                <p className="text-slate-700 leading-relaxed">{selectedTaskDetail.description || 'No additional instructions.'}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTaskDetail(null)}
                className="px-4 py-2 text-xs bg-[#0755C9] text-white font-bold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
