import fs from "node:fs";
import http from "node:http";
import bcrypt from "bcryptjs";
import { createApp } from "./app.js";
import { PORT, UPLOAD_ROOT } from "./config/env.js";
import { connectDatabase } from "./models/user.model.js";
import { rooms, users, usersByEmail } from "./state/store.js";
import { permanentlyDeleteRoom } from "./services/room.service.js";
import { setupWebSocket } from "./websocket/setup.js";

async function seedDemoUser() {
  const passwordHash = await bcrypt.hash(
    "Password123",
    await bcrypt.genSalt(10),
  );
  const user = {
    id: "user_demo_1",
    email: "demo@openshare.io",
    username: "DemoPilot",
    passwordHash,
    createdAt: Date.now(),
  };
  users.set(user.id, user);
  usersByEmail.set(user.email, user);
  usersByEmail.set("demo@beamdrop.io", user);
}
async function startServer() {
  if (!fs.existsSync(UPLOAD_ROOT))
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  connectDatabase();
  await seedDemoUser();
  const app = createApp();
  const server = http.createServer(app);
  setupWebSocket(server);
  app.get("/health", (_req, res) =>
    res.json({ status: "ok", service: "openShare API", timestamp: Date.now() }),
  );
  setInterval(() => {
    for (const [roomId, room] of rooms.entries())
      if (Date.now() > room.expiresAt)
        permanentlyDeleteRoom(roomId, "Room reached expiration time limit");
  }, 30000);
  const cleanAllTemp = async () => {
    console.log("[SHUTDOWN] Wiping all temporary files...");
    try {
      if (fs.existsSync(UPLOAD_ROOT))
        await fs.promises.rm(UPLOAD_ROOT, { recursive: true, force: true });
    } catch {}
  };
  process.on("SIGINT", async () => {
    await cleanAllTemp();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await cleanAllTemp();
    process.exit(0);
  });
  // Bind externally in hosted containers (Render assigns PORT); localhost
  // would make the process unreachable from Render's proxy.
  server.listen(PORT, "0.0.0.0", () =>
    console.log(`Server listening on http://localhost:${PORT}`),
  );
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
