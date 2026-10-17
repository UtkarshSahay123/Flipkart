import React, { useState } from 'react';
import { UserRound, X } from 'lucide-react';

export function ProfileAvatar({ src, className = 'h-10 w-10', iconClassName = 'h-5 w-5' }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return <>
    {src
      ? <button type="button" onClick={() => setPreviewOpen(true)} aria-label="View profile photo" title="View profile photo" className={`${className} rounded-full overflow-hidden p-0 cursor-zoom-in`}><img src={src} alt="Profile photo" className="w-full h-full object-cover bg-slate-100" /></button>
      : <span className={`${className} rounded-full bg-slate-100 text-slate-500 grid place-items-center`} aria-label="Default profile icon"><UserRound className={iconClassName} /></span>}
    {previewOpen && <div role="dialog" aria-modal="true" aria-label="Profile photo preview" onClick={() => setPreviewOpen(false)} className="fixed inset-0 z-[100] bg-slate-950/75 p-5 grid place-items-center cursor-zoom-out">
      <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close photo preview" className="absolute top-5 right-5 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-6 w-6" /></button>
      <img src={src} alt="Your profile photo" onClick={event => event.stopPropagation()} className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl cursor-default" />
    </div>}
  </>;
}
