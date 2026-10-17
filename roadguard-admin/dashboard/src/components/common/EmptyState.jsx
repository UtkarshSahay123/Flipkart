import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const EmptyState = ({ title = "No items found", description = "Try refining your search or filter parameters.", icon: Icon = ShieldAlert, actionButton }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-[#D9E1EF] text-center my-4">
      <div className="p-4 bg-slate-100 rounded-full text-[#52627A] mb-4">
        <Icon className="w-8 h-8 text-[#0755C9]" />
      </div>
      <h4 className="text-lg font-bold text-[#0A2342] mb-1">{title}</h4>
      <p className="text-xs text-[#52627A] max-w-md leading-relaxed mb-4">{description}</p>
      {actionButton}
    </div>
  );
};
