import React from 'react';

export const StatusBadge = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'Resolved':
      case 'Active':
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Assigned':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Unassigned':
      case 'Pending Approval':
      case 'Pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Deactivated':
      case 'Rejected':
      case 'Cancelled':
      case 'Overdue':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${getStyle()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
      {status}
    </span>
  );
};
