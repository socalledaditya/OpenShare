import mongoose from "mongoose";
import { MONGODB_URI } from "../config/env.js";

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Number, default: Date.now },
});
export const MongoUser: any =
  mongoose.models.User || mongoose.model("User", userSchema);
export let isMongoConnected = false;
export function connectDatabase() {
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 2500 })
    .then(() => {
      isMongoConnected = true;
      console.log("[MongoDB] Connected successfully to MongoDB");
    })
    .catch((err) =>
      console.warn(
        "[MongoDB] Running in-memory database fallback mode:",
        err.message,
      ),
    );
}
