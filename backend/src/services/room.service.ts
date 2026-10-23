import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";
import { UPLOAD_ROOT } from "../config/env.js";
import { rooms, roomSockets } from "../state/store.js";
import type { Room } from "../types/index.js";
import { broadcastToRoom } from "./realtime.service.js";

export function checkRoomOwnership(room: Room, req: Request | any) {
  const reqUser = req.user;
  const deviceId =
    (req.headers && (req.headers["x-device-id"] as string)) ||
    (req.body && (req.body.deviceId as string)) ||
    (req.query && (req.query.deviceId as string));
  if (reqUser && room.ownerId && room.ownerId === reqUser.id) return true;
  if (room.ownerDeviceId && deviceId && room.ownerDeviceId === deviceId)
    return true;
  const peerId =
    (req.headers && (req.headers["x-peer-id"] as string)) ||
    (req.body && (req.body.peerId as string));
  return !!(peerId && room.creatorPeerId === peerId);
}
export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${["B", "KB", "MB", "GB"][i] || "MB"}`;
}
export async function permanentlyDeleteRoom(
  roomId: string,
  reason = "User requested room deletion",
) {
  const room = rooms.get(roomId);
  if (!room) return false;

  const uploadRoot = path.resolve(UPLOAD_ROOT);
  const roomDir = path.resolve(uploadRoot, roomId);
  // A room may only clean up its own direct child directory. Keep deletion
  // constrained to temp_uploads even if this function is called externally.
  if (path.dirname(roomDir) !== uploadRoot) {
    console.error(`[STORAGE PURGE] Invalid room storage path for ${roomId}`);
    return false;
  }

  try {
    if (fs.existsSync(roomDir))
      await fs.promises.rm(roomDir, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to wipe disk directory for room ${roomId}:`, err);
    // Keep the room active so a later delete/expiry pass can retry instead of
    // losing the only reference to files that still need removal.
    return false;
  }
  broadcastToRoom(roomId, {
    type: "room:deleted",
    roomId,
    reason,
    purgedAt: Date.now(),
  });
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    for (const ws of sockets)
      try {
        ws.close(1000, "Room permanently wiped");
      } catch {}
    roomSockets.delete(roomId);
  }
  rooms.delete(roomId);
  console.log(
    `[STORAGE PURGE] Room ${roomId} and all files were permanently removed.`,
  );
  return true;
}
