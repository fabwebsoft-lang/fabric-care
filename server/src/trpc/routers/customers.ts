import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure } from "../trpc.js";
import { Customer } from "../../models/Customer.js";
import { Order } from "../../models/Order.js";

export const customersRouter = router({
  // orderCount / totalSpent / pendingBalance are derived from Orders here
  // rather than stored on the Customer document, so they can never drift
  // out of sync the way denormalized fields would.
  list: approvedProcedure.query(async () => {
    const customers = await Customer.find().sort({ createdAt: -1 });
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$phone",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$amountPaid" },
        },
      },
    ]);
    const statsByPhone = new Map(stats.map((s) => [s._id, s]));

    return customers.map((c) => {
      const s = statsByPhone.get(c.phone);
      const totalSpent = s?.totalSpent ?? 0;
      const pendingBalance = Math.max(0, totalSpent - (s?.totalPaid ?? 0));
      return {
        id: c._id.toString(),
        name: c.name,
        phone: c.phone,
        customerType: c.customerType,
        address: c.address,
        alternatePhone: c.alternatePhone,
        notes: c.notes,
        storedClothesCode: c.storedClothesCode,
        orderCount: s?.orderCount ?? 0,
        totalSpent,
        pendingBalance,
        createdAt: c.createdAt!.toISOString(),
      };
    });
  }),

  create: approvedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        customerType: z.enum(["Normal", "Premium"]).default("Normal"),
        address: z.string().optional(),
        alternatePhone: z.string().optional(),
        notes: z.string().optional(),
        storedClothesCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await Customer.findOne({ phone: input.phone });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Customer with this phone already exists" });
      const customer = await Customer.create({
        ...input,
        storedClothesCode: input.storedClothesCode || `C-${input.phone.slice(-4)}`,
      });
      return { id: customer._id.toString(), name: customer.name, phone: customer.phone };
    }),

  update: approvedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        customerType: z.enum(["Normal", "Premium"]).optional(),
        address: z.string().optional(),
        alternatePhone: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input: { id, ...patch } }) => {
      const customer = await Customer.findByIdAndUpdate(id, patch, { new: true });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: customer._id.toString() };
    }),
});
