import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../env.js";
import type { RoleName } from "./permissions.js";

export interface SessionTokenPayload {
  type: "session";
  userId: string;
}

export interface RoleTokenPayload {
  type: "role";
  workerId: string;
  role: RoleName;
}

export function signSessionToken(userId: string): string {
  const payload: SessionTokenPayload = { type: "session", userId };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "30d" });
}

export function signRoleToken(workerId: string, role: RoleName): string {
  const payload: RoleTokenPayload = { type: "role", workerId, role };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
}

export function verifyToken<T>(token: string): T | null {
  try {
    return jwt.verify(token, env.jwtSecret) as T;
  } catch {
    return null;
  }
}

export const hashSecret = (plain: string) => bcrypt.hash(plain, 10);
export const compareSecret = (plain: string, hash: string) => bcrypt.compare(plain, hash);
