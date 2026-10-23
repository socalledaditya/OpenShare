import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { UPLOAD_ROOT } from "../config/env.js";

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const roomDir = path.join(UPLOAD_ROOT, req.params.roomId as string);
      if (!fs.existsSync(roomDir)) fs.mkdirSync(roomDir, { recursive: true });
      cb(null, roomDir);
    },
    filename: (_req, file, cb) =>
      cb(
        null,
        `${crypto.randomUUID().slice(0, 8)}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      ),
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 20 },
});
