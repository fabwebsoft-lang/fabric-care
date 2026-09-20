import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requirePermission } from "../trpc.js";
import { Worker } from "../../models/Worker.js";
import { hashSecret, compareSecret, signRoleToken } from "../../lib/auth.js";
import type { RoleName } from "../../lib/permissions.js";

// Admins assign real roles only — "pending" is set automatically by
// auth.signup and cleared here the moment an admin approves the account.
const roleSchema = z.enum(["admin", "manager", "staff"]);
const simulatableRoles: readonly string[] = ["admin", "manager", "staff"] satisfies RoleName[];

export const workersRouter = router({
  // Admin-only: this list includes pending signups and email addresses.
  list: requirePermission("canManageRoles").query(async () => {
    const workers = await Worker.find().sort({ createdAt: 1 });
    return workers.map((w) => ({
      id: w._id.toString(),
      name: w.name,
      email: w.email ?? null,
      role: w.role,
      active: w.active ? 1 : 0,
      hasPin: Boolean(w.pinHash),
      createdAt: w.createdAt!.toISOString(),
    }));
  }),

  create: requirePermission("canManageRoles")
    .input(z.object({ name: z.string().min(1), role: roleSchema, pin: z.string().length(4).optional() }))
    .mutation(async ({ input }) => {
      if ((input.role === "admin" || input.role === "manager") && (!input.pin || !/^\d{4}$/.test(input.pin))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Admin and Manager roles require a 4-digit security PIN.",
        });
      }
      const pinHash = input.pin ? await hashSecret(input.pin) : undefined;
      const worker = await Worker.create({
        name: input.name,
        role: input.role,
        pinHash,
        active: true,
      });
      return { id: worker._id.toString(), name: worker.name, role: worker.role };
    }),

  // Also how an admin approves a pending signup: assigning any real role
  // moves them out of "pending" and grants them that role's permissions
  // immediately (the role is looked up fresh per-request, not cached).
  updateRole: requirePermission("canManageRoles")
    .input(z.object({ workerId: z.string(), role: roleSchema }))
    .mutation(async ({ input }) => {
      const existing = await Worker.findById(input.workerId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if ((input.role === "admin" || input.role === "manager") && !existing.pinHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot assign Admin or Manager role without a security PIN. Set a PIN first.",
        });
      }
      existing.role = input.role;
      await existing.save();
      return { id: existing._id.toString(), role: existing.role };
    }),

  delete: requirePermission("canManageRoles")
    .input(z.object({ workerId: z.string() }))
    .mutation(async ({ input }) => {
      await Worker.findByIdAndDelete(input.workerId);
      return { success: true };
    }),

  setPin: requirePermission("canManageRoles")
    .input(z.object({ workerId: z.string(), pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits") }))
    .mutation(async ({ input }) => {
      const pinHash = await hashSecret(input.pin);
      const worker = await Worker.findByIdAndUpdate(input.workerId, { pinHash }, { new: true });
      if (!worker) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  // Verifies a worker's PIN and, on success, issues a short-lived role-token
  // that scopes down server-side permission checks for the rest of the
  // session (see requirePermission in trpc.ts). This is what makes the
  // "Roles & Access" simulator in the UI an actual security boundary instead
  // of a client-side-only display toggle.
  verifyPin: protectedProcedure
    .input(z.object({ workerId: z.string(), pin: z.string().length(4) }))
    .mutation(async ({ input }) => {
      const worker = await Worker.findById(input.workerId);
      if (!worker?.pinHash || !(await compareSecret(input.pin, worker.pinHash))) {
        return { success: false as const };
      }
      if (!simulatableRoles.includes(worker.role)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This worker's role cannot be simulated" });
      }
      const role = worker.role as RoleName;
      const roleToken = signRoleToken(worker._id.toString(), role);
      return { success: true as const, roleToken, role };
    }),
});
