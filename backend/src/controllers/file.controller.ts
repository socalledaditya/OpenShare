import fs from "node:fs";
import type { Request, Response } from "express";
import * as archiverModule from "archiver";
import { rooms } from "../state/store.js";
import {
  addRoomLog,
  broadcastToRoom,
  getSafeFileList,
} from "../services/realtime.service.js";
import {
  checkRoomOwnership,
  permanentlyDeleteRoom,
} from "../services/room.service.js";

const createArchiver = (format: string, options: any) =>
  ((archiverModule as any).default || archiverModule)(format, options);
export function downloadFile(req: Request, res: Response) {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room has been deleted." });
  const file = room.files.get(req.params.fileId);
  if (!file || !fs.existsSync(file.storagePath))
    return res.status(404).json({ error: "File not found or was removed." });
  file.downloadCount += 1;
  addRoomLog(room, `File "${file.originalName}" was downloaded.`, "info");
  broadcastToRoom(room.id, {
    type: "files:updated",
    files: getSafeFileList(room),
    totalBytes: room.totalBytes,
  });
  res.download(file.storagePath, file.originalName, (err) => {
    if (err && !res.headersSent) console.error("Error during download:", err);
  });
}
export function downloadAll(req: Request, res: Response) {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room has been deleted." });
  if (room.files.size === 0)
    return res.status(400).json({ error: "Room contains no files." });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${room.id}-files.zip"`,
  );
  const archive = createArchiver("zip", { zlib: { level: 0 } });
  archive.on("error", (err: Error) => {
    console.error("ZIP archive error:", err);
    if (!res.headersSent)
      res.status(500).json({ error: "Failed to create zip archive" });
  });
  archive.pipe(res);
  for (const file of room.files.values())
    if (fs.existsSync(file.storagePath)) {
      archive.file(file.storagePath, { name: file.originalName });
      file.downloadCount += 1;
    }
  addRoomLog(
    room,
    `Batch ZIP bundle (${room.files.size} files) was downloaded.`,
    "info",
  );
  broadcastToRoom(room.id, {
    type: "files:updated",
    files: getSafeFileList(room),
    totalBytes: room.totalBytes,
  });
  archive.finalize();
}
export async function deleteFile(req: Request, res: Response) {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  if (!checkRoomOwnership(room, req))
    return res
      .status(403)
      .json({
        error:
          "Permission denied. Receivers cannot delete files. Only the room creator can delete files.",
      });
  const file = room.files.get(req.params.fileId);
  if (!file) return res.status(404).json({ error: "File not found." });
  try {
    if (fs.existsSync(file.storagePath))
      await fs.promises.unlink(file.storagePath);
  } catch (err) {
    console.error("Failed to unlink file:", err);
  }
  room.totalBytes -= file.size;
  room.files.delete(file.id);
  addRoomLog(
    room,
    `File "${file.originalName}" was permanently removed.`,
    "warn",
  );
  broadcastToRoom(room.id, {
    type: "files:updated",
    files: getSafeFileList(room),
    totalBytes: room.totalBytes,
  });
  res.json({ success: true, message: "File permanently erased." });
}
export async function deleteRoom(req: Request, res: Response) {
  const room = rooms.get(req.params.roomId);
  if (!room)
    return res
      .status(404)
      .json({ error: "Room does not exist or was already deleted." });
  if (!checkRoomOwnership(room, req))
    return res
      .status(403)
      .json({
        error:
          "Permission denied. Receivers cannot delete this room. Only the room creator can delete it.",
      });
  if (!(await permanentlyDeleteRoom(room.id, "Room closed by creator")))
    return res
      .status(404)
      .json({ error: "Room does not exist or was already deleted." });
  res.json({
    success: true,
    message:
      "Room and all files permanently removed from disk and server memory.",
  });
}
