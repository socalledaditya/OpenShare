/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FormattedFileMeta {
  category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other';
  color: string;
  label: string;
}

/**
 * Format raw byte size into human readable string with tabular spacing.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${value} ${sizes[i]}`;
}

/**
 * Categorize files based on name extension or MIME type.
 */
export function getFileCategory(fileName: string, mimeType?: string): FormattedFileMeta {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'avif'].includes(ext)
  ) {
    return { category: 'image', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Image' };
  }

  if (
    mime.startsWith('video/') ||
    ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'].includes(ext)
  ) {
    return { category: 'video', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Video' };
  }

  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)
  ) {
    return { category: 'audio', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Audio' };
  }

  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('sheet') ||
    mime.includes('presentation') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'md'].includes(ext)
  ) {
    return { category: 'document', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Document' };
  }

  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'].includes(ext)
  ) {
    return { category: 'archive', color: 'text-amber-300 bg-amber-500/10 border-amber-500/20', label: 'Archive' };
  }

  if (
    ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'rs', 'go', 'cpp', 'c', 'java', 'html', 'css', 'sql', 'sh', 'yaml', 'yml'].includes(ext)
  ) {
    return { category: 'code', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', label: 'Code' };
  }

  return { category: 'other', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', label: 'File' };
}

/**
 * Sanitize user input for room codes (e.g. uppercase alphanumeric and hyphen).
 */
export function sanitizeRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
}

/**
 * Validate that a room code has acceptable length and format.
 */
export function validateRoomCode(code: string): boolean {
  const sanitized = sanitizeRoomCode(code);
  return sanitized.length >= 3 && sanitized.length <= 16 && /^[A-Z0-9-]+$/.test(sanitized);
}

/**
 * Generate a friendly readable room code (e.g., "BEAM-4829" or "DROP-7132").
 */
const CODE_PREFIXES = ['BEAM', 'DROP', 'VAULT', 'ORBIT', 'FLOW', 'RELAY', 'SYNC', 'SWIFT'];

export function generateRoomCode(): string {
  const prefix = CODE_PREFIXES[Math.floor(Math.random() * CODE_PREFIXES.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}
