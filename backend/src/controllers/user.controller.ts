import type { Response } from "express";
import { rooms, roomSockets } from "../state/store.js";
import type { AuthRequest } from "../types/index.js";
export function getUserRooms(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const userRooms = Array.from(rooms.values())
    .filter((room) => room.ownerId === userId)
    .map((room) => ({
      id: room.id,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      fileCount: room.files.size,
      totalBytes: room.totalBytes,
      hasPasscode: !!room.passcode,
      activePeers: roomSockets.get(room.id)?.size || 0,
    }));
  res.json({ rooms: userRooms });
}
export function getUserFiles(req: AuthRequest, res: Response) {
  const files: unknown[] = [];
  for (const room of rooms.values())
    for (const file of room.files.values())
      if (file.uploaderId === req.user!.id)
        files.push({
          id: file.id,
          name: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          uploadedAt: file.uploadedAt,
          roomId: room.id,
          downloadCount: file.downloadCount,
        });
  res.json({ files });
}
export function getDeviceRooms(req: any, res: Response) {
  const deviceId = req.headers["x-device-id"] || req.query.deviceId;
  if (!deviceId) return res.json({ rooms: [] });
  const deviceRooms = Array.from(rooms.values())
    .filter((room) => room.ownerDeviceId === deviceId && !room.ownerId)
    .map((room) => ({
      id: room.id,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      fileCount: room.files.size,
      totalBytes: room.totalBytes,
      hasPasscode: !!room.passcode,
      activePeers: roomSockets.get(room.id)?.size || 0,
    }));
  res.json({ rooms: deviceRooms });
}
