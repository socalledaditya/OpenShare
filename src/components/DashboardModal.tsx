import React, { useState, useEffect } from 'react';
import { X, FolderLock, Trash2, ExternalLink, Clock, FileText, Download, RefreshCw } from 'lucide-react';
import { UserProfile, UserCreatedRoom } from '../types';
import { formatBytes } from '../utils/fileHelpers';
import { API_BASE_URL } from '../utils/config';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  token: string;
  onSelectRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => Promise<void>;
  onDeleteFile: (roomId: string, fileId: string) => Promise<void>;
  onDownloadFile: (roomId: string, fileId: string, fileName: string) => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
  onSelectRoom,
  onDeleteRoom,
}) => {
  const [rooms, setRooms] = useState<UserCreatedRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRooms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (err: any) {
      setError(err.message || 'Could not load your rooms');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUserRooms();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden text-left flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
              <FolderLock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                My Managed Rooms
              </h2>
              <p className="text-[11px] text-neutral-400">
                Signed in as <strong>{user.username}</strong> ({user.email})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUserRooms}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors cursor-pointer"
              title="Refresh rooms"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading your rooms...</div>
          ) : rooms.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 space-y-2">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No active rooms found</p>
              <p className="text-xs">Create a room from the home lobby to start sharing files.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => {
                const minsLeft = Math.max(0, Math.round((room.expiresAt - Date.now()) / 60000));
                return (
                  <div
                    key={room.id}
                    className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-base text-neutral-900 dark:text-neutral-100">
                          {room.id}
                        </span>
                        {room.hasPasscode && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-medium">
                            Protected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {room.fileCount} {room.fileCount === 1 ? 'file' : 'files'} ({formatBytes(room.totalBytes)})
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {minsLeft}m left
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-200/60 dark:border-neutral-700/60">
                      <button
                        onClick={() => {
                          onSelectRoom(room.id);
                        }}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[36px]"
                      >
                        Open Room
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to permanently close room ${room.id}?`)) {
                            await onDeleteRoom(room.id);
                            fetchUserRooms();
                          }
                        }}
                        className="px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[36px]"
                        title="Delete room"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
