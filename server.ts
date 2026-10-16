import express, { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import * as archiverModule from 'archiver';

function createArchiver(format: string, options: any) {
  let fn: any = (archiverModule as any).default || archiverModule;
  return fn(format, options);
}
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createServer as createViteServer } from 'vite';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';
const UPLOAD_ROOT = path.join(process.cwd(), 'temp_uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'beamdrop-secure-ephemeral-jwt-2026';

// Ensure root temporary directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/openshare';

let isMongoConnected = false;

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Number, default: Date.now },
});

export const MongoUser = mongoose.models.User || mongoose.model('User', userSchema);

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2500 })
  .then(() => {
    isMongoConnected = true;
    console.log('[MongoDB] Connected successfully to MongoDB');
  })
  .catch((err) => {
    console.warn('[MongoDB] Running in-memory database fallback mode:', err.message);
  });

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

// In-memory User database
const users = new Map<string, User>();
const usersByEmail = new Map<string, User>();

// Seed a default demo user for convenience
(async () => {
  const salt = await bcrypt.genSalt(10);
  const demoHash = await bcrypt.hash('Password123', salt);
  const demoUser: User = {
    id: 'user_demo_1',
    email: 'demo@openshare.io',
    username: 'DemoPilot',
    passwordHash: demoHash,
    createdAt: Date.now(),
  };
  users.set(demoUser.id, demoUser);
  usersByEmail.set(demoUser.email.toLowerCase(), demoUser);
  usersByEmail.set('demo@beamdrop.io', demoUser);
})();

export interface RoomFile {
  id: string;
  originalName: string;
  sanitizedName: string;
  size: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: number;
  uploader: string;
  uploaderId?: string;
  downloadCount: number;
}

export interface RoomLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warn' | 'danger';
}

export interface Room {
  id: string;
  createdAt: number;
  expiresAt: number;
  passcode: string | null;
  files: Map<string, RoomFile>;
  logs: RoomLog[];
  totalBytes: number;
  creatorPeerId: string;
  ownerId?: string;
  ownerUsername?: string;
  ownerDeviceId?: string;
}

// In-memory registry of active rooms
const rooms = new Map<string, Room>();

// Track connected WebSocket clients per room
interface PeerSocket extends WebSocket {
  roomId?: string;
  peerId?: string;
  peerName?: string;
  userId?: string;
  deviceId?: string;
  isAlive?: boolean;
}

const roomSockets = new Map<string, Set<PeerSocket>>();

// Map user sockets across all rooms (for user-level notifications)
const userSockets = new Map<string, Set<PeerSocket>>();

function checkRoomOwnership(room: Room, req: Request | any): boolean {
  const reqUser = req.user;
  const deviceId = (req.headers && req.headers['x-device-id'] as string) || (req.body && req.body.deviceId as string) || (req.query && req.query.deviceId as string);

  // 1. If room has an account owner
  if (reqUser && room.ownerId && room.ownerId === reqUser.id) {
    return true;
  }
  // 2. If room was created by this device without account
  if (room.ownerDeviceId && deviceId && room.ownerDeviceId === deviceId) {
    return true;
  }
  // 3. Fallback check for creator peer
  const peerId = (req.headers && req.headers['x-peer-id'] as string) || (req.body && req.body.peerId as string);
  if (peerId && room.creatorPeerId === peerId) {
    return true;
  }
  return false;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || 'MB'}`;
}

function broadcastToRoom(roomId: string, data: any) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  const message = JSON.stringify(data);
  for (const client of sockets) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error sending WS message:', err);
      }
    }
  }
}

function sendNotificationToUser(userId: string, notification: any) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const message = JSON.stringify({
    type: 'notification',
    ...notification,
  });
  for (const client of sockets) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error sending notification to user:', err);
      }
    }
  }
}

function getSafeFileList(room: Room) {
  return Array.from(room.files.values()).map((f) => ({
    id: f.id,
    name: f.originalName,
    size: f.size,
    mimeType: f.mimeType,
    uploadedAt: f.uploadedAt,
    uploader: f.uploader,
    uploaderId: f.uploaderId,
    downloadCount: f.downloadCount,
    roomId: room.id,
  }));
}

function addRoomLog(room: Room, message: string, type: RoomLog['type'] = 'info') {
  const log: RoomLog = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    message,
    type,
  };
  room.logs.push(log);
  if (room.logs.length > 50) {
    room.logs.shift();
  }
  broadcastToRoom(room.id, {
    type: 'room:log',
    log,
  });
}

/**
 * Permanently delete a room, removing all uploaded files from disk and notifying all clients.
 */
async function permanentlyDeleteRoom(roomId: string, reason = 'User requested room deletion'): Promise<boolean> {
  const room = rooms.get(roomId);
  if (!room) return false;

  const roomDir = path.join(UPLOAD_ROOT, roomId);

  // 1. Erase all files on disk
  try {
    if (fs.existsSync(roomDir)) {
      await fs.promises.rm(roomDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to wipe disk directory for room ${roomId}:`, err);
  }

  // 2. Broadcast room:deleted event to all active peers
  broadcastToRoom(roomId, {
    type: 'room:deleted',
    roomId,
    reason,
    purgedAt: Date.now(),
  });

  // 3. Gracefully disconnect all clients in this room
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    for (const ws of sockets) {
      try {
        ws.close(1000, 'Room permanently wiped');
      } catch (e) {}
    }
    roomSockets.delete(roomId);
  }

  // 4. Remove from server memory
  rooms.delete(roomId);
  console.log(`[STORAGE PURGE] Room ${roomId} and all files were permanently removed.`);
  return true;
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const roomId = req.params.roomId;
    const roomDir = path.join(UPLOAD_ROOT, roomId);
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }
    cb(null, roomDir);
  },
  filename: (req, file, cb) => {
    const fileId = crypto.randomUUID().slice(0, 8);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${fileId}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: 20,
  },
});

// Auth token middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (!err && user) {
      req.user = user;
    }
    next();
  });
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Invalid or expired session token' });
    }
    req.user = user;
    next();
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json());
  app.use(optionalAuth);

  // WebSocket Server setup
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: PeerSocket) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: any) => {
      try {
        const payload = JSON.parse(data.toString());

        // Authenticate socket user or register token
        if (payload.type === 'auth') {
          const { token } = payload;
          if (token) {
            jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
              if (!err && decoded) {
                ws.userId = decoded.id;
                ws.peerName = decoded.username;
                if (!userSockets.has(decoded.id)) {
                  userSockets.set(decoded.id, new Set());
                }
                userSockets.get(decoded.id)!.add(ws);
              }
            });
          }
        }

        if (payload.type === 'join') {
          const { roomId, peerId, peerName, userId, deviceId } = payload;
          if (!roomId || !rooms.has(roomId)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found or expired' }));
            return;
          }

          ws.roomId = roomId;
          ws.peerId = peerId || crypto.randomUUID();
          ws.peerName = peerName || 'Guest Peer';
          ws.deviceId = deviceId;
          if (userId) {
            ws.userId = userId;
            if (!userSockets.has(userId)) {
              userSockets.set(userId, new Set());
            }
            userSockets.get(userId)!.add(ws);
          }

          if (!roomSockets.has(roomId)) {
            roomSockets.set(roomId, new Set());
          }
          roomSockets.get(roomId)!.add(ws);

          const room = rooms.get(roomId)!;
          const activePeerCount = roomSockets.get(roomId)?.size || 1;

          const isOwner =
            (room.ownerId && userId && room.ownerId === userId) ||
            (room.ownerDeviceId && deviceId && room.ownerDeviceId === deviceId) ||
            (room.creatorPeerId && ws.peerId && room.creatorPeerId === ws.peerId);

          // Send initial state to the newly connected peer
          ws.send(
            JSON.stringify({
              type: 'room:init',
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
                activePeers: activePeerCount,
              },
            })
          );

          // Log join event
          addRoomLog(room, `${ws.peerName} joined the room.`, 'info');

          // Broadcast peer update to everyone in room
          broadcastToRoom(roomId, {
            type: 'peer:update',
            activePeers: activePeerCount,
          });

          // REAL-TIME NOTIFICATION REQUIREMENT:
          // "Users should receive alerts when a new user joins a room they created"
          if (room.ownerId) {
            const isCreatorJoining = ws.userId === room.ownerId;
            if (!isCreatorJoining) {
              const alertMsg = `${ws.peerName} joined your room ${room.id}`;
              sendNotificationToUser(room.ownerId, {
                notificationType: 'peer_joined',
                roomId: room.id,
                peerName: ws.peerName,
                message: alertMsg,
                timestamp: Date.now(),
              });
            }
          }

          // Also alert peers currently in the room
          broadcastToRoom(roomId, {
            type: 'notification',
            notificationType: 'peer_joined',
            roomId: room.id,
            peerName: ws.peerName,
            message: `${ws.peerName} connected to the room.`,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (ws.userId && userSockets.has(ws.userId)) {
        userSockets.get(ws.userId)!.delete(ws);
      }
      if (ws.roomId && roomSockets.has(ws.roomId)) {
        const sockets = roomSockets.get(ws.roomId)!;
        sockets.delete(ws);
        const remainingPeers = sockets.size;
        const room = rooms.get(ws.roomId);
        if (room) {
          addRoomLog(room, `${ws.peerName || 'Peer'} disconnected.`, 'warn');
          broadcastToRoom(ws.roomId, {
            type: 'peer:update',
            activePeers: remainingPeers,
          });
        }
      }
    });
  });

  // Heartbeat to prune dropped connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      const peer = ws as PeerSocket;
      if (peer.isAlive === false) {
        return peer.terminate();
      }
      peer.isAlive = false;
      peer.ping();
    });
  }, 25000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  // Periodic room auto-expiration cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      if (now > room.expiresAt) {
        permanentlyDeleteRoom(roomId, 'Room reached expiration time limit');
      }
    }
  }, 30000);

  // AUTH API ROUTES

  // Register
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, username, password } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username, and password are required.' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check MongoDB if connected
      if (isMongoConnected) {
        try {
          const existing = await MongoUser.findOne({ email: normalizedEmail });
          if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
          }
        } catch (dbErr) {
          console.error('MongoDB check error:', dbErr);
        }
      }

      if (usersByEmail.has(normalizedEmail)) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const userId = 'usr_' + crypto.randomUUID().slice(0, 8);

      const user: User = {
        id: userId,
        email: normalizedEmail,
        username: username.trim(),
        passwordHash,
        createdAt: Date.now(),
      };

      users.set(userId, user);
      usersByEmail.set(normalizedEmail, user);

      // Persist to MongoDB if connected
      if (isMongoConnected) {
        try {
          await MongoUser.create({
            userId: user.id,
            email: user.email,
            username: user.username,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
          });
        } catch (dbErr) {
          console.error('Failed to create MongoDB user doc:', dbErr);
        }
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Failed to create user account' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      let user = usersByEmail.get(normalizedEmail);

      // Check MongoDB if not found in memory
      if (!user && isMongoConnected) {
        try {
          const doc = await MongoUser.findOne({ email: normalizedEmail });
          if (doc) {
            user = {
              id: doc.userId,
              email: doc.email,
              username: doc.username,
              passwordHash: doc.passwordHash,
              createdAt: doc.createdAt,
            };
            users.set(user.id, user);
            usersByEmail.set(normalizedEmail, user);
          }
        } catch (dbErr) {
          console.error('Error fetching user from MongoDB:', dbErr);
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to log in' });
    }
  });

  // Get current user session
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
    const user = users.get(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  });

  // USER DASHBOARD ROUTES

  // Get active rooms created by the current user
  app.get('/api/user/rooms', requireAuth, (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const userRooms: any[] = [];

    for (const room of rooms.values()) {
      if (room.ownerId === userId) {
        const activeSockets = roomSockets.get(room.id)?.size || 0;
        userRooms.push({
          id: room.id,
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
          fileCount: room.files.size,
          totalBytes: room.totalBytes,
          hasPasscode: !!room.passcode,
          activePeers: activeSockets,
        });
      }
    }

    res.json({ rooms: userRooms });
  });

  // Get active uploaded files by the current user
  app.get('/api/user/files', requireAuth, (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const userFiles: any[] = [];

    for (const room of rooms.values()) {
      for (const file of room.files.values()) {
        if (file.uploaderId === userId) {
          userFiles.push({
            id: file.id,
            name: file.originalName,
            size: file.size,
            mimeType: file.mimeType,
            uploadedAt: file.uploadedAt,
            roomId: room.id,
            downloadCount: file.downloadCount,
          });
        }
      }
    }

    res.json({ files: userFiles });
  });

  // DEVICE ROOMS (For unauthenticated guest devices)
  app.get('/api/device/rooms', (req: Request, res: Response) => {
    const deviceId = (req.headers['x-device-id'] as string) || (req.query.deviceId as string);
    if (!deviceId) {
      return res.json({ rooms: [] });
    }

    const deviceRooms: any[] = [];
    for (const room of rooms.values()) {
      if (room.ownerDeviceId === deviceId && !room.ownerId) {
        const activeSockets = roomSockets.get(room.id)?.size || 0;
        deviceRooms.push({
          id: room.id,
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
          fileCount: room.files.size,
          totalBytes: room.totalBytes,
          hasPasscode: !!room.passcode,
          activePeers: activeSockets,
        });
      }
    }

    res.json({ rooms: deviceRooms });
  });

  // ROOM ROUTES

  // 1. Create a room (supports optional user attachment or guest device attachment)
  app.post('/api/rooms', (req: AuthRequest, res: Response) => {
    try {
      const deviceId = (req.headers['x-device-id'] as string) || req.body.deviceId;
      const isUserLoggedIn = !!req.user;

      // Guest devices: strictly allow only 1 active room at a time!
      if (!isUserLoggedIn && deviceId) {
        for (const existing of rooms.values()) {
          if (existing.ownerDeviceId === deviceId && !existing.ownerId) {
            return res.status(400).json({
              error: `You already have an active room (${existing.id}). Guest devices can only create one room at a time. Close your current room or sign in to create multiple rooms.`,
              existingRoomId: existing.id,
            });
          }
        }
      }

      const { customCode, durationMinutes = 60, passcode, peerId = 'host' } = req.body;

      let roomId = '';
      if (customCode && typeof customCode === 'string') {
        roomId = customCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
      }
      if (!roomId || roomId.length < 3) {
        const prefixes = ['OPEN', 'SHARE', 'VAULT', 'DROP', 'SWIFT', 'RELAY', 'SYNC'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const num = Math.floor(1000 + Math.random() * 9000);
        roomId = `${prefix}-${num}`;
      }

      if (rooms.has(roomId)) {
        return res.status(409).json({ error: 'A room with this code is currently active. Choose a different code.' });
      }

      const durationMs = Math.max(5, Math.min(1440, Number(durationMinutes) || 60)) * 60 * 1000;
      const createdAt = Date.now();
      const expiresAt = createdAt + durationMs;

      // Create isolated disk directory
      const roomDir = path.join(UPLOAD_ROOT, roomId);
      if (!fs.existsSync(roomDir)) {
        fs.mkdirSync(roomDir, { recursive: true });
      }

      const room: Room = {
        id: roomId,
        createdAt,
        expiresAt,
        passcode: passcode && typeof passcode === 'string' && passcode.trim().length > 0 ? passcode.trim() : null,
        files: new Map(),
        logs: [
          {
            id: crypto.randomUUID(),
            timestamp: createdAt,
            message: `Transfer room created. Temporary storage ready.`,
            type: 'info',
          },
        ],
        totalBytes: 0,
        creatorPeerId: peerId,
        ownerId: req.user?.id,
        ownerUsername: req.user?.username,
        ownerDeviceId: deviceId || undefined,
      };

      rooms.set(roomId, room);

      res.status(201).json({
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
    } catch (err: any) {
      console.error('Error creating room:', err);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // 2. Get room details
  app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found or has been permanently deleted.' });
    }

    const passcodeQuery = (req.query.passcode as string) || '';
    if (room.passcode && room.passcode !== passcodeQuery) {
      return res.status(401).json({
        error: 'Passcode required or invalid.',
        requiresPasscode: true,
        roomId: room.id,
      });
    }

    const activeSockets = roomSockets.get(roomId)?.size || 0;
    const isOwner = checkRoomOwnership(room, req);

    res.json({
      id: room.id,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      hasPasscode: !!room.passcode,
      ownerId: room.ownerId,
      ownerUsername: room.ownerUsername,
      ownerDeviceId: room.ownerDeviceId,
      isOwner,
      files: getSafeFileList(room),
      logs: room.logs,
      totalBytes: room.totalBytes,
      activePeers: activeSockets,
    });
  });

  // 3. Upload files to room (restricted to room creator)
  app.post('/api/rooms/:roomId/upload', upload.array('files', 20), (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room does not exist or was deleted.' });
    }

    if (!checkRoomOwnership(room, req)) {
      return res.status(403).json({ error: 'Receivers are not allowed to upload files. Only the room creator can upload.' });
    }

    const uploader = req.user?.username || (req.body.uploader as string) || 'Peer';
    const uploaderId = req.user?.id;
    const uploadedFiles = req.files as Express.Multer.File[];

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const newFiles: RoomFile[] = [];

    for (const f of uploadedFiles) {
      const fileId = crypto.randomUUID().slice(0, 8);
      const roomFile: RoomFile = {
        id: fileId,
        originalName: f.originalname,
        sanitizedName: f.filename,
        size: f.size,
        mimeType: f.mimetype || 'application/octet-stream',
        storagePath: f.path,
        uploadedAt: Date.now(),
        uploader,
        uploaderId,
        downloadCount: 0,
      };

      room.files.set(fileId, roomFile);
      room.totalBytes += f.size;
      newFiles.push(roomFile);
    }

    const logSummary =
      newFiles.length === 1
        ? `${uploader} uploaded "${newFiles[0].originalName}" (${formatBytes(newFiles[0].size)})`
        : `${uploader} uploaded ${newFiles.length} files (${formatBytes(newFiles.reduce((acc, curr) => acc + curr.size, 0))})`;

    addRoomLog(room, logSummary, 'success');

    // Real-time broadcast to all connected peers in this room
    broadcastToRoom(roomId, {
      type: 'files:updated',
      files: getSafeFileList(room),
      totalBytes: room.totalBytes,
    });

    // REAL-TIME NOTIFICATION REQUIREMENT:
    // "Users should receive alerts when new files are uploaded to a room they are in"
    const fileNotification = {
      notificationType: 'file_uploaded',
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

    broadcastToRoom(roomId, {
      type: 'notification',
      ...fileNotification,
    });

    res.json({
      success: true,
      files: newFiles.map((f) => ({
        id: f.id,
        name: f.originalName,
        size: f.size,
        mimeType: f.mimeType,
        uploadedAt: f.uploadedAt,
        uploader: f.uploader,
        uploaderId: f.uploaderId,
      })),
      totalBytes: room.totalBytes,
    });
  });

  // 4. Download individual file
  app.get('/api/rooms/:roomId/files/:fileId/download', (req: Request, res: Response) => {
    const { roomId, fileId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room has been deleted.' });
    }

    const file = room.files.get(fileId);
    if (!file || !fs.existsSync(file.storagePath)) {
      return res.status(404).json({ error: 'File not found or was removed.' });
    }

    file.downloadCount += 1;
    addRoomLog(room, `File "${file.originalName}" was downloaded.`, 'info');

    broadcastToRoom(roomId, {
      type: 'files:updated',
      files: getSafeFileList(room),
      totalBytes: room.totalBytes,
    });

    res.download(file.storagePath, file.originalName, (err) => {
      if (err && !res.headersSent) {
        console.error('Error during download:', err);
      }
    });
  });

  // 5. Download all files as a ZIP bundle
  app.get('/api/rooms/:roomId/download-all', (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room has been deleted.' });
    }

    if (room.files.size === 0) {
      return res.status(400).json({ error: 'Room contains no files.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${roomId}-files.zip"`);

    const archive = createArchiver('zip', { zlib: { level: 0 } });

    archive.on('error', (err: any) => {
      console.error('ZIP archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create zip archive' });
      }
    });

    archive.pipe(res);

    for (const file of room.files.values()) {
      if (fs.existsSync(file.storagePath)) {
        archive.file(file.storagePath, { name: file.originalName });
        file.downloadCount += 1;
      }
    }

    addRoomLog(room, `Batch ZIP bundle (${room.files.size} files) was downloaded.`, 'info');

    broadcastToRoom(roomId, {
      type: 'files:updated',
      files: getSafeFileList(room),
      totalBytes: room.totalBytes,
    });

    archive.finalize();
  });

  // 6. Delete a single file (restricted to room creator)
  app.delete('/api/rooms/:roomId/files/:fileId', async (req: Request, res: Response) => {
    const { roomId, fileId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (!checkRoomOwnership(room, req)) {
      return res.status(403).json({ error: 'Permission denied. Receivers cannot delete files. Only the room creator can delete files.' });
    }

    const file = room.files.get(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    try {
      if (fs.existsSync(file.storagePath)) {
        await fs.promises.unlink(file.storagePath);
      }
    } catch (err) {
      console.error('Failed to unlink file:', err);
    }

    room.totalBytes -= file.size;
    room.files.delete(fileId);

    addRoomLog(room, `File "${file.originalName}" was permanently removed.`, 'warn');

    broadcastToRoom(roomId, {
      type: 'files:updated',
      files: getSafeFileList(room),
      totalBytes: room.totalBytes,
    });

    res.json({ success: true, message: 'File permanently erased.' });
  });

  // 7. Delete room & permanently purge ALL files from disk and memory (restricted to room creator)
  app.delete('/api/rooms/:roomId', async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room does not exist or was already deleted.' });
    }

    if (!checkRoomOwnership(room, req)) {
      return res.status(403).json({ error: 'Permission denied. Receivers cannot delete this room. Only the room creator can delete it.' });
    }

    const success = await permanentlyDeleteRoom(roomId, 'Room closed by creator');

    if (!success) {
      return res.status(404).json({ error: 'Room does not exist or was already deleted.' });
    }

    res.json({
      success: true,
      message: 'Room and all files permanently removed from disk and server memory.',
    });
  });

  // Cleanup on process termination
  const cleanAllTemp = async () => {
    console.log('[SHUTDOWN] Wiping all temporary files...');
    try {
      if (fs.existsSync(UPLOAD_ROOT)) {
        await fs.promises.rm(UPLOAD_ROOT, { recursive: true, force: true });
      }
    } catch (e) {}
  };

  process.on('SIGINT', async () => {
    await cleanAllTemp();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await cleanAllTemp();
    process.exit(0);
  });

  // Frontend integration: Vite middleware in dev, static files in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
