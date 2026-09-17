import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { Device } from "../../models/Device.js";

export const devicesRouter = router({
  list: protectedProcedure.query(async () => {
    const devices = await Device.find().sort({ createdAt: 1 });
    return devices.map((d) => ({
      id: d._id.toString(),
      deviceLabel: d.deviceLabel,
      userAgent: d.userAgent,
      lastActiveAt: d.lastActiveAt!.toISOString(),
      createdAt: d.createdAt!.toISOString(),
    }));
  }),

  register: protectedProcedure
    .input(z.object({ deviceLabel: z.string().min(1), userAgent: z.string().optional() }))
    .mutation(async ({ input }) => {
      const device = await Device.create({ deviceLabel: input.deviceLabel, userAgent: input.userAgent ?? null });
      return { id: device._id.toString() };
    }),
});
