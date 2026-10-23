import { Router } from "express";
import {
  getDeviceRooms,
  getUserFiles,
  getUserRooms,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.js";
export const userRouter = Router();
export const deviceRouter = Router();
userRouter.get("/rooms", requireAuth, getUserRooms);
userRouter.get("/files", requireAuth, getUserFiles);
deviceRouter.get("/rooms", getDeviceRooms);
