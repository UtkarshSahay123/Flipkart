import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { IssueDetailDrawer } from '../../features/issues/IssueDetailDrawer';
import { EmptyState } from '../../components/common/EmptyState';
import {
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Download,
  MapPin,
  Eye,
  Calendar
} from 'lucide-react';

export const ResolvedIssuesPage = () => {
  const navigate = useNavigate();
  const { resolvedIssuesList, reopenIssue } = useRoadGuard();

  const [search, setSearch] = useState('');
  const [selectedIssueDrawer, setSelectedIssueDrawer] = useState(null);

  const filteredResolved = resolvedIssuesList.filter(item => {
    const matchSearch =
      String(item.id ?? '').toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.locationName.toLowerCase().includes(search.toLowerCase()) ||
      (item.assignedEmployeeName && item.assignedEmployeeName.toLowerCase().includes(search.toLowerCase()));
    return matchSearch;
  });

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredResolved.length === 0) return;

    const headers = ['Issue ID', 'Category', 'Location', 'Report Count', 'Resolution Date', 'Employee', 'Duration', 'Notes'];
    const rows = filteredResolved.map(r => [
      r.id,
      r.category,
      `"${r.locationName}"`,
      r.reportCount,
      r.resolutionDate || '',
      `"${r.assignedEmployeeName || 'Team'}"`,
      `"${r.resolutionDuration || ''}"`,
      `"${(r.resolutionNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RoadGuard_Resolved_Issues_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Resolved Issues History Log
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Archival repository of completed road repairs, quality certifications, and resolution metrics ({filteredResolved.length} records)
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
        >
          <Download className="w-4 h-4" />
          Export CSV Report
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search resolved issues by ID, category, location, staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
          />
        </div>
      </div>

      {/* Table */}
      {filteredResolved.length === 0 ? (
        <EmptyState
          title="No resolved issues recorded"
          description="Issues marked as resolved will appear in this historical audit log."
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#D9E1EF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#0A2342]">
              <thead className="bg-[#EEF3FF] border-b border-[#D9E1EF] text-[#52627A] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Issue ID</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-center">Reports</th>
                  <th className="px-4 py-3">Resolution Date</th>
                  <th className="px-4 py-3">Responsible Staff</th>
                  <th className="px-4 py-3">Resolution Notes</th>
                  <th className="px-4 py-3 text-[#52627A]">Duration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredResolved.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#0755C9]">{item.id}</td>
                    <td className="px-4 py-3 font-bold text-[#0A2342]">{item.category}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">{item.locationName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                        {item.reportCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">{item.resolutionDate || 'Recent'}</td>
                    <td className="px-4 py-3 font-bold text-[#0A2342]">{item.assignedEmployeeName || 'Municipal Team'}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{item.resolutionNotes || 'Repaired.'}</td>
                    <td className="px-4 py-3 text-emerald-700 font-bold text-[11px]">{item.resolutionDuration || '2 hours'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedIssueDrawer(item)}
                          className="p-1.5 bg-blue-50 text-[#0755C9] hover:bg-blue-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => reopenIssue(item.id)}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[11px] font-bold transition-colors flex items-center gap-1"
                          title="Reopen Issue"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reopen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Detail Drawer */}
      {selectedIssueDrawer && (
        <IssueDetailDrawer
          issue={selectedIssueDrawer}
          onClose={() => setSelectedIssueDrawer(null)}
        />
      )}
    </div>
  );
};
