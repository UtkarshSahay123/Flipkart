import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Mail, RefreshCw } from 'lucide-react';
import { authHeaders } from '../../lib/portalApi';

const API_BASE = window.location.origin;

export const UserReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/bug-reports`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Could not load user reports.');
      const data = await response.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load user reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9E1EF] bg-white p-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-[#0A2342]"><AlertCircle className="h-5 w-5 text-[#0755C9]" /> User Reports</h1>
          <p className="mt-1 text-sm text-[#52627A]">Issues submitted through the website’s Report a bug form.</p>
        </div>
        <button onClick={loadReports} disabled={loading} className="flex items-center gap-2 rounded-lg border border-[#D9E1EF] px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading reports…</p> : reports.length === 0 ? (
        <div className="rounded-xl border border-[#D9E1EF] bg-white p-10 text-center text-sm text-slate-500">No user reports have been submitted yet.</div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <article key={report.id} className="rounded-xl border border-[#D9E1EF] bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[#0A2342]">{report.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">{report.id} · {report.created_at ? new Date(report.created_at).toLocaleString() : 'Date unavailable'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{report.severity}</span>
                  <span title={report.email_sent ? 'Email sent' : 'Email delivery failed'} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${report.email_sent ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}><Mail className="h-3.5 w-3.5" />{report.email_sent ? 'Emailed' : 'Portal only'}</span>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{report.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>Page: {report.page_url || 'Not provided'}</span>
                {report.page_url && <a href={report.page_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0755C9] hover:underline">Open page <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
