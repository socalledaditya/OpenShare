export interface ClientRoomFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  uploader: string;
  downloadCount: number;
  roomId?: string;
}

export interface ClientRoomLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warn' | 'danger';
}

export interface ClientRoomState {
  id: string;
  createdAt: number;
  expiresAt: number;
  hasPasscode: boolean;
  ownerId?: string;
  ownerUsername?: string;
  ownerDeviceId?: string;
  isOwner?: boolean;
  files: ClientRoomFile[];
  logs: ClientRoomLog[];
  totalBytes: number;
  activePeers: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  createdAt: number;
}

export interface UserCreatedRoom {
  id: string;
  createdAt: number;
  expiresAt: number;
  fileCount: number;
  totalBytes: number;
  hasPasscode: boolean;
  activePeers: number;
}
