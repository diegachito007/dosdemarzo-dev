import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const typeStyles = {
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className={`${typeStyles[type]} p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3 text-white">
            <FaExclamationTriangle className="text-2xl" />
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:bg-white/20 p-1 rounded transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-slate-700 text-sm leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition text-sm font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg transition text-sm font-medium ${
              type === 'danger' 
                ? 'bg-red-600 hover:bg-red-700' 
                : type === 'info'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}