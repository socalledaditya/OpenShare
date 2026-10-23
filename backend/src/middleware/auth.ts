import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import type { AuthRequest } from "../types/index.js";

export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user) req.user = user as AuthRequest["user"];
    next();
  });
}
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Authentication required" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || !user)
      return res
        .status(403)
        .json({ error: "Invalid or expired session token" });
    req.user = user as AuthRequest["user"];
    next();
  });
}
