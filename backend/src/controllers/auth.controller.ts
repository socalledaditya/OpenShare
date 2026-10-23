import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { JWT_SECRET } from "../config/env.js";
import { MongoUser, isMongoConnected } from "../models/user.model.js";
import { users, usersByEmail } from "../state/store.js";
import type { AuthRequest, User } from "../types/index.js";

const tokenFor = (user: User) =>
  jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  createdAt: user.createdAt,
});
export async function register(req: Request, res: Response) {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password)
      return res
        .status(400)
        .json({ error: "Email, username, and password are required." });
    const normalizedEmail = email.trim().toLowerCase();
    if (isMongoConnected)
      try {
        if (await MongoUser.findOne({ email: normalizedEmail }))
          return res
            .status(409)
            .json({ error: "An account with this email already exists." });
      } catch (dbErr) {
        console.error("MongoDB check error:", dbErr);
      }
    if (usersByEmail.has(normalizedEmail))
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const user: User = {
      id: "usr_" + crypto.randomUUID().slice(0, 8),
      email: normalizedEmail,
      username: username.trim(),
      passwordHash,
      createdAt: Date.now(),
    };
    users.set(user.id, user);
    usersByEmail.set(normalizedEmail, user);
    if (isMongoConnected)
      try {
        await MongoUser.create({
          userId: user.id,
          email: user.email,
          username: user.username,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
        });
      } catch (dbErr) {
        console.error("Failed to create MongoDB user doc:", dbErr);
      }
    res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to create user account" });
  }
}
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    const normalizedEmail = email.trim().toLowerCase();
    let user = usersByEmail.get(normalizedEmail);
    if (!user && isMongoConnected)
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
        console.error("Error fetching user from MongoDB:", dbErr);
      }
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: "Invalid email or password." });
    res.json({ user: publicUser(user), token: tokenFor(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to log in" });
  }
}
export function me(req: AuthRequest, res: Response) {
  const user = users.get(req.user!.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
}
