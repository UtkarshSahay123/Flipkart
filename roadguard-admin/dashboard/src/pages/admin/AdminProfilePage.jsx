import React, { useEffect, useState } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { AccountSecurityPanel } from '../../components/common/AccountSecurityPanel';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import { portalApi } from '../../lib/portalApi';
import { Activity, ClipboardList, RefreshCw, UserRound } from 'lucide-react';

export const AdminProfilePage = () => {
  const { organizationProfile, updateProfileImage, tasks, showToast } = useRoadGuard();
  const [history, setHistory] = useState([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [authorityTitle, setAuthorityTitle] = useState('');
  const [titleBusy, setTitleBusy] = useState(false);
  useEffect(() => setProfileImage(organizationProfile?.profileImage || null), [organizationProfile?.profileImage]);
  useEffect(() => setAuthorityTitle(organizationProfile?.authorityTitle || organizationProfile?.designation || ''), [organizationProfile?.authorityTitle, organizationProfile?.designation]);

  const refreshHistory = async () => {
    try { setHistory(await portalApi('/tasks/history')); }
    catch (error) { showToast(error.message, 'error'); }
  };
  useEffect(() => { refreshHistory(); }, []);

  const changePhoto = event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      showToast('Choose a PNG, JPEG, or WebP image up to 10 MB.', 'error'); event.target.value = ''; return;
    }
    setImageBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try { setProfileImage(await updateProfileImage(reader.result)); showToast('Profile photo saved.', 'success'); }
      catch (error) { showToast(error.message, 'error'); }
      finally { setImageBusy(false); }
    };
    reader.onerror = () => { setImageBusy(false); showToast('Could not read that image.', 'error'); };
    reader.readAsDataURL(file);
  };

  const removePhoto = async () => {
    setImageBusy(true);
    try { await updateProfileImage(null); setProfileImage(null); showToast('Profile photo removed.', 'success'); }
    catch (error) { showToast(error.message, 'error'); }
    finally { setImageBusy(false); }
  };

  const saveAuthorityTitle = async event => {
    event.preventDefault(); setTitleBusy(true);
    try { await portalApi('/profile/designation', { method: 'PUT', body: JSON.stringify({ designation: authorityTitle }) }); showToast('Authority designation updated and recorded in audit logs.', 'success'); }
    catch (error) { showToast(error.message, 'error'); }
    finally { setTitleBusy(false); }
  };

  return <div className="space-y-6 max-w-5xl mx-auto">
    <section className="bg-white p-6 rounded-2xl border border-[#D9E1EF] shadow-sm flex flex-wrap items-center gap-5">
      <ProfileAvatar src={profileImage} className="h-20 w-20 border-2 border-blue-100" iconClassName="h-9 w-9" />
      <div className="flex-1 min-w-48"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Administrator profile</p><h1 className="text-2xl font-extrabold text-[#0A2342] mt-1">{organizationProfile?.name || 'Administrator'}</h1><p className="text-sm text-slate-500">{organizationProfile?.authorityType ? `${organizationProfile.authorityType} · ` : ''}{organizationProfile?.authorityTitle || organizationProfile?.designation || 'Administrator'} · {organizationProfile?.email}</p><p className="text-xs text-slate-500">{organizationProfile?.organizationName || 'Organization admin'}</p></div>
      <div className="flex gap-3 items-center"><label className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{imageBusy ? 'Saving…' : 'Upload/change photo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={changePhoto} disabled={imageBusy}/></label>{profileImage && <button disabled={imageBusy} onClick={removePhoto} className="text-sm text-slate-500 hover:text-rose-700">Remove</button>}</div>
    </section>

    <form onSubmit={saveAuthorityTitle} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="min-w-64 flex-1 text-sm font-semibold">Authority designation<input value={authorityTitle} onChange={event => setAuthorityTitle(event.target.value)} maxLength={100} required placeholder="e.g. District Collector" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"/><span className="mt-1 block text-xs font-normal text-slate-500">Display title only. It does not affect account permissions.</span></label><button disabled={titleBusy} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{titleBusy ? 'Saving…' : 'Save designation'}</button></form>

    <AccountSecurityPanel username={organizationProfile?.username} showSignOut={false} onMessage={(message, type) => showToast(message, type || 'success')} />

    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-3 items-center"><ClipboardList className="h-5 w-5 text-blue-700"/><div><h2 className="font-bold text-lg">Organization tasks</h2><p className="text-sm text-slate-500">Assignments created by your organization and their current status.</p></div></div><button onClick={refreshHistory} className="text-sm font-semibold text-blue-700 flex items-center gap-2"><RefreshCw className="h-4 w-4"/>Refresh activity</button></div>
      {tasks.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No tasks have been assigned yet.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Task</th><th className="px-5 py-3">Assigned employee</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Due</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.slice(0, 12).map(task => <tr key={task.id}><td className="px-5 py-3 font-semibold">{task.title}{task.issueId && <p className="text-xs text-blue-700">Issue {task.issueId}</p>}</td><td className="px-5 py-3">{task.employeeName}</td><td className="px-5 py-3">{task.priority}</td><td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{task.status}</span></td><td className="px-5 py-3 text-slate-500">{task.dueDate || '—'}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6"><div className="flex gap-3 items-center"><Activity className="h-5 w-5 text-blue-700"/><div><h2 className="font-bold text-lg">Task activity history</h2><p className="text-sm text-slate-500">Status updates across your organization.</p></div></div>
      {history.length === 0 ? <p className="mt-5 text-sm text-slate-500">No task history recorded yet.</p> : <ol className="mt-5 space-y-3">{history.slice(0, 25).map(event => <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 pb-3 text-sm"><UserRound className="h-4 w-4 text-slate-400"/><span className="font-semibold">{event.taskTitle}</span><span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">{event.status}</span><span className="text-slate-500">{event.employeeName} · updated by {event.actor}</span><time className="ml-auto text-xs text-slate-400">{new Date(event.changedAt).toLocaleString()}</time></li>)}</ol>}
    </section>
  </div>;
};
