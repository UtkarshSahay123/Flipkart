import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { ISSUE_CATEGORIES } from '../../data/mockData';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { IssueDetailDrawer } from '../../features/issues/IssueDetailDrawer';
import { AssignTaskModal } from '../../features/issues/AssignTaskModal';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Search,
  Filter,
  Grid,
  List,
  Eye,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileSpreadsheet,
  Users,
  TrendingUp,
  Zap
} from 'lucide-react';

// Priority score heat-colour badge
const PriorityScoreBadge = ({ score, reportCount }) => {
  let bg = 'bg-slate-100 text-slate-600';
  let icon = null;
  if (score >= 5) { bg = 'bg-red-100 text-red-700 ring-1 ring-red-300'; icon = '🔥'; }
  else if (score >= 3) { bg = 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'; icon = '⚡'; }
  else if (score >= 2) { bg = 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'; icon = '👥'; }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${bg}`}>
      {icon && <span>{icon}</span>}
      {reportCount} report{reportCount !== 1 ? 's' : ''}
      <span className="opacity-60 font-normal">/ score {score}</span>
    </span>
  );
};

const getIssueStatusLabel = (status) => {
  const label = String(status || 'Unknown').trim();
  const normalized = label.toLowerCase();
  return ['resolved', 'closed', 'complete', 'completed'].includes(normalized) ? label : 'LIVE';
};

const getReportedTime = (issue) => {
  const value = issue.reportedAt || issue.createdAt || issue.reportedDate;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const IssueManagementPage = () => {
  const [searchParams] = useSearchParams();
  const { issues, commandCenterSimulations, activeIssues, resolveIssue, reopenIssue, syncFromBackend } = useRoadGuard();

  // Filters & State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'All');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [sortBy, setSortBy] = useState('date');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'card'
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Selected Issue Drawer State
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assignIssueTarget, setAssignIssueTarget] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Auto select issue from URL param if present (e.g. ?id=RG-2026-8941)
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      const found = issues.find(i => i.id === idParam);
      if (found) setSelectedIssue(found);
    }
  }, [searchParams, issues]);

  // Manual sync handler
  const handleSync = async () => {
    setIsSyncing(true);
    await syncFromBackend();
    setLastSync(new Date().toLocaleTimeString());
    setIsSyncing(false);
  };

  // Filtering & Sorting logic
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchesSearch =
        String(issue.id ?? '').toLowerCase().includes(search.toLowerCase()) ||
        issue.title.toLowerCase().includes(search.toLowerCase()) ||
        issue.category.toLowerCase().includes(search.toLowerCase()) ||
        issue.locationName.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = categoryFilter === 'All' || issue.category === categoryFilter;
      const matchesPriority = priorityFilter === 'All' || issue.priority === priorityFilter;
      const matchesStatus = statusFilter === 'All' || issue.status === statusFilter;

      return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'date') return getReportedTime(b) - getReportedTime(a);
      if (Boolean(a.isFromBackend) !== Boolean(b.isFromBackend)) {
        return a.isFromBackend ? -1 : 1;
      }
      if (sortBy === 'priorityScore') return (b.priorityScore || 0) - (a.priorityScore || 0);
      if (sortBy === 'reportCount') return (b.reportCount || 0) - (a.reportCount || 0);
      return 0;
    });
  }, [issues, search, categoryFilter, priorityFilter, statusFilter, sortBy]);

  // Paginated Results
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage) || 1;
  const paginatedIssues = filteredIssues.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const orderedCommandCenterSimulations = useMemo(() => commandCenterSimulations
    .map((simulation, index) => {
      const linked = issues.find(issue => String(issue.id) === String(simulation.issue_id));
      const status = simulation.status || linked?.status || '';
      return { simulation, index, resolved: String(status).toLowerCase() === 'resolved' };
    })
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.index - b.index)
    .map(item => item.simulation), [commandCenterSimulations, issues]);

  // Live issues from backend (for summary banner)
  const liveIssues = issues.filter(i => i.isFromBackend);

  return (
    <div className="space-y-6">
      {/* Live Backend Issues Banner */}
      {liveIssues.length > 0 && (
        <div className="bg-gradient-to-r from-[#0755C9] to-[#1E40AF] p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {liveIssues.length} Live Citizen Report{liveIssues.length !== 1 ? 's' : ''} from Command Center
              </p>
              <p className="text-xs text-blue-100 mt-0.5">
                Sorted by priority score (report count) — highest duplicates shown first
                {lastSync && <span className="ml-2 opacity-70">· Last synced {lastSync}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg transition-colors border border-white/30 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* Header & Filter Controls Bar */}
      <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight">
              Issue Management Catalog
            </h1>
            <p className="text-xs text-[#52627A] mt-0.5">
              Review, filter, assign, and track road hazard resolutions ({filteredIssues.length} matching hazards)
              {' · '}
              <span className="font-semibold text-[#0755C9]">Newest reported issues first</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Manual Sync Button */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-[#EEF3FF] hover:bg-[#D9E1EF] text-[#0755C9] text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-[#D9E1EF]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Live'}
            </button>
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                  viewMode === 'table' ? 'bg-white text-[#0755C9] shadow-xs' : 'text-slate-600'
                }`}
              >
                <List className="w-4 h-4" />
                Table
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                  viewMode === 'card' ? 'bg-white text-[#0755C9] shadow-xs' : 'text-slate-600'
                }`}
              >
                <Grid className="w-4 h-4" />
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, category, description, location..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Categories</option>
            {ISSUE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Statuses</option>
            <option value="Unassigned">Unassigned</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="priorityScore">Sort: Priority Score ↓</option>
            <option value="reportCount">Sort: Most Reports ↓</option>
            <option value="date">Sort: Newest First</option>
          </select>
        </div>
      </div>

      {commandCenterSimulations.length > 0 && (
        <section className="rounded-xl border border-[#D9E1EF] bg-white p-5 shadow-xs" aria-label="Command Center incident updates">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-[#0A2342]">Command Center Incident Updates</h2>
              <p className="mt-1 text-xs text-[#52627A]">Live simulations and reported closure flags from the Command Center.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{commandCenterSimulations.length} update{commandCenterSimulations.length === 1 ? '' : 's'}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {orderedCommandCenterSimulations.slice(0, 8).map(simulation => {
              const linkedIssue = simulation.issue_id
                ? issues.find(issue => String(issue.id) === String(simulation.issue_id))
                : null;
              const closureKnown = typeof simulation.road_closure === 'boolean' || typeof linkedIssue?.road_closure === 'boolean';
              const closureReported = simulation.road_closure === true || linkedIssue?.road_closure === true;
              return (
                <article key={simulation.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#0A2342]">{simulation.type || 'Command Center incident'}</h3>
                      <p className="mt-1 text-xs text-slate-500">{simulation.location || 'Location unavailable'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${closureReported ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                      {closureReported ? 'ROAD CLOSURE' : closureKnown ? 'NO CLOSURE' : 'CLOSURE STATUS UNKNOWN'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">{simulation.description || 'No additional details were provided.'}</p>
                  {linkedIssue ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                      <div className="text-[11px] text-slate-600">
                        <span className="font-bold text-[#0755C9]">{linkedIssue.id}</span>
                        <span className="mx-1.5">·</span>
                        <span>{linkedIssue.status}</span>
                        {linkedIssue.assignedEmployeeName && <span> · Assigned to {linkedIssue.assignedEmployeeName}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedIssue(linkedIssue)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0755C9] hover:bg-blue-100"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        {linkedIssue.status !== 'Resolved' && (
                          <button
                            onClick={() => setAssignIssueTarget(linkedIssue)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#0A2342] ring-1 ring-slate-200 hover:bg-slate-100"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Assign
                          </button>
                        )}
                      </div>
                    </div>
                  ) : simulation.issue_id ? (
                    <p className="mt-2 text-[11px] font-semibold text-red-700">Linked issue {simulation.issue_id} is syncing. Use Sync Live to refresh.</p>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">No linked road issue was created for this simulation.</p>
                  )}
                </article>
              );
            })}
          </div>
          {orderedCommandCenterSimulations.length > 8 && <p className="mt-3 text-center text-xs text-slate-500">Showing the 8 newest updates, with active incidents first and resolved incidents below.</p>}
        </section>
      )}

      {/* Main View Display */}
      {paginatedIssues.length === 0 ? (
        <EmptyState
          title="No issues found"
          description="No road hazard records match your current search and filter parameters."
        />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl border border-[#D9E1EF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#0A2342]">
              <thead className="bg-[#EEF3FF] border-b border-[#D9E1EF] text-[#52627A] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Issue ID</th>
                  <th className="px-4 py-3">Category & Title</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Priority Score
                    </span>
                  </th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3">Reported</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedIssues.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      idx === 0 && (item.priorityScore || 0) >= 3 ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-[#0755C9]">
                      <div className="flex flex-col">
                        <button
                          onClick={() => setSelectedIssue(item)}
                          className="hover:underline text-left"
                        >
                          {item.id}
                        </button>
                        {item.isFromBackend && (
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded mt-0.5 w-fit ${getIssueStatusLabel(item.status) === 'LIVE' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 bg-slate-100'}`}>{getIssueStatusLabel(item.status)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#0A2342]">{item.category}</p>
                      <p className="text-[11px] text-[#52627A] truncate max-w-[200px]">{item.title}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[180px]">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#0755C9] shrink-0" />
                        {item.locationName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityScoreBadge
                        score={item.priorityScore || item.reportCount || 1}
                        reportCount={item.reportCount || 1}
                      />
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
                    <td className="px-4 py-3 text-slate-500 text-[11px]">{item.reportedDate}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedIssue(item)}
                          className="p-1.5 bg-blue-50 text-[#0755C9] hover:bg-blue-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {item.status !== 'Resolved' && (
                          <button
                            onClick={() => setAssignIssueTarget(item)}
                            className="p-1.5 bg-slate-100 text-[#0A2342] hover:bg-slate-200 rounded-lg transition-colors"
                            title="Assign Staff"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedIssues.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-[#D9E1EF] shadow-xs p-5 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-extrabold text-[#0755C9] text-xs">{item.id}</span>
                    {item.isFromBackend && (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded w-fit ${getIssueStatusLabel(item.status) === 'LIVE' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 bg-slate-100'}`}>{getIssueStatusLabel(item.status)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                {/* Priority Score Badge — prominent */}
                <div className="mb-2">
                  <PriorityScoreBadge
                    score={item.priorityScore || item.reportCount || 1}
                    reportCount={item.reportCount || 1}
                  />
                </div>

                <h3 className="font-bold text-sm text-[#0A2342] line-clamp-1 mb-1">{item.title}</h3>
                <p className="text-xs text-[#52627A] line-clamp-2 mb-3 leading-relaxed">{item.description}</p>

                {item.photos && item.photos.length > 0 && (
                  <div className="relative h-28 rounded-lg overflow-hidden mb-3 bg-slate-100 border border-slate-200">
                    <img src={item.photos[0]} alt="Thumbnail" className="w-full h-full object-cover" />
                    {(item.photo_count || item.photos.length) > 1 && (
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        +{(item.photo_count || item.photos.length) - 1} more
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-[#52627A] pt-2 border-t border-slate-100">
                  <p className="flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#0755C9] shrink-0" />
                    {item.locationName}
                  </p>
                  <p className="flex items-center gap-1">
                    <span className="font-bold text-[#0A2342]">Assigned:</span>{' '}
                    {item.assignedEmployeeName || <span className="text-amber-600">Unassigned</span>}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                  <Users className="w-3 h-3" />
                  {item.reportCount || 1} Report{(item.reportCount || 1) !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={() => setSelectedIssue(item)}
                  className="px-3 py-1.5 bg-[#0755C9] hover:bg-[#0647A8] text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] flex items-center justify-between text-xs text-[#52627A]">
          <span>
            Page <strong className="text-[#0A2342]">{currentPage}</strong> of <strong className="text-[#0A2342]">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[#D9E1EF] bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-[#D9E1EF] bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Issue Detail Drawer */}
      {selectedIssue && (
        <IssueDetailDrawer
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}

      {/* Quick Assign Modal */}
      {assignIssueTarget && (
        <AssignTaskModal
          isOpen={!!assignIssueTarget}
          onClose={() => setAssignIssueTarget(null)}
          issue={assignIssueTarget}
        />
      )}
    </div>
  );
};
