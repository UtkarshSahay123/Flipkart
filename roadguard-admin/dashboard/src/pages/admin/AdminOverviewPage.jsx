import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { MetricCard } from '../../components/common/MetricCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { portalApi } from '../../lib/portalApi';
import {
  AlertCircle,
  Clock,
  Zap,
  RefreshCw,
  CheckCircle2,
  Users,
  Search,
  Filter,
  ArrowRight,
  Eye,
  UserPlus,
  ShieldCheck,
  TrendingUp,
  MapPin
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';

export const AdminOverviewPage = () => {
  const navigate = useNavigate();
  const {
    issues,
    activeIssues,
    pendingIssues,
    highPriorityIssues,
    inProgressIssues,
    resolvedIssuesList,
    employees,
    activeEmployeesCount,
    tasks,
    taskHistoryEvents
  } = useRoadGuard();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [departments, setDepartments] = useState([]);
  useEffect(() => { portalApi('/admin/departments/overview').then(setDepartments).catch(() => setDepartments([])); }, []);

  // Chart 1: Reports over time (Last 7 Days)
  const lineChartData = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - 6 + index);
    const key = day.toISOString().slice(0, 10);
    const reported = issues.filter(issue => issue.reportedAt && new Date(issue.reportedAt).toISOString().slice(0, 10) === key);
    const resolved = resolvedIssuesList.filter(issue => issue.resolutionDate && new Date(issue.resolutionDate).toISOString().slice(0, 10) === key).length;
    return { day: day.toLocaleDateString(undefined, { weekday: 'short' }), reports: reported.reduce((sum, issue) => sum + (issue.reportCount || 1), 0), resolved };
  });

  // Chart 2: Category Breakdown
  const categoryCounts = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {});

  const categoryPieData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  const COLORS = ['#0755C9', '#10B981', '#F59E0B', '#DC2626', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

  // Chart 3: Priority Distribution
  const priorityData = [
    { priority: 'Critical', count: issues.filter(i => i.priority === 'Critical').length, fill: '#DC2626' },
    { priority: 'High', count: issues.filter(i => i.priority === 'High').length, fill: '#F59E0B' },
    { priority: 'Medium', count: issues.filter(i => i.priority === 'Medium').length, fill: '#3B82F6' },
    { priority: 'Low', count: issues.filter(i => i.priority === 'Low').length, fill: '#64748B' },
  ];

  // Chart 4: Active vs Resolved
  const statusComparisonData = [
    { status: 'Unassigned', count: pendingIssues.length },
    { status: 'Assigned', count: issues.filter(i => i.status === 'Assigned').length },
    { status: 'In Progress', count: inProgressIssues.length },
    { status: 'Resolved', count: resolvedIssuesList.length },
  ];

  // Chart 5: Employee Completion Top Performers
  const employeeCompletionData = employees
    .filter(e => e.status === 'Active')
    .map(e => ({ name: e.name.split(' ')[0], completed: e.completedTasks }))
    .slice(0, 5);

  const resolvedTaskIssueIds = new Set(taskHistoryEvents
    .filter(event => event.status === 'Resolved')
    .map(event => tasks.find(task => String(task.id) === String(event.taskId))?.issueId)
    .filter(Boolean).map(String));
  const systemActivity = [
    ...issues.filter(issue => issue.reportedAt).map(issue => ({
      id: `reported-${issue.id}`, timestamp: issue.reportedAt, actor: 'Public reporter',
      eventType: 'ISSUE_REPORTED', targetEntity: issue.id,
      description: `${issue.title} reported at ${issue.locationName || 'a GPS location'}${issue.reportCount > 1 ? ` (${issue.reportCount} reports)` : ''}`
    })),
    ...taskHistoryEvents.map(event => ({
      id: `task-${event.id}`, timestamp: event.changedAt, actor: event.actor || event.employeeName || 'Organization user',
      eventType: 'TASK_STATUS_CHANGE', targetEntity: event.taskId,
      description: `${event.taskTitle} assigned to ${event.employeeName || 'employee'}: ${event.status}`
    })),
    ...resolvedIssuesList.filter(issue => issue.resolutionDate && !resolvedTaskIssueIds.has(String(issue.id))).map(issue => ({
      id: `resolved-${issue.id}`, timestamp: issue.resolutionDate, actor: 'Admin',
      eventType: 'ISSUE_RESOLVED', targetEntity: issue.id,
      description: `${issue.title} marked resolved at ${issue.locationName || 'reported location'}`
    }))
  ].filter(event => Number.isFinite(new Date(event.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6)
    .map(event => ({ ...event, timestamp: new Date(event.timestamp).toLocaleString() }));

  // Priority Queue Table Data (Sorted by Priority Score & Report Count)
  const priorityQueue = activeIssues
    .filter(i => {
      const matchesSearch = String(i.id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.locationName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  return (
    <div className="space-[#0A2342] space-y-6">
      {/* Page Heading Banner */}
      <div className="bg-white p-6 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0A2342] tracking-tight">
            Municipal Administration Dashboard
          </h1>
          <p className="text-xs text-[#52627A] mt-1 leading-relaxed max-w-2xl">
            Monitor road hazards, coordinate field teams, and track issue resolution across your organisation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/map')}
            className="px-4 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            <MapPin className="w-4 h-4" />
            Live Map Command
          </button>
          <button
            onClick={() => navigate('/admin/issues')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0A2342] text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            Manage Issues ({activeIssues.length})
          </button>
        </div>
      </div>

      {/* 6 Interactive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Issues"
          value={issues.length}
          subtext="Total logged hazards"
          icon={AlertCircle}
          color="blue"
          onClick={() => navigate('/admin/issues')}
        />
        <MetricCard
          title="Pending Issues"
          value={pendingIssues.length}
          subtext="Unassigned hazards"
          icon={Clock}
          color="amber"
          badgeText="Requires Action"
          onClick={() => navigate('/admin/issues?status=Unassigned')}
        />
        <MetricCard
          title="High-Priority"
          value={highPriorityIssues.length}
          subtext="Critical & High risk"
          icon={Zap}
          color="red"
          badgeText="High Urgency"
          onClick={() => navigate('/admin/issues?priority=Critical')}
        />
        <MetricCard
          title="In Progress"
          value={inProgressIssues.length}
          subtext="Active field repair"
          icon={RefreshCw}
          color="indigo"
          badgeText="Crew Dispatched"
          onClick={() => navigate('/admin/issues?status=In Progress')}
        />
        <MetricCard
          title="Resolved Issues"
          value={resolvedIssuesList.length}
          subtext="Successfully closed"
          icon={CheckCircle2}
          color="emerald"
          badgeText="Completed"
          onClick={() => navigate('/admin/resolved')}
        />
        <MetricCard
          title="Active Staff"
          value={activeEmployeesCount}
          subtext="Field Engineers & Officers"
          icon={Users}
          color="purple"
          badgeText="Operational"
          onClick={() => navigate('/admin/employees')}
        />
      </div>

      {departments.length > 0 && <section className="rounded-2xl border border-[#D9E1EF] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-[#0A2342]">Department task progress</h2><p className="text-xs text-slate-500">Tasks pending, underway and resolved in each department.</p></div><button onClick={() => navigate('/admin/departments')} className="text-xs font-bold text-blue-700">Departments Overview →</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{departments.map(department => <button key={department.id} onClick={() => navigate('/admin/departments')} className="rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/30"><p className="font-semibold text-slate-900">{department.name}</p><p className="mt-1 text-xs text-slate-500">Head: {department.head?.name || 'Not assigned'} · {department.memberCount} members</p><div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">Pending {department.pendingTasks}</span><span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">Active {department.inProgressTasks}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">Resolved {department.resolvedTasks}</span></div></button>)}</div></section>}

      {/* Recharts Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart: Reports vs Resolutions */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0A2342]">Issue Reports Over Time</h3>
              <p className="text-[11px] text-[#52627A]">Daily hazard reports vs successful repairs (Last 7 Days)</p>
            </div>
            <span className="text-[10px] font-semibold text-[#0755C9] bg-blue-50 px-2 py-1 rounded">
              Live Issue Data
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="reports" stroke="#0755C9" strokeWidth={2.5} name="Reports Ingested" />
                <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2.5} name="Issues Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Doughnut Chart: Category Distribution */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0A2342]">Issues by Category</h3>
              <p className="text-[11px] text-[#52627A]">Percentage share of road hazards</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts & Employee Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Priority Distribution */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Priority Distribution</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Active issues categorised by severity level</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="priority" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active vs Resolved Comparison */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Status Funnel</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Hazard lifecycle resolution stage count</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusComparisonData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="status" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#0755C9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employee Completion */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Employee Task Completion</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Top performing municipal field engineers</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeCompletionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} width={60} />
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="completed" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Priority Queue & Activity Timeline Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Queue Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#D9E1EF] shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-[#F7F9FD] border-b border-[#D9E1EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#0A2342]">Priority Action Queue</h3>
              <p className="text-[11px] text-[#52627A]">Highest priority unresolved hazards requiring immediate attention</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search queue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] w-36 sm:w-44"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2 py-1.5 text-xs bg-white border border-[#D9E1EF] rounded-lg text-[#0A2342]"
              >
                <option value="All">All Categories</option>
                <option value="Pothole">Pothole</option>
                <option value="Waterlogging / Flood">Waterlogging</option>
                <option value="Broken Traffic Signal">Traffic Signal</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-[#0A2342]">
              <thead className="bg-[#EEF3FF] border-b border-[#D9E1EF] text-[#52627A] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Issue ID</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-center">Reports</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {priorityQueue.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No priority hazards matching criteria.
                    </td>
                  </tr>
                ) : (
                  priorityQueue.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-[#0755C9]">{item.id}</td>
                      <td className="px-4 py-3 font-semibold">{item.category}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">{item.locationName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                          {item.reportCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.assignedEmployeeName || <span className="text-amber-600 italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/admin/issues?id=${item.id}`)}
                          className="px-2.5 py-1 bg-[#0755C9] hover:bg-[#0647A8] text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#F7F9FD] border-t border-[#D9E1EF] text-right">
            <button
              onClick={() => navigate('/admin/issues')}
              className="text-xs font-bold text-[#0755C9] hover:underline inline-flex items-center gap-1"
            >
              View Full Issue Catalog ({activeIssues.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-white rounded-xl border border-[#D9E1EF] shadow-xs p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0A2342]">Recent System Activity</h3>
              <p className="text-[11px] text-[#52627A]">Real-time operational activity feed</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Feed
            </span>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {systemActivity.map((log) => (
              <div key={log.id} className="flex gap-3 text-xs">
                <div className="mt-0.5 p-1.5 bg-blue-50 text-[#0755C9] rounded-full h-fit shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#0A2342]">{log.actor}</p>
                    <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5 leading-snug">{log.description}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {log.eventType} • {log.targetEntity}
                  </span>
                </div>
              </div>
            ))}
            {systemActivity.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No issue reports or task updates have been recorded yet.</p>}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 font-medium">Live issue and task records · refreshes automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
};
