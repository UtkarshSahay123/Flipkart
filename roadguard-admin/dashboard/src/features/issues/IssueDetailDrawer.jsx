import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { AssignTaskModal } from './AssignTaskModal';
import {
  X,
  MapPin,
  Calendar,
  User,
  AlertCircle,
  FileText,
  Clock,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  Send,
  UserCheck,
  Maximize2
} from 'lucide-react';

export const IssueDetailDrawer = ({ issue, onClose }) => {
  const navigate = useNavigate();
  const { addAdminNote, resolveIssue, reopenIssue, updateIssue } = useRoadGuard();

  const [newNote, setNewNote] = useState('');
  const [resolutionInput, setResolutionInput] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState(null);
  const [allPhotos, setAllPhotos] = useState(issue.photos || []);

  useEffect(() => {
    setAllPhotos(issue.photos || []);
    if (!issue.isFromBackend) return;
    const apiBase = window.location.origin;
    let cancelled = false;
    fetch(`${apiBase}/api/issues/${encodeURIComponent(issue.id)}`)
      .then(res => res.ok ? res.json() : null)
      .then(detail => { if (!cancelled && detail?.photos) setAllPhotos(detail.photos); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [issue.id, issue.isFromBackend, issue.photos]);

  if (!issue) return null;

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    addAdminNote(issue.id, newNote);
    setNewNote('');
  };

  const handleResolveSubmit = (e) => {
    e.preventDefault();
    resolveIssue(issue.id, resolutionInput);
    setShowResolveModal(false);
    setResolutionInput('');
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (newStatus === "Resolved") {
      setShowResolveModal(true);
    } else {
      updateIssue(issue.id, { status: newStatus });
    }
  };

  // Download photo sample simulation
  const handleDownloadPhoto = (photoUrl, idx) => {
    const a = document.createElement('a');
    a.href = photoUrl;
    a.download = `RoadGuard_${issue.id}_photo_${idx + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Container */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl bg-white border-l border-[#D9E1EF] shadow-2xl flex flex-col overflow-hidden animate-slide-left">
        {/* Drawer Header */}
        <div className="p-4 bg-[#EEF3FF] border-b border-[#D9E1EF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0755C9] text-white rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0755C9]">{issue.id}</span>
                <PriorityBadge priority={issue.priority} />
                <StatusBadge status={issue.status} />
              </div>
              <h2 className="text-base font-bold text-[#0A2342] mt-0.5 truncate max-w-md">
                {issue.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Drawer Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#0A2342]">
          {/* Quick Actions Bar */}
          <div className="p-3 bg-[#F7F9FD] rounded-xl border border-[#D9E1EF] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="font-bold text-[#52627A]">Status:</label>
              <select
                value={issue.status}
                onChange={handleStatusChange}
                className="px-2.5 py-1 text-xs font-bold bg-white border border-[#D9E1EF] rounded-lg text-[#0A2342]"
              >
                <option value="Unassigned">Unassigned</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {issue.status !== 'Resolved' ? (
                <>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-3 py-1.5 bg-[#0755C9] hover:bg-[#0647A8] text-white rounded-lg font-bold transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    Assign Task
                  </button>
                  <button
                    onClick={() => setShowResolveModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Resolved
                  </button>
                </>
              ) : (
                <button
                  onClick={() => reopenIssue(issue.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reopen Hazard
                </button>
              )}

              <button
                onClick={() => {
                  onClose();
                  navigate(`/admin/map?lat=${issue.latitude}&lng=${issue.longitude}&id=${issue.id}`);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0A2342] rounded-lg font-bold transition-colors flex items-center gap-1.5"
              >
                <MapPin className="w-4 h-4 text-[#0755C9]" />
                View on Map
              </button>
            </div>
          </div>

          {/* Details Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-[#D9E1EF]">
            <div>
              <span className="text-[10px] text-[#52627A] uppercase font-bold tracking-wider block">Priority Score</span>
              <p className="text-base font-extrabold text-red-600 mt-0.5">{issue.priorityScore || issue.reportCount || 1}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#52627A] uppercase font-bold tracking-wider block">Report Count</span>
              <p className="text-base font-extrabold text-[#0755C9] mt-0.5">{issue.reportCount} duplicate reports</p>
            </div>
            <div>
              <span className="text-[10px] text-[#52627A] uppercase font-bold tracking-wider block">Assigned Staff</span>
              <p className="text-sm font-bold text-[#0A2342] truncate mt-0.5">{issue.assignedEmployeeName || 'Unassigned'}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#52627A] uppercase font-bold tracking-wider block">Reported Date</span>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">{issue.reportedDate}</p>
            </div>
          </div>

          {/* Description & Location */}
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-xl border border-[#D9E1EF]">
              <h4 className="font-bold text-sm text-[#0A2342] mb-1">Issue Description</h4>
              <p className="text-xs text-[#52627A] leading-relaxed">{issue.description}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#0755C9] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-[#0A2342]">GPS Location</h4>
                <p className="text-xs text-[#52627A] font-semibold mt-0.5">{issue.locationName}</p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Coordinates: {issue.latitude}, {issue.longitude}</p>
              </div>
            </div>
          </div>

          {/* Associated Photographs Preview */}
          <div className="bg-white p-4 rounded-xl border border-[#D9E1EF]">
            <h4 className="font-bold text-xs text-[#0A2342] mb-3 flex items-center justify-between">
              <span>Associated Field Photographs ({allPhotos.length || issue.photo_count || 0})</span>
              <span className="text-[10px] text-slate-400 font-normal">Click image to inspect</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {allPhotos.map((photoUrl, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#D9E1EF] bg-slate-100 h-36">
                  <img
                    src={photoUrl}
                    alt={`Hazard photo ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setSelectedPhotoModal(photoUrl)}
                      className="p-1.5 bg-white text-[#0A2342] rounded-full hover:bg-blue-50"
                      title="Inspect photo"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadPhoto(photoUrl, idx)}
                      className="p-1.5 bg-white text-[#0A2342] rounded-full hover:bg-blue-50"
                      title="Download photo"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resolution Notes if Resolved */}
          {issue.status === 'Resolved' && (
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resolution Summary
                </h4>
                <span className="text-[11px] font-semibold text-emerald-700">{issue.resolutionDate}</span>
              </div>
              <p className="text-xs leading-relaxed font-medium mt-1">{issue.resolutionNotes}</p>
              <p className="text-[10px] text-emerald-700 font-bold mt-2">Duration to Resolve: {issue.resolutionDuration}</p>
            </div>
          )}

          {/* Administrative Notes Editor */}
          <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] space-y-3">
            <h4 className="font-bold text-xs text-[#0A2342]">Administrative Notes</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(issue.adminNotes || []).length === 0 ? (
                <p className="text-slate-400 italic text-xs">No admin notes logged yet.</p>
              ) : (
                (issue.adminNotes || []).map((note) => (
                  <div key={note.id} className="p-2.5 bg-[#F7F9FD] rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#0755C9] text-[11px]">{note.author}</span>
                      <span className="text-[10px] text-slate-400">{note.timestamp}</span>
                    </div>
                    <p className="text-slate-700 leading-snug">{note.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddNote} className="flex gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Add administrative directive or note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#0755C9] hover:bg-[#0647A8] text-white font-bold rounded-lg transition-colors flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </div>

          {/* Task History Timeline */}
          <div className="bg-white p-4 rounded-xl border border-[#D9E1EF]">
            <h4 className="font-bold text-xs text-[#0A2342] mb-3">Task Lifecycle Audit History</h4>
            <div className="space-y-3 pl-2 border-l-2 border-slate-200">
              {(issue.taskHistory || []).map((event, idx) => (
                <div key={idx} className="relative pl-4">
                  <div className="absolute -left-[17px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#0755C9] ring-4 ring-white"></div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0A2342]">{event.status}</span>
                    <span className="text-[10px] text-slate-400">{event.timestamp}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{event.note}</p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">By {event.actor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Task Modal */}
      {showAssignModal && (
        <AssignTaskModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          issue={issue}
        />
      )}

      {/* Mark Resolved Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#D9E1EF] shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0A2342] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Mark Issue {issue.id} as Resolved
            </h3>
            <p className="text-xs text-[#52627A]">
              Describe repair actions taken (e.g. asphalt patch mix used, quality pass code, duration).
            </p>
            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <textarea
                required
                rows={3}
                value={resolutionInput}
                onChange={(e) => setResolutionInput(e.target.value)}
                placeholder="Enter resolution details & verification notes..."
                className="w-full px-3 py-2 text-xs bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg focus:outline-none focus:border-[#0755C9] resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Fullscreen Modal */}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setSelectedPhotoModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhotoModal}
              alt="Full view"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </>
  );
};
