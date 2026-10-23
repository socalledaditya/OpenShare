import fs from "node:fs";
import crypto from "node:crypto";
import type { Request, Response } from "express";
import * as archiverModule from "archiver";
import { rooms, roomSockets } from "../state/store.js";
import type { AuthRequest, Room, RoomFile } from "../types/index.js";
import {
  addRoomLog,
  broadcastToRoom,
  getSafeFileList,
} from "../services/realtime.service.js";
import {
  checkRoomOwnership,
  formatBytes,
  permanentlyDeleteRoom,
} from "../services/room.service.js";
import { UPLOAD_ROOT } from "../config/env.js";
import path from "node:path";

const createArchiver = (format: string, options: any) =>
  ((archiverModule as any).default || archiverModule)(format, options);
export function createRoom(req: AuthRequest, res: Response) {
  try {
    const deviceId =
      (req.headers["x-device-id"] as string) || req.body.deviceId;
    if (!req.user && deviceId)
      for (const existing of rooms.values())
        if (existing.ownerDeviceId === deviceId && !existing.ownerId)
          return res
            .status(400)
            .json({
              error: `You already have an active room (${existing.id}). Guest devices can only create one room at a time. Close your current room or sign in to create multiple rooms.`,
              existingRoomId: existing.id,
            });
    const {
      customCode,
      durationMinutes = 60,
      passcode,
      peerId = "host",
    } = req.body;
    let roomId =
      typeof customCode === "string"
        ? customCode
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, "")
            .slice(0, 16)
        : "";
    if (!roomId || roomId.length < 3) {
      const prefixes = [
        "OPEN",
        "SHARE",
        "VAULT",
        "DROP",
        "SWIFT",
        "RELAY",
        "SYNC",
      ];
      roomId = `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (rooms.has(roomId))
      return res
        .status(409)
        .json({
          error:
            "A room with this code is currently active. Choose a different code.",
        });
    const createdAt = Date.now(),
      expiresAt =
        createdAt +
        Math.max(5, Math.min(1440, Number(durationMinutes) || 60)) * 60 * 1000;
    fs.mkdirSync(path.join(UPLOAD_ROOT, roomId), { recursive: true });
    const room: Room = {
      id: roomId,
      createdAt,
      expiresAt,
      passcode:
        passcode && typeof passcode === "string" && passcode.trim().length > 0
          ? passcode.trim()
          : null,
      files: new Map(),
      logs: [
        {
          id: crypto.randomUUID(),
          timestamp: createdAt,
          message: "Transfer room created. Temporary storage ready.",
          type: "info",
        },
      ],
      totalBytes: 0,
      creatorPeerId: peerId,
      ownerId: req.user?.id,
      ownerUsername: req.user?.username,
      ownerDeviceId: deviceId || undefined,
    };
    rooms.set(roomId, room);
    res
      .status(201)
      .json({
        success: true,
        roomId,
        createdAt,
        expiresAt,
        hasPasscode: !!room.passcode,
        ownerId: room.ownerId,
        ownerUsername: room.ownerUsername,
        ownerDeviceId: room.ownerDeviceId,
        isOwner: true,
      });
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
}
export function getRoom(req: Request, res: Response) {
  const room = rooms.get(req.params.roomId);
  if (!room)
    return res
      .status(404)
      .json({ error: "Room not found or has been permanently deleted." });
  if (room.passcode && room.passcode !== ((req.query.passcode as string) || ""))
    return res
      .status(401)
      .json({
        error: "Passcode required or invalid.",
        requiresPasscode: true,
        roomId: room.id,
      });
  res.json({
    id: room.id,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    hasPasscode: !!room.passcode,
    ownerId: room.ownerId,
    ownerUsername: room.ownerUsername,
    ownerDeviceId: room.ownerDeviceId,
    isOwner: checkRoomOwnership(room, req),
    files: getSafeFileList(room),
    logs: room.logs,
    totalBytes: room.totalBytes,
    activePeers: roomSockets.get(room.id)?.size || 0,
  });
}
export function uploadFiles(req: AuthRequest, res: Response) {
  const room = rooms.get(req.params.roomId);
  if (!room)
    return res
      .status(404)
      .json({ error: "Room does not exist or was deleted." });
  if (!checkRoomOwnership(room, req))
    return res
      .status(403)
      .json({
        error:
          "Receivers are not allowed to upload files. Only the room creator can upload.",
      });
  const uploadedFiles = req.files as Express.Multer.File[];
  if (!uploadedFiles?.length)
    return res.status(400).json({ error: "No files uploaded." });
  const uploader = req.user?.username || req.body.uploader || "Peer";
  const newFiles: RoomFile[] = uploadedFiles.map((f) => ({
    id: crypto.randomUUID().slice(0, 8),
    originalName: f.originalname,
    sanitizedName: f.filename,
    size: f.size,
    mimeType: f.mimetype || "application/octet-stream",
    storagePath: f.path,
    uploadedAt: Date.now(),
    uploader,
    uploaderId: req.user?.id,
    downloadCount: 0,
  }));
  for (const f of newFiles) {
    room.files.set(f.id, f);
    room.totalBytes += f.size;
  }
  addRoomLog(
    room,
    newFiles.length === 1
      ? `${uploader} uploaded "${newFiles[0].originalName}" (${formatBytes(newFiles[0].size)})`
      : `${uploader} uploaded ${newFiles.length} files (${formatBytes(newFiles.reduce((a, f) => a + f.size, 0))})`,
    "success",
  );
  broadcastToRoom(room.id, {
    type: "files:updated",
    files: getSafeFileList(room),
    totalBytes: room.totalBytes,
  });
  const notification = {
    notificationType: "file_uploaded",
    roomId: room.id,
    uploaderName: uploader,
    fileCount: newFiles.length,
    firstFileName: newFiles[0].originalName,
    message:
      newFiles.length === 1
        ? `${uploader} uploaded "${newFiles[0].originalName}"`
        : `${uploader} uploaded ${newFiles.length} files (${newFiles[0].originalName}...)`,
    timestamp: Date.now(),
  };
  broadcastToRoom(room.id, { type: "notification", ...notification });
  res.json({
    success: true,
    files: getSafeFileList(room),
    totalBytes: room.totalBytes,
  });
}
