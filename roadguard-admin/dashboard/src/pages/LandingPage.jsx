import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, MapPin, AlertTriangle, Users, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';

export const LandingPage = () => {
  const navigate = useNavigate();
  const adminSignInUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8001/admin/signin.html'
    : '/admin/signin.html';

  return (
    <div className="min-h-screen bg-[#F7F9FD] text-[#0A2342] flex flex-col font-sans">
      {/* Header */}
      <header className="h-20 bg-white border-b border-[#D9E1EF] px-6 lg:px-12 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <img src="/shield-logo.svg" alt="Road Guard Shield Logo" className="w-10 h-10" />
          <div>
            <span className="font-extrabold text-xl tracking-tight text-[#0A2342] block">
              Road Guard
            </span>
            <span className="text-[10px] font-bold text-[#52627A] uppercase tracking-wider block">
              Municipal Traffic & Hazard Management
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => { window.location.href = adminSignInUrl; }}
            className="px-5 py-2.5 bg-[#0755C9] hover:bg-[#0647A8] text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            Launch Admin Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#0755C9] text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              Amaravati Municipal Corporation Command Portal
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-[#0A2342] leading-tight tracking-tight">
              Intelligent Road Hazard & Traffic Management
            </h1>

            <p className="text-sm lg:text-base text-[#52627A] leading-relaxed">
              Detect potholes, waterlogging, broken signals, and traffic bottlenecks in real-time. Coordinate field engineering staff and track municipal issue resolution velocity.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => { window.location.href = adminSignInUrl; }}
                className="px-6 py-3.5 bg-[#0755C9] hover:bg-[#0647A8] text-white font-extrabold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm"
              >
                Access Admin Portal
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/admin/map')}
                className="px-6 py-3.5 bg-white border border-[#D9E1EF] hover:bg-slate-50 text-[#0A2342] font-bold rounded-xl shadow-xs transition-colors text-sm flex items-center gap-2"
              >
                <MapPin className="w-4 h-4 text-[#0755C9]" />
                Live Command Map
              </button>
            </div>
          </div>

          {/* Graphic Dashboard Preview Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#D9E1EF] shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-[#0A2342] ml-2">Traffic Command Center</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                System Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 bg-blue-50 rounded-xl">
                <span className="text-xl font-extrabold text-[#0755C9] block">14</span>
                <span className="text-[10px] text-[#52627A] font-semibold">Active Hazards</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <span className="text-xl font-extrabold text-amber-600 block">6</span>
                <span className="text-[10px] text-amber-800 font-semibold">Field Staff</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <span className="text-xl font-extrabold text-emerald-600 block">4.2h</span>
                <span className="text-[10px] text-emerald-800 font-semibold">Avg Resolution</span>
              </div>
            </div>

            <div className="p-4 bg-[#F7F9FD] rounded-xl border border-[#D9E1EF] space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-[#0755C9]">RG-2026-8941</span>
                <span className="text-red-600">Critical Priority</span>
              </div>
              <p className="text-slate-700">Pothole reported near VIT-AP Gate 2 (18 duplicate reports)</p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Assigned: Rajesh Sharma</span>
                <span className="text-emerald-600 font-semibold">In Progress</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-[#D9E1EF] bg-white text-center text-xs text-[#52627A]">
        <p>© 2026 Road Guard — Amaravati Municipal Traffic & Road-Hazard Command Platform. Frontend Demonstration.</p>
      </footer>
    </div>
  );
};
