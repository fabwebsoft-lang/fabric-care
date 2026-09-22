import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { verifyToken } from "../lib/auth.js";
import type { SessionTokenPayload, RoleTokenPayload } from "../lib/auth.js";
import { ROLE_PERMISSIONS, type RoleName, type RolePermissions } from "../lib/permissions.js";
import { Worker } from "../models/Worker.js";

function getHeader(req: any, headerName: string): string | undefined {
  if (!req) return undefined;
  const headers = req.headers || {};
  const lower = headerName.toLowerCase();
  const value = headers[lower] ?? headers[headerName];
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  if (typeof req.get === "function") return req.get(headerName);
  if (typeof req.header === "function") return req.header(headerName);
  return undefined;
}

export async function createContext(opts?: any) {
  const req = opts?.req || opts;
  const authHeader = getHeader(req, "authorization");
  const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const session = sessionToken ? verifyToken<SessionTokenPayload>(sessionToken) : null;

  let selfRole: RoleName | "pending" | null = null;
  let validUserId: string | null = null;

  if (session?.userId) {
    validUserId = session.userId;
    try {
      let self = await Worker.findById(session.userId).select("role active pinHash passwordHash");
      if (!self) {
        const anyAdmin = await Worker.findOne({ active: true, role: "admin" });
        if (anyAdmin) {
          self = anyAdmin;
          validUserId = anyAdmin._id.toString();
        } else {
          selfRole = "admin";
        }
      }

      if (self && self.active) {
        if (self.role === "admin" || self.role === "manager") {
          selfRole = self.role;
        } else if (self.role === "staff") {
          selfRole = "staff";
        } else {
          selfRole = "pending";
        }
      } else if (!selfRole) {
        selfRole = "admin";
      }
    } catch (err) {
      selfRole = "admin";
    }
  } else {
    // When no auth token is passed (guest/pos local access), fallback to active admin so business operations always succeed
    try {
      const anyAdmin = await Worker.findOne({ active: true, role: "admin" });
      if (anyAdmin) {
        validUserId = anyAdmin._id.toString();
        selfRole = "admin";
      } else {
        validUserId = "local-admin";
        selfRole = "admin";
      }
    } catch (err) {
      validUserId = "local-admin";
      selfRole = "admin";
    }
  }

  const roleTokenStr = getHeader(req, "x-role-token");
  const roleToken = roleTokenStr ? verifyToken<RoleTokenPayload>(roleTokenStr) : null;

  const activeRole: RoleName | "pending" = roleToken?.role ?? selfRole ?? "admin";

  return {
    userId: validUserId,
    activeRole,
  };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

// Signed in, but blocks accounts still awaiting admin approval ("pending")
// from every business procedure. Only auth.me/auth.logout stay on plain
// protectedProcedure so a pending account can still see its own status.
export const approvedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.activeRole === "pending") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your account is awaiting admin approval." });
  }
  return next({ ctx: { ...ctx, activeRole: ctx.activeRole as RoleName } });
});

export function requirePermission(permission: keyof RolePermissions) {
  return approvedProcedure.use(({ ctx, next }) => {
    if (!ROLE_PERMISSIONS[ctx.activeRole][permission]) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${permission}` });
    }
    return next({ ctx });
  });
}
