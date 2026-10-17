import React, { useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { MetricCard } from '../../components/common/MetricCard';
import {
  BarChart3,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Layers,
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

export const AnalyticsReportsPage = () => {
  const { issues, activeIssues, resolvedIssuesList, employees, tasks } = useRoadGuard();

  const [dateRange, setDateRange] = useState('Last 30 Days');

  // Key Analytics Calculations
  const totalReports = issues.reduce((acc, i) => acc + (i.reportCount || 1), 0);
  const uniqueIssues = issues.length;
  const pendingCount = issues.filter(issue => issue.status === 'Unassigned').length;
  const resolvedCount = resolvedIssuesList.length;
  const resolutionDurations = resolvedIssuesList.map(i => (new Date(i.resolutionDate || i.lastUpdated).getTime() - new Date(i.reportedAt || i.reportedDate).getTime()) / 3600000).filter(hours => Number.isFinite(hours) && hours >= 0);
  const avgResolutionTime = resolutionDurations.length ? `${(resolutionDurations.reduce((a, b) => a + b, 0) / resolutionDurations.length).toFixed(1)} Hours` : '—';
  const duplicateReportCount = totalReports - uniqueIssues;
  const highPriorityCount = issues.filter(i => i.priority === 'Critical' || i.priority === 'High').length;
  const resolvedTaskCount = tasks.filter(task => task.status === 'Resolved').length;
  const taskCompletionRate = tasks.length ? `${(resolvedTaskCount / tasks.length * 100).toFixed(1)}%` : '0%';

  // Visualisation Datasets
  const dayCount = dateRange === 'Last 7 Days' ? 7 : dateRange === 'Quarter to Date' ? 90 : 30;
  const trendData = Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - dayCount + 1 + index);
    const key = day.toISOString().slice(0, 10);
    const dayIssues = issues.filter(issue => issue.reportedAt && new Date(issue.reportedAt).toISOString().slice(0, 10) === key);
    const resolved = resolvedIssuesList.filter(issue => issue.resolutionDate && new Date(issue.resolutionDate).toISOString().slice(0, 10) === key).length;
    return { period: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), Reports: dayIssues.reduce((sum, issue) => sum + (issue.reportCount || 1), 0), Resolved: resolved };
  });

  const categoryDistribution = issues.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(categoryDistribution).map(([name, value]) => ({ name, value }));
  const COLORS = ['#0755C9', '#10B981', '#F59E0B', '#DC2626', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];
  const encodeGeohash = (latitude, longitude, precision = 5) => {
    const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
    let lat = [-90, 90], lon = [-180, 180], even = true, bits = 0, value = 0, hash = '';
    while (hash.length < precision) {
      const range = even ? lon : lat;
      const coordinate = even ? longitude : latitude;
      const midpoint = (range[0] + range[1]) / 2;
      value = (value << 1) | (coordinate >= midpoint ? 1 : 0);
      if (coordinate >= midpoint) range[0] = midpoint; else range[1] = midpoint;
      even = !even;
      if (++bits === 5) { hash += alphabet[value]; bits = 0; value = 0; }
    }
    return hash;
  };

  const areaDistribution = Object.entries(issues.reduce((groups, issue) => {
    const area = issue.locationName && issue.locationName !== 'GPS Coordinates' ? issue.locationName : encodeGeohash(Number(issue.latitude || 0), Number(issue.longitude || 0));
    groups[area] = (groups[area] || 0) + 1; return groups;
  }, {})).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const resolutionTimeData = Object.values(resolvedIssuesList.reduce((groups, issue) => {
    const hours = (new Date(issue.resolutionDate || issue.lastUpdated).getTime() - new Date(issue.reportedAt || issue.reportedDate).getTime()) / 3600000;
    if (Number.isFinite(hours) && hours >= 0) {
      const category = issue.category || 'Other'; groups[category] ||= { category, hours: 0, count: 0 };
      groups[category].hours += hours; groups[category].count += 1;
    }
    return groups;
  }, {})).map(row => ({ category: row.category, hours: row.hours / row.count }));
  const employeePerformance = employees.map(employee => {
    const assigned = tasks.filter(task => String(task.employeeId || task.assignedEmployeeId) === String(employee.id));
    return { name: employee.name, completed: assigned.filter(task => task.status === 'Resolved').length, total: assigned.length };
  }).filter(row => row.total).sort((a, b) => b.completed - a.completed).slice(0, 8);

  // CSV Export Handler
  const handleExportAnalyticsCSV = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Citizen Reports', totalReports],
      ['Unique Hazard Reports', uniqueIssues],
      ['Pending Issues', pendingCount],
      ['Resolved Issues', resolvedCount],
      ['Average Resolution Time', avgResolutionTime],
      ['Duplicate Reports', duplicateReportCount],
      ['High Priority Hazards', highPriorityCount],
      ['Task Completion Rate', taskCompletionRate]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RoadGuard_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#0755C9]" />
            Municipal Traffic Analytics & Insights
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Statistical performance metrics, hazard resolution velocity, and geographical distribution
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-bold text-[#0A2342]"
          >
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="Quarter to Date">Quarter to Date</option>
          </select>

          <button
            onClick={handleExportAnalyticsCSV}
            className="px-4 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* 8 Primary Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Reports"
          value={totalReports}
          subtext="Raw citizen submissions"
          icon={Layers}
          color="blue"
        />
        <MetricCard
          title="Unique Issues"
          value={uniqueIssues}
          subtext="Grouped hazards"
          icon={AlertCircle}
          color="indigo"
        />
        <MetricCard
          title="Pending Issues"
          value={pendingCount}
          subtext="Awaiting assignment"
          icon={Clock}
          color="amber"
        />
        <MetricCard
          title="Resolved"
          value={resolvedCount}
          subtext="Closed & verified"
          icon={CheckCircle2}
          color="emerald"
        />
        <MetricCard
          title="Avg Resolution"
          value={avgResolutionTime}
          subtext="Time to repair"
          icon={TrendingUp}
          color="purple"
        />
        <MetricCard
          title="Duplicate Reports"
          value={duplicateReportCount}
          subtext="Clustered by location"
          icon={Layers}
          color="blue"
        />
        <MetricCard
          title="High Priority"
          value={highPriorityCount}
          subtext="Critical & High"
          icon={AlertCircle}
          color="red"
        />
        <MetricCard
          title="Completion Rate"
          value={taskCompletionRate}
          subtext="Field staff SLA"
          icon={Users}
          color="emerald"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Hazard Trends Over Time */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Weekly Hazard Ingestion Trends</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Volume breakdown across major hazard categories</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="Reports" stroke="#0755C9" strokeWidth={2} />
                <Line type="monotone" dataKey="Resolved" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Share Pie */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Hazard Category Share</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Proportion of reported issues</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Distribution */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Issue Concentration by Municipal Area</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Issue counts by reported area or coordinate grid</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="area" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#0755C9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg Resolution Time Comparison */}
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Resolution Time by Hazard Type</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Average duration calculated from resolved issue timestamps</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resolutionTimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis dataKey="category" type="category" stroke="#64748B" fontSize={11} width={85} />
                <Tooltip contentStyle={{ backgroundColor: '#0A2342', color: '#FFF', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="hours" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2342] mb-1">Employee Performance</h3>
          <p className="text-[11px] text-[#52627A] mb-4">Assigned and resolved work orders by employee</p>
          <div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={employeePerformance} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={95} fontSize={10} /><Tooltip /><Legend /><Bar dataKey="completed" name="Resolved" fill="#10B981" /><Bar dataKey="total" name="Assigned" fill="#0755C9" /></BarChart></ResponsiveContainer></div>
        </div>
      </div>
    </div>
  );
};
