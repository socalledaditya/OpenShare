import React, { useState } from 'react';
import {
  Upload,
  Download,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Lock,
  FolderLock,
  Trash2,
  Clock,
  FileText,
} from 'lucide-react';
import { generateRoomCode, sanitizeRoomCode, validateRoomCode, formatBytes } from '../utils/fileHelpers';
import { UserCreatedRoom } from '../types';

interface LobbyViewProps {
  onCreateRoom: (customCode: string, durationMinutes: number, passcode?: string) => Promise<void>;
  onJoinRoom: (roomCode: string, passcode?: string) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
  activeGuestRoom?: UserCreatedRoom | null;
  userRooms?: UserCreatedRoom[];
  onOpenGuestRoom?: (roomId: string) => void;
  onDeleteGuestRoom?: (roomId: string) => Promise<void>;
  onDeleteUserRoom?: (roomId: string) => Promise<void>;
  isLoggedIn?: boolean;
  onOpenAuth?: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  isLoading,
  errorMessage,
  activeGuestRoom,
  userRooms = [],
  onOpenGuestRoom,
  onDeleteGuestRoom,
  onDeleteUserRoom,
  isLoggedIn = false,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');

  // Send state
  const [createCode, setCreateCode] = useState<string>(generateRoomCode());
  const [createDuration, setCreateDuration] = useState<number>(60);
  const [createPasscode, setCreatePasscode] = useState<string>('');
  const [showOptions, setShowOptions] = useState<boolean>(false);

  // Receive state
  const [joinCode, setJoinCode] = useState<string>('');
  const [joinPasscode, setJoinPasscode] = useState<string>('');

  const handleRefreshCode = () => {
    setCreateCode(generateRoomCode());
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRoomCode(createCode)) return;
    await onCreateRoom(
      sanitizeRoomCode(createCode),
      createDuration,
      createPasscode.trim() ? createPasscode.trim() : undefined
    );
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let target = joinCode.trim();
    if (target.includes('?room=')) {
      const parsed = new URL(target, window.location.origin);
      target = parsed.searchParams.get('room') || target;
    }
    const clean = sanitizeRoomCode(target);
    if (!clean) return;
    await onJoinRoom(clean, joinPasscode.trim() || undefined);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 sm:py-14 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
          Fast, temporary file transfer
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm sm:max-w-md mx-auto leading-relaxed">
          Share files directly with anyone. Everything is automatically and permanently deleted from the server when you close the room.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs text-center">
          {errorMessage}
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-8 shadow-xs">
        {/* Segmented Switcher */}
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('send')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] ${
              activeTab === 'send'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Send Files</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] ${
              activeTab === 'receive'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Receive Files</span>
          </button>
        </div>

        {/* Send tab */}
        {activeTab === 'send' && (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="send-room-code" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Room Code
                </label>
                <button
                  type="button"
                  onClick={handleRefreshCode}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer py-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Randomize</span>
                </button>
              </div>
              <input
                id="send-room-code"
                type="text"
                value={createCode}
                onChange={(e) => setCreateCode(sanitizeRoomCode(e.target.value))}
                maxLength={16}
                required
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 focus:border-neutral-900 dark:focus:border-neutral-400 rounded-xl px-4 py-3 font-mono text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-wider uppercase focus:outline-none transition-colors"
              />
            </div>

            {/* Eye-catching Catchy Room Options Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-neutral-800/90 dark:to-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <div className="p-1 rounded-lg bg-neutral-200/80 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 group-hover:scale-105 transition-transform">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </div>
                  <span>Room Options (Password & Expiry)</span>
                  {(createPasscode.trim() || createDuration !== 60) && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Configured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">
                  <span className="text-[11px] font-medium hidden sm:inline">{showOptions ? 'Hide' : 'Configure'}</span>
                  {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </button>

              {showOptions && (
                <div className="mt-2.5 p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3.5 animate-fadeIn">
                  <div>
                    <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1.5">
                      Auto-delete duration
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '15 min', value: 15 },
                        { label: '1 hour', value: 60 },
                        { label: '6 hours', value: 360 },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCreateDuration(opt.value)}
                          className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer min-h-[38px] ${
                            createDuration === opt.value
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent font-semibold shadow-2xs'
                              : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                      Optional Room Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type="password"
                        placeholder="Leave empty for open access"
                        value={createPasscode}
                        onChange={(e) => setCreatePasscode(e.target.value)}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-base sm:text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!isLoggedIn && activeGuestRoom && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-1.5">
                <p>
                  Guest devices can create <strong>1 active room</strong> at a time. Reopen room <strong>{activeGuestRoom.id}</strong> or close it first.
                </p>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-100 hover:underline cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create a free account to manage multiple rooms simultaneously</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !validateRoomCode(createCode) || (!isLoggedIn && !!activeGuestRoom)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white font-medium text-sm rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer min-h-[46px] mt-4"
            >
              <span>
                {isLoading
                  ? 'Creating Room...'
                  : !isLoggedIn && activeGuestRoom
                  ? `Active Room ${activeGuestRoom.id} In Progress`
                  : 'Create Room & Start Sharing'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Receive tab */}
        {activeTab === 'receive' && (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label htmlFor="join-code-input" className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Room Code or Link
              </label>
              <input
                id="join-code-input"
                type="text"
                placeholder="e.g. OPEN-4829"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 focus:border-neutral-900 dark:focus:border-neutral-400 rounded-xl px-4 py-3 font-mono text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider placeholder-neutral-400 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="join-passcode-input" className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                Password <span className="text-neutral-400 font-normal">(if required by sender)</span>
              </label>
              <input
                id="join-passcode-input"
                type="password"
                placeholder="Leave blank if none"
                value={joinPasscode}
                onChange={(e) => setJoinPasscode(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-base sm:text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !joinCode.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white font-medium text-sm rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer min-h-[46px] mt-4"
            >
              <span>{isLoading ? 'Connecting...' : 'Join Room'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* OPEN ROOMS SECTION AT THE BOTTOM OF LOBBY */}
      {isLoggedIn && userRooms.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                <FolderLock className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Your Open Rooms ({userRooms.length})
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {userRooms.map((room) => {
              const minsLeft = Math.max(0, Math.round((room.expiresAt - Date.now()) / 60000));
              return (
                <div
                  key={room.id}
                  className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
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
                    {onOpenGuestRoom && (
                      <button
                        type="button"
                        onClick={() => onOpenGuestRoom(room.id)}
                        className="flex-1 sm:flex-none px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[36px]"
                      >
                        Open Room
                      </button>
                    )}
                    {onDeleteUserRoom && (
                      <button
                        type="button"
                        onClick={() => onDeleteUserRoom(room.id)}
                        className="px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[36px]"
                        title="Close and delete room"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Guest Room for this Device */}
      {!isLoggedIn && activeGuestRoom && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Active Room on this device:
                </span>
                <span className="font-mono font-bold text-sm text-neutral-900 dark:text-neutral-100">
                  {activeGuestRoom.id}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                <span>{activeGuestRoom.fileCount} {activeGuestRoom.fileCount === 1 ? 'file' : 'files'}</span>
                <span>·</span>
                <span>{formatBytes(activeGuestRoom.totalBytes)}</span>
                <span>·</span>
                <span>{Math.max(0, Math.round((activeGuestRoom.expiresAt - Date.now()) / 60000))}m left</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenGuestRoom && (
                <button
                  type="button"
                  onClick={() => onOpenGuestRoom(activeGuestRoom.id)}
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white rounded-xl transition-colors cursor-pointer min-h-[38px]"
                >
                  Open Room
                </button>
              )}
              {onDeleteGuestRoom && (
                <button
                  type="button"
                  onClick={() => onDeleteGuestRoom(activeGuestRoom.id)}
                  className="px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer min-h-[38px]"
                >
                  Close & Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer reassurance */}
      <div className="text-center text-xs text-neutral-400 dark:text-neutral-500 space-y-1">
        <p>No account required to send or receive files.</p>
        <p>All files are permanently deleted when the room is closed.</p>
      </div>
    </div>
  );
};
