import express from "express";
import cors from "cors";
import { optionalAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter, deviceRouter } from "./routes/user.routes.js";
import { roomRouter } from "./routes/room.routes.js";
export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: "*",
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-device-id",
        "x-peer-id",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json());
  app.use(optionalAuth);
  app.use("/api/auth", authRouter);
  app.use("/api/user", userRouter);
  app.use("/api/device", deviceRouter);
  app.use("/api/rooms", roomRouter);
  return app;
}
