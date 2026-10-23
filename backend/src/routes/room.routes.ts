import { Router } from "express";
import {
  createRoom,
  getRoom,
  uploadFiles,
} from "../controllers/room.controller.js";
import {
  deleteFile,
  deleteRoom,
  downloadAll,
  downloadFile,
} from "../controllers/file.controller.js";
import { upload } from "../middleware/upload.js";
export const roomRouter = Router();
roomRouter.post("/", createRoom);
roomRouter.get("/:roomId", getRoom);
roomRouter.post("/:roomId/upload", upload.array("files", 20), uploadFiles);
roomRouter.get("/:roomId/files/:fileId/download", downloadFile);
roomRouter.get("/:roomId/download-all", downloadAll);
roomRouter.delete("/:roomId/files/:fileId", deleteFile);
roomRouter.delete("/:roomId", deleteRoom);
