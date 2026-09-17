import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { User } from "../../models/User.js";
import { compareSecret, signSessionToken } from "../../lib/auth.js";

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await User.findOne({ email: input.email.toLowerCase() });
      if (!user || !(await compareSecret(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const token = signSessionToken(user._id.toString());
      return {
        token,
        user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await User.findById(ctx.userId);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
  }),

  logout: protectedProcedure.mutation(async () => {
    return { success: true };
  }),
});
