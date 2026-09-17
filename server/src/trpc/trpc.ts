import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { verifyToken } from "../lib/auth.js";
import type { SessionTokenPayload, RoleTokenPayload } from "../lib/auth.js";
import { ROLE_PERMISSIONS, type RoleName, type RolePermissions } from "../lib/permissions.js";
import { Worker } from "../models/Worker.js";

export async function createContext({ req }: CreateExpressContextOptions) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const session = sessionToken ? verifyToken<SessionTokenPayload>(sessionToken) : null;

  // The account's own role is looked up fresh on every request (not baked
  // into the JWT) so an admin approving a pending signup takes effect
  // immediately, without the user needing to log out and back in.
  let selfRole: RoleName | "pending" | null = null;
  if (session?.userId) {
    const self = await Worker.findById(session.userId).select("role active");
    if (self?.active) {
      selfRole = self.role === "admin" || self.role === "manager" || self.role === "staff" ? self.role : "pending";
    }
  }

  const roleHeader = req.headers["x-role-token"];
  const roleTokenStr = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
  const roleToken = roleTokenStr ? verifyToken<RoleTokenPayload>(roleTokenStr) : null;

  // A role-token (from workers.verifyPin, e.g. a shared counter device)
  // overrides the signed-in account's own role for the rest of the request.
  const activeRole: RoleName | "pending" = roleToken?.role ?? selfRole ?? "pending";

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
