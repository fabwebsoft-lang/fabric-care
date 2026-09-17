import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { Worker } from "../../models/Worker.js";
import { compareSecret, hashSecret, signSessionToken } from "../../lib/auth.js";

function toApiSelf(w: InstanceType<typeof Worker>) {
  return { id: w._id.toString(), name: w.name, email: w.email ?? null, role: w.role };
}

export const authRouter = router({
  // New accounts start as "pending" — no permissions until an admin assigns
  // them a real role from the Roles & Access screen (workers.updateRole).
  signup: publicProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(6) }))
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase();
      const existing = await Worker.findOne({ email });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });

      const passwordHash = await hashSecret(input.password);
      const worker = await Worker.create({
        name: input.name,
        email,
        passwordHash,
        role: "pending",
        active: true,
      });

      const token = signSessionToken(worker._id.toString());
      return { token, user: toApiSelf(worker) };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const worker = await Worker.findOne({ email: input.email.toLowerCase() });
      if (!worker?.passwordHash || !(await compareSecret(input.password, worker.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const token = signSessionToken(worker._id.toString());
      return { token, user: toApiSelf(worker) };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const worker = await Worker.findById(ctx.userId);
    if (!worker) throw new TRPCError({ code: "UNAUTHORIZED" });
    return toApiSelf(worker);
  }),

  logout: protectedProcedure.mutation(async () => {
    return { success: true };
  }),
});
