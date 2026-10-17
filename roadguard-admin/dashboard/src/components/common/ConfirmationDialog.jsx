import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmationDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", confirmStyle = "danger" }) => {
  if (!isOpen) return null;

  const btnStyles = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white",
    primary: "bg-[#0755C9] hover:bg-[#0647A8] text-white",
    warning: "bg-amber-600 hover:bg-amber-700 text-white"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl max-w-md w-full border border-[#D9E1EF] shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-amber-50 rounded-full text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0A2342]">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Demo System Confirmation</p>
          </div>
        </div>

        <p className="text-sm text-[#52627A] mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${btnStyles[confirmStyle] || btnStyles.primary}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
