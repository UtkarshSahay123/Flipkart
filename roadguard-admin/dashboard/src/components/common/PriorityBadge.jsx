import React from 'react';

export const PriorityBadge = ({ priority }) => {
  const getStyle = () => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-300 font-semibold';
      case 'High':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs border ${getStyle()}`}
    >
      {priority === 'Critical' && (
        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
      )}
      {priority}
    </span>
  );
};
