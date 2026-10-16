import React from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';

interface DeleteModalProps {
  roomCode: string;
  fileCount: number;
  totalSizeFormatted: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  roomCode,
  fileCount,
  totalSizeFormatted,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          disabled={isDeleting}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="delete-modal-title" className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Close room and delete files?
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
          Room <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{roomCode}</span> and all {fileCount} uploaded {fileCount === 1 ? 'file' : 'files'} ({totalSizeFormatted}) will be permanently wiped from the server immediately.
        </p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Everything'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
