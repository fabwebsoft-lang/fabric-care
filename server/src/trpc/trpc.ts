import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { verifyToken } from "../lib/auth.js";
import type { SessionTokenPayload, RoleTokenPayload } from "../lib/auth.js";
import { ROLE_PERMISSIONS, type RoleName, type RolePermissions } from "../lib/permissions.js";

export function createContext({ req }: CreateExpressContextOptions) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const session = sessionToken ? verifyToken<SessionTokenPayload>(sessionToken) : null;

  const roleHeader = req.headers["x-role-token"];
  const roleTokenStr = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
  const roleToken = roleTokenStr ? verifyToken<RoleTokenPayload>(roleTokenStr) : null;

  // No active role-token means the logged-in shop owner is acting directly (admin).
  // Entering a worker's PIN (workers.verifyPin) issues a role-token that scopes
  // down the active permission set for the rest of that session.
  const activeRole: RoleName = roleToken?.role ?? "admin";

  return {
    userId: session?.userId ?? null,
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

export function requirePermission(permission: keyof RolePermissions) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!ROLE_PERMISSIONS[ctx.activeRole][permission]) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${permission}` });
    }
    return next({ ctx });
  });
}
