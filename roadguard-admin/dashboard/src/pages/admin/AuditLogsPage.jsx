import React, { useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { EmptyState } from '../../components/common/EmptyState';
import {
  FileText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  User
} from 'lucide-react';

export const AuditLogsPage = () => {
  const { auditLogs } = useRoadGuard();
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs.filter(Boolean) : [];

  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter Event Types
  const eventTypes = Array.from(new Set(safeAuditLogs.map(l => l.eventType).filter(Boolean)));

  const normalizedSearch = search.trim().toLowerCase();
  const searchableText = value => String(value ?? '').toLowerCase();
  const filteredLogs = safeAuditLogs.filter(l => {
    const matchSearch = [l.id, l.actor, l.targetEntity, l.description]
      .some(value => searchableText(value).includes(normalizedSearch));

    const matchType = eventTypeFilter === 'All' || l.eventType === eventTypeFilter;
    return matchSearch && matchType;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    const headers = ['Event ID', 'Timestamp', 'Actor', 'Event Type', 'Target Entity', 'Description', 'Result'];
    const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredLogs.map(l => [
      csvCell(l.id), csvCell(l.timestamp), csvCell(l.actor), csvCell(l.eventType),
      csvCell(l.targetEntity), csvCell(l.description), csvCell(l.result)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RoadGuard_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
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
            <FileText className="w-5 h-5 text-[#0755C9]" />
            System Audit & Operations Log
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Immutable operation log of administrative actions, task assignments, and system status changes
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-[#0755C9] hover:bg-[#0647A8] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
        >
          <Download className="w-4 h-4" />
          Export Audit CSV
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit events by ID, actor, entity, description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] font-medium"
          />
        </div>

        <select
          value={eventTypeFilter}
          onChange={(e) => {
            setEventTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
        >
          <option value="All">All Event Types</option>
          {eventTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          title="No audit events found"
          description="Try broadening search criteria or event type filters."
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#D9E1EF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#0A2342]">
              <thead className="bg-[#EEF3FF] border-b border-[#D9E1EF] text-[#52627A] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Event ID</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor / Admin</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Target Entity</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-[#52627A]">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#0755C9]">{log.id}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{log.timestamp}</td>
                    <td className="px-4 py-3 font-bold text-[#0A2342]">{log.actor}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-[#0755C9] border border-blue-200">
                        {log.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">{log.targetEntity}</td>
                    <td className="px-4 py-3 text-slate-600 leading-snug">{log.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        log.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 bg-[#F7F9FD] border-t border-[#D9E1EF] flex items-center justify-between text-xs text-[#52627A]">
              <span>
                Page <strong className="text-[#0A2342]">{currentPage}</strong> of <strong className="text-[#0A2342]">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-[#D9E1EF] bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-[#D9E1EF] bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
