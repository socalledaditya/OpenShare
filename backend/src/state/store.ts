import type { PeerSocket, Room, User } from '../types/index.js';

export const users = new Map<string, User>();
export const usersByEmail = new Map<string, User>();
export const rooms = new Map<any, Room>();
export const roomSockets = new Map<string, Set<PeerSocket>>();
export const userSockets = new Map<string, Set<PeerSocket>>();
