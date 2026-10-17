import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const MetricCard = ({ title, value, subtext, icon: Icon, color = 'blue', onClick, trend, badgeText }) => {
  const colorStyles = {
    blue: 'bg-blue-50 text-[#0755C9]',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-[#D9E1EF] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-[#0755C9] relative overflow-hidden`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">{title}</p>
          <h3 className="text-2xl lg:text-3xl font-bold text-[#0A2342] mt-2 group-hover:text-[#0755C9] transition-colors">
            {value}
          </h3>
        </div>
        <div className={`p-3 rounded-lg ${colorStyles[color] || colorStyles.blue}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-xs text-[#52627A] flex items-center gap-1 font-medium">
          {subtext}
        </span>
        {badgeText && (
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-[#52627A] font-medium">
            {badgeText}
          </span>
        )}
        {trend && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}% vs last wk
          </span>
        )}
      </div>

      <div className="absolute top-0 right-0 bottom-0 left-0 border-2 border-transparent group-hover:border-[#0755C9]/10 rounded-xl pointer-events-none transition-colors"></div>
    </div>
  );
};
