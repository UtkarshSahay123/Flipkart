import React from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

export const Toast = () => {
  const { toast } = useRoadGuard();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    info: <Info className="w-5 h-5 text-blue-600" />,
    error: <XCircle className="w-5 h-5 text-rose-600" />
  };

  const borders = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
    info: 'border-blue-300 bg-blue-50 text-blue-900',
    error: 'border-rose-300 bg-rose-50 text-rose-900'
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-sm">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${borders[toast.type] || borders.info}`}>
        {icons[toast.type] || icons.info}
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
    </div>
  );
};
