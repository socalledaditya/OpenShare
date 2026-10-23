import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

// Prefer the shared project-root file, then fill in any missing server-only
// settings from backend/.env. This makes `npm run dev:backend` work whether
// the MongoDB URI is kept in the root .env (the documented location) or in
// backend/.env (a common local setup).
dotenv.config({ path: path.resolve(backendRoot, "../.env") });
dotenv.config({ path: path.resolve(backendRoot, ".env") });

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const UPLOAD_ROOT = path.join(backendRoot, "temp_uploads");
export const JWT_SECRET =
  process.env.JWT_SECRET || "beamdrop-secure-ephemeral-jwt-2026";
export const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  "mongodb://127.0.0.1:27017/openshare";
