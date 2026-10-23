import type { Request } from "express";
import type { WebSocket } from "ws";

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}
export interface RoomFile {
  id: string;
  originalName: string;
  sanitizedName: string;
  size: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: number;
  uploader: string;
  uploaderId?: string;
  downloadCount: number;
}
export interface RoomLog {
  id: string;
  timestamp: number;
  message: string;
  type: "info" | "success" | "warn" | "danger";
}
export interface Room {
  id: string;
  createdAt: number;
  expiresAt: number;
  passcode: string | null;
  files: Map<any, RoomFile>;
  logs: RoomLog[];
  totalBytes: number;
  creatorPeerId: string;
  ownerId?: string;
  ownerUsername?: string;
  ownerDeviceId?: string;
}
export interface AuthRequest extends Request {
  user?: Pick<User, "id" | "email" | "username">;
}
export interface PeerSocket extends WebSocket {
  roomId?: string;
  peerId?: string;
  peerName?: string;
  userId?: string;
  deviceId?: string;
  isAlive?: boolean;
}
