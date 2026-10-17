import React, { useState } from 'react';
import { KeyRound, LogOut, UserRound, Save } from 'lucide-react';
import { portalApi } from '../../lib/portalApi';

export function AccountSecurityPanel({ username: initialUsername, onMessage = () => {}, showSignOut = true }) {
  const [username, setUsername] = useState(initialUsername || JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null')?.username || '');
  const [newUsername, setNewUsername] = useState(username);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const changeUsername = async event => {
    event.preventDefault(); setBusy(true);
    try {
      const result = await portalApi('/me/username', { method: 'PUT', body: JSON.stringify({ username: newUsername }) });
      const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
      if (auth) sessionStorage.setItem('roadguard.auth', JSON.stringify({ ...auth, username: result.username }));
      setUsername(result.username); setNewUsername(result.username); onMessage('Username updated.');
      window.location.reload();
    } catch (error) { onMessage(error.message, 'error'); }
    finally { setBusy(false); }
  };

  const changePassword = async event => {
    event.preventDefault();
    if (newPassword !== confirmPassword) { onMessage('New passwords do not match.', 'error'); return; }
    setBusy(true);
    try {
      if (!otpSent || !otp) { onMessage('Send and enter the email verification code first.', 'error'); return; }
      await portalApi('/me/password', { method: 'PUT', body: JSON.stringify({ otp, newPassword }) });
      const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
      if (auth) sessionStorage.setItem('roadguard.auth', JSON.stringify({ ...auth, password: newPassword }));
      setOtp(''); setOtpSent(false); setNewPassword(''); setConfirmPassword(''); onMessage('Password updated.');
    } catch (error) { onMessage(error.message, 'error'); }
    finally { setBusy(false); }
  };

  const sendPasswordOtp = async () => {
    setBusy(true);
    try { await portalApi('/me/password/otp', { method: 'POST' }); setOtpSent(true); onMessage('Verification code sent to your account email.'); }
    catch (error) { onMessage(error.message, 'error'); }
    finally { setBusy(false); }
  };

  const signOut = () => { sessionStorage.removeItem('roadguard.auth'); window.location.replace('/admin/signin.html'); };

  return <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-6">
    <div><h2 className="font-bold text-lg flex items-center gap-2"><UserRound className="h-5 w-5 text-blue-700"/>Account access</h2><p className="text-sm text-slate-500 mt-1">Update the credentials you use to sign in.</p></div>
    <form onSubmit={changeUsername} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
      <label className="text-xs font-semibold text-slate-600">Current username<input value={username} readOnly className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-500"/></label>
      <label className="text-xs font-semibold text-slate-600">New username<input value={newUsername} onChange={e => setNewUsername(e.target.value)} minLength={3} maxLength={50} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
      <button disabled={busy || newUsername === username} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="inline h-4 w-4 mr-1"/>Update username</button>
    </form>
    <form onSubmit={changePassword} className="grid sm:grid-cols-3 gap-3 items-end border-t border-slate-100 pt-5">
      <label className="text-xs font-semibold text-slate-600">New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Email verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
      <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500 flex items-center gap-1"><KeyRound className="h-3.5 w-3.5"/>Use at least 8 characters.</p><div className="flex gap-2"><button type="button" onClick={sendPasswordOtp} disabled={busy} className="rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{otpSent ? 'Resend code' : 'Send verification code'}</button><button disabled={busy || !otpSent} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Update password</button></div></div>
    </form>
    {showSignOut && <div className="border-t border-slate-100 pt-4 flex justify-end"><button onClick={signOut} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"><LogOut className="inline h-4 w-4 mr-1"/>Sign out</button></div>}
  </section>;
}
