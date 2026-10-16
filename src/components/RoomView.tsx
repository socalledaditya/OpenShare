import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  Trash2,
  Copy,
  Check,
  QrCode,
  Archive,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  File as GenericFile,
  LogOut,
  FileType,
} from 'lucide-react';
import { ClientRoomState } from '../types';
import { formatBytes, getFileCategory } from '../utils/fileHelpers';

interface RoomViewProps {
  room: ClientRoomState;
  isOwner: boolean;
  currentPeerName: string;
  onUploadFiles: (files: File[]) => Promise<void>;
  onDownloadFile: (fileId: string, fileName: string) => void;
  onDownloadAllZip: () => void;
  onDeleteFile: (fileId: string) => Promise<void>;
  onRequestDeleteRoom: () => void;
  onLeaveRoom: () => void;
  onOpenQR: () => void;
  isUploading: boolean;
  uploadProgress: number;
}

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  isOwner,
  currentPeerName,
  onUploadFiles,
  onDownloadFile,
  onDownloadAllZip,
  onDeleteFile,
  onRequestDeleteRoom,
  onLeaveRoom,
  onOpenQR,
  isUploading,
  uploadProgress,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(room.id)}`;

  useEffect(() => {
    const updateCountdown = () => {
      const diff = room.expiresAt - Date.now();
      if (diff <= 0) {
        setTimeRemaining('Expiring');
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        setTimeRemaining(`${hours}h ${minutes % 60}m`);
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [room.expiresAt]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUploadFiles(Array.from(e.target.files));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const renderFileIcon = (fileName: string, mimeType?: string) => {
    const meta = getFileCategory(fileName, mimeType);
    switch (meta.category) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case 'archive':
        return <FileArchive className="w-4 h-4 text-amber-500 dark:text-amber-300" />;
      case 'document':
        return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <GenericFile className="w-4 h-4 text-neutral-500" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-5 sm:py-10 space-y-4 sm:space-y-6">
      {/* Room Overview Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] sm:text-xs font-medium text-neutral-400 dark:text-neutral-500">
                Share this room
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    room.activePeers > 1 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span>
                  {room.activePeers > 1 ? `${room.activePeers} connected` : 'Waiting for receiver'}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-mono font-bold text-neutral-900 dark:text-neutral-100 tracking-wider">
                {room.id}
              </h1>

              {/* Copy Code Button */}
              <button
                onClick={handleCopyCode}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer font-sans min-h-[32px]"
                title="Copy room code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>

              {/* QR Code Button moved right next to Copy Code */}
              <button
                onClick={onOpenQR}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer font-sans min-h-[32px]"
                title="Show QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Code</span>
              </button>
            </div>

            <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
              Auto-deletes in {timeRemaining} if not closed sooner.
            </p>
          </div>

          {/* Action buttons (grid on mobile, flex on desktop) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-100 dark:border-neutral-800">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-xs min-h-[38px]"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
            </button>

            {/* Leave Room Button for returning to lobby */}
            <button
              onClick={onLeaveRoom}
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-neutral-700 dark:text-neutral-200 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
              title="Leave room and return to lobby"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Room</span>
            </button>

            {/* Close & Delete Room Button (Creator only) */}
            {isOwner && (
              <button
                onClick={onRequestDeleteRoom}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
                title="Close room and permanently wipe all files"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Close & Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Drop/Tap Area (Creator only) */}
      {isOwner && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800'
              : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            accept="*/*"
          />

          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Click or drag files here to upload
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Supports Documents (PDF, DOCX, PPTX, XLSX), Videos, Audio, Images, Archives & Code up to 500MB per file.
              </p>
            </div>
          </div>

          {isUploading && (
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-900 dark:bg-white transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Files Section Header */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <span>Files in this Room ({room.files.length})</span>
          <span className="text-xs font-normal text-neutral-400">
            ({formatBytes(room.totalBytes)})
          </span>
        </h2>

        {room.files.length > 0 && (
          <button
            onClick={onDownloadAllZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Download All (ZIP)</span>
          </button>
        )}
      </div>

      {/* File List */}
      {room.files.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-12 text-center text-neutral-400 space-y-2">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            No files uploaded yet
          </p>
          <p className="text-xs">
            {isOwner
              ? 'Drag & drop or tap the box above to add files to this room.'
              : 'Waiting for sender to upload files to this room.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {room.files.map((file) => {
            const meta = getFileCategory(file.name, file.mimeType);
            return (
              <div
                key={file.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  <div className="p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0">
                    {renderFileIcon(file.name, file.mimeType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      <span>{formatBytes(file.size)}</span>
                      <span>·</span>
                      <span className="capitalize">{meta.label}</span>
                      <span>·</span>
                      <span>{file.downloadCount} {file.downloadCount === 1 ? 'download' : 'downloads'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => onDownloadFile(file.id, file.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[34px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  {isOwner && (
                    <button
                      onClick={() => onDeleteFile(file.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer min-h-[34px] flex items-center justify-center"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
