import crypto from "node:crypto";
import type http from "node:http";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { JWT_SECRET } from "../config/env.js";
import { rooms, roomSockets, userSockets } from "../state/store.js";
import type { PeerSocket } from "../types/index.js";
import {
  addRoomLog,
  broadcastToRoom,
  getSafeFileList,
  sendNotificationToUser,
} from "../services/realtime.service.js";

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws: PeerSocket) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("message", (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.type === "auth" && payload.token)
          jwt.verify(payload.token, JWT_SECRET, (err: jwt.VerifyErrors | null, decoded: any) => {
            if (!err && decoded) {
              ws.userId = decoded.id;
              ws.peerName = decoded.username;
              if (!userSockets.has(decoded.id))
                userSockets.set(decoded.id, new Set());
              userSockets.get(decoded.id)!.add(ws);
            }
          });
        if (payload.type !== "join") return;
        const { roomId, peerId, peerName, userId, deviceId } = payload;
        if (!roomId || !rooms.has(roomId))
          return ws.send(
            JSON.stringify({
              type: "error",
              message: "Room not found or expired",
            }),
          );
        ws.roomId = roomId;
        ws.peerId = peerId || crypto.randomUUID();
        ws.peerName = peerName || "Guest Peer";
        ws.deviceId = deviceId;
        if (userId) {
          ws.userId = userId;
          if (!userSockets.has(userId)) userSockets.set(userId, new Set());
          userSockets.get(userId)!.add(ws);
        }
        if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
        roomSockets.get(roomId)!.add(ws);
        const room = rooms.get(roomId)!;
        const activePeers = roomSockets.get(roomId)!.size;
        const isOwner =
          (room.ownerId && userId && room.ownerId === userId) ||
          (room.ownerDeviceId && deviceId && room.ownerDeviceId === deviceId) ||
          (room.creatorPeerId && ws.peerId && room.creatorPeerId === ws.peerId);
        ws.send(
          JSON.stringify({
            type: "room:init",
            room: {
              id: room.id,
              createdAt: room.createdAt,
              expiresAt: room.expiresAt,
              hasPasscode: !!room.passcode,
              ownerId: room.ownerId,
              ownerUsername: room.ownerUsername,
              ownerDeviceId: room.ownerDeviceId,
              isOwner: !!isOwner,
              files: getSafeFileList(room),
              logs: room.logs,
              totalBytes: room.totalBytes,
              activePeers,
            },
          }),
        );
        addRoomLog(room, `${ws.peerName} joined the room.`, "info");
        broadcastToRoom(roomId, { type: "peer:update", activePeers });
        if (room.ownerId && ws.userId !== room.ownerId)
          sendNotificationToUser(room.ownerId, {
            notificationType: "peer_joined",
            roomId: room.id,
            peerName: ws.peerName,
            message: `${ws.peerName} joined your room ${room.id}`,
            timestamp: Date.now(),
          });
        broadcastToRoom(roomId, {
          type: "notification",
          notificationType: "peer_joined",
          roomId: room.id,
          peerName: ws.peerName,
          message: `${ws.peerName} connected to the room.`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("Error handling WebSocket message:", err);
      }
    });
    ws.on("close", () => {
      if (ws.userId && userSockets.has(ws.userId))
        userSockets.get(ws.userId)!.delete(ws);
      if (ws.roomId && roomSockets.has(ws.roomId)) {
        const sockets = roomSockets.get(ws.roomId)!;
        sockets.delete(ws);
        const room = rooms.get(ws.roomId);
        if (room) {
          addRoomLog(room, `${ws.peerName || "Peer"} disconnected.`, "warn");
          broadcastToRoom(ws.roomId, {
            type: "peer:update",
            activePeers: sockets.size,
          });
        }
      }
    });
  });
  const interval = setInterval(
    () =>
      wss.clients.forEach((ws: any) => {
        const peer = ws as PeerSocket;
        if (peer.isAlive === false) return peer.terminate();
        peer.isAlive = false;
        peer.ping();
      }),
    25000,
  );
  wss.on("close", () => clearInterval(interval));
}
