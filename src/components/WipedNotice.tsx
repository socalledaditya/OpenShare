import React from 'react';
import { Check, Plus } from 'lucide-react';

interface WipedNoticeProps {
  roomCode: string;
  reason?: string;
  onCreateNew: () => void;
}

export const WipedNotice: React.FC<WipedNoticeProps> = ({
  roomCode,
  reason = 'The room has been closed.',
  onCreateNew,
}) => {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
        <Check className="w-6 h-6" />
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-1">
        Room closed and files deleted
      </h1>
      <p className="font-mono text-xs text-neutral-400 dark:text-neutral-500 mb-4">
        {roomCode}
      </p>

      <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-8 leading-relaxed">
        {reason} All files have been permanently removed from the server.
      </p>

      <button
        onClick={onCreateNew}
        className="inline-flex items-center gap-1.5 py-2.5 px-5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white font-medium text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Start New Transfer</span>
      </button>
    </div>
  );
};
