import { WebSocket } from "ws";
import { roomSockets, userSockets } from "../state/store.js";
import type { Room, RoomLog } from "../types/index.js";
import crypto from "node:crypto";

export function broadcastToRoom(roomId: string, data: unknown) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  const message = JSON.stringify(data);
  for (const client of sockets)
    if (client.readyState === WebSocket.OPEN)
      try {
        client.send(message);
      } catch (err) {
        console.error("Error sending WS message:", err);
      }
}
export function sendNotificationToUser(userId: string, notification: unknown) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const message = JSON.stringify({
    type: "notification",
    ...(notification as object),
  });
  for (const client of sockets)
    if (client.readyState === WebSocket.OPEN)
      try {
        client.send(message);
      } catch (err) {
        console.error("Error sending notification to user:", err);
      }
}
export function getSafeFileList(room: Room) {
  return Array.from(room.files.values()).map((f) => ({
    id: f.id,
    name: f.originalName,
    size: f.size,
    mimeType: f.mimeType,
    uploadedAt: f.uploadedAt,
    uploader: f.uploader,
    uploaderId: f.uploaderId,
    downloadCount: f.downloadCount,
    roomId: room.id,
  }));
}
export function addRoomLog(
  room: Room,
  message: string,
  type: RoomLog["type"] = "info",
) {
  const log = { id: crypto.randomUUID(), timestamp: Date.now(), message, type };
  room.logs.push(log);
  if (room.logs.length > 50) room.logs.shift();
  broadcastToRoom(room.id, { type: "room:log", log });
}
