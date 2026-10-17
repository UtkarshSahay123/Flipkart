import React, { useEffect, useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { X, UserCheck, Calendar, ShieldAlert } from 'lucide-react';
import { portalApi } from '../../lib/portalApi';

export const AssignTaskModal = ({ isOpen, onClose, issue }) => {
  const { employees, createTask, showToast } = useRoadGuard();

  const [selectedEmpId, setSelectedEmpId] = useState(issue?.assignedEmployeeId || '');
  const [assignmentMode, setAssignmentMode] = useState('employee');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [departmentMembers, setDepartmentMembers] = useState([]);
  const [selectedDesignation, setSelectedDesignation] = useState('');
  const [saving, setSaving] = useState(false);
  const [taskTitle, setTaskTitle] = useState(issue ? `Dispatch Repair: ${issue.category} at ${issue.locationName}` : '');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [priority, setPriority] = useState(issue?.priority || 'High');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !issue) return;
    setSelectedEmpId(issue.assignedEmployeeId ? String(issue.assignedEmployeeId) : '');
    setAssignmentMode('employee');
    setDepartmentId('');
    setSelectedDesignation('');
    setTaskTitle(`Dispatch Repair: ${issue.category || 'Road issue'} (${issue.id})`);
    setPriority(issue.priority || 'High');
    setNotes('');
  }, [isOpen, issue]);

  useEffect(() => { if (isOpen) portalApi('/departments').then(setDepartments).catch(error => showToast(error.message, 'error')); }, [isOpen, showToast]);
  useEffect(() => { if (departmentId) portalApi(`/departments/${departmentId}/members`).then(setDepartmentMembers).catch(error => showToast(error.message, 'error')); else setDepartmentMembers([]); }, [departmentId, showToast]);

  if (!isOpen || !issue) return null;

  const activeEmployees = employees.filter(e => e.status === 'Active');

  const designations = [...new Set(activeEmployees.map(employee => employee.designation).filter(Boolean))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (assignmentMode === 'employee' && !selectedEmpId) return;
    if (assignmentMode === 'designation' && !selectedDesignation) return;
    if (assignmentMode === 'department' && !departmentId) return;
    if (assignmentMode === 'direct' && !selectedEmpId) return;
    setSaving(true);
    if (assignmentMode === 'department' || assignmentMode === 'direct') {
      try {
        const body = { title: (taskTitle || `Repair ${issue.category} (${issue.id})`).trim().slice(0, 160), issueId: issue.id, departmentId: Number(departmentId), employeeId: assignmentMode === 'direct' ? Number(selectedEmpId) : null, priority, dueDate, description: notes || issue.description };
        if (assignmentMode === 'department') await portalApi('/tasks/assign-department', { method: 'POST', body: JSON.stringify(body) });
        else await portalApi('/admin/tasks/assign-direct', { method: 'POST', body: JSON.stringify(body) });
        showToast(assignmentMode === 'department' ? 'Task assigned to department.' : 'Task assigned directly to department member.', 'success');
        setSaving(false); onClose(); return;
      } catch (error) { showToast(`Could not assign task: ${error.message}`, 'error'); setSaving(false); return; }
    }
    const created = await createTask({
      title: (taskTitle || `Repair ${issue.category} (${issue.id})`).trim().slice(0, 160),
      linkedIssueId: issue.id,
      linkedIssueCategory: issue.category,
      assignedEmployeeId: assignmentMode === 'employee' ? selectedEmpId : null,
      designation: assignmentMode === 'designation' ? selectedDesignation : null,
      priority,
      dueDate,
      description: notes || issue.description
    });

    setSaving(false);
    if (created) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full border border-[#D9E1EF] shadow-2xl overflow-hidden">
        <div className="p-4 bg-[#F7F9FD] border-b border-[#D9E1EF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-[#0755C9] rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0A2342]">Assign Task & Employee</h3>
              <p className="text-xs text-[#52627A]">Issue ID: <span className="font-bold text-[#0755C9]">{issue.id}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-[#0A2342]">
          <div>
            <label className="block font-bold text-[#0A2342] mb-1">Assign by</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[['employee','Employee'],['designation','Designation'],['department','Department'],['direct','Direct member']].map(([mode,label]) => <button key={mode} type="button" onClick={() => setAssignmentMode(mode)} className={`px-3 py-2 rounded-lg border font-semibold ${assignmentMode === mode ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-[#D9E1EF]'}`}>{label}</button>)}
            </div>
            {assignmentMode === 'employee' ? <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} required className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium">
              <option value="">-- Choose Staff Member --</option>
              {activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation}) — Active Tasks: {emp.assignedTasks || 0}</option>)}
            </select> : assignmentMode === 'designation' ? <select value={selectedDesignation} onChange={(e) => setSelectedDesignation(e.target.value)} required className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium">
              <option value="">-- Choose Designation --</option>
              {designations.map(designation => <option key={designation} value={designation}>{designation} ({activeEmployees.filter(employee => employee.designation === designation).length} active)</option>)}
            </select> : <div className="space-y-2"><select value={departmentId} onChange={event => { setDepartmentId(event.target.value); setSelectedEmpId(''); }} required className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg"><option value="">Choose a department</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select>{assignmentMode === 'direct' && <select value={selectedEmpId} onChange={event => setSelectedEmpId(event.target.value)} required className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg"><option value="">Choose an active approved member</option>{departmentMembers.filter(member => member.role === 'EMPLOYEE').map(member => <option key={member.id} value={member.id}>{member.name} — {member.designation || 'Member'}</option>)}</select>}</div>}
          </div>

          <div>
            <label className="block font-bold text-[#0A2342] mb-1">Task Title *</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              maxLength={160}
              required
              className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#0A2342] mb-1">Task Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-[#0A2342] mb-1">Target Completion Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#0A2342] mb-1">Field Work Directives & Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specify equipment, safety precautions, or resurfacing guidelines..."
              className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white rounded-lg font-bold shadow-xs transition-colors"
            >
              {saving ? 'Assigning…' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
