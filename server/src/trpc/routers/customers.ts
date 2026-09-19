import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure } from "../trpc.js";
import { Customer } from "../../models/Customer.js";
import { Order } from "../../models/Order.js";
import { normalizePhone } from "../../lib/phone.js";

function toApiCustomer(c: any, statsByPhone?: Map<string, any>) {
  const normPhone = c.normalizedPhone || normalizePhone(c.phone);
  const s = statsByPhone?.get(c.phone) || statsByPhone?.get(normPhone);
  const totalSpent = s?.totalSpent ?? 0;
  const pendingBalance = Math.max(0, totalSpent - (s?.totalPaid ?? 0));

  return {
    id: c._id.toString(),
    name: c.name,
    phone: c.phone,
    normalizedPhone: normPhone,
    customerType: (c.customerType || "Normal") as "Normal" | "Premium",
    address: c.address ?? null,
    alternatePhone: c.alternatePhone ?? null,
    notes: c.notes ?? null,
    storedClothesCode: c.storedClothesCode ?? null,
    orderCount: s?.orderCount ?? 0,
    totalSpent,
    pendingBalance,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
  };
}

export const customersRouter = router({
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
    const statsByPhone = new Map<string, any>(stats.map((s: any) => [s._id, s]));

    return customers.map((c: any) => toApiCustomer(c, statsByPhone));
  }),

  search: approvedProcedure
    .input(
      z.object({
        query: z.string().default(""),
        limit: z.number().min(1).max(50).default(15),
      })
    )
    .query(async ({ input }) => {
      const q = input.query.trim();
      const normDigits = normalizePhone(q);

      let filter: Record<string, any> = {};
      if (q) {
        const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const conditions: any[] = [
          { name: { $regex: escapedQuery, $options: "i" } },
          { storedClothesCode: { $regex: escapedQuery, $options: "i" } },
          { phone: { $regex: escapedQuery, $options: "i" } },
        ];
        if (normDigits) {
          conditions.push({ normalizedPhone: { $regex: normDigits } });
        }
        filter = { $or: conditions };
      }

      const customers = await Customer.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(input.limit);

      return customers.map((c: any) => toApiCustomer(c));
    }),

  checkDuplicate: approvedProcedure
    .input(
      z.object({
        phone: z.string().min(1),
        excludeId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const normPhone = normalizePhone(input.phone);
      if (!normPhone) {
        return { exists: false, customer: null };
      }

      const filter: Record<string, any> = {
        $or: [
          { normalizedPhone: normPhone },
          { phone: input.phone.trim() },
          { phone: normPhone },
        ],
      };

      if (input.excludeId) {
        filter._id = { $ne: input.excludeId };
      }

      const existing = await Customer.findOne(filter);
      if (!existing) {
        return { exists: false, customer: null };
      }

      return {
        exists: true,
        customer: toApiCustomer(existing),
      };
    }),

  create: approvedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Customer name is required"),
        phone: z.string().trim().min(1, "Phone number is required"),
        customerType: z.enum(["Normal", "Premium"]).default("Normal"),
        address: z.string().optional(),
        alternatePhone: z.string().optional(),
        notes: z.string().optional(),
        storedClothesCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const normPhone = normalizePhone(input.phone);
      if (!normPhone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Valid phone number is required" });
      }

      const existing = await Customer.findOne({
        $or: [{ normalizedPhone: normPhone }, { phone: input.phone.trim() }],
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A customer with this phone number (${existing.phone}) already exists: ${existing.name}`,
        });
      }

      const customer = await Customer.create({
        ...input,
        phone: input.phone.trim(),
        normalizedPhone: normPhone,
        storedClothesCode: input.storedClothesCode?.trim() || `C-${normPhone.slice(-4) || "0000"}`,
      });

      return toApiCustomer(customer);
    }),

  update: approvedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).optional(),
        phone: z.string().trim().min(1).optional(),
        customerType: z.enum(["Normal", "Premium"]).optional(),
        address: z.string().optional(),
        alternatePhone: z.string().optional(),
        notes: z.string().optional(),
        storedClothesCode: z.string().optional(),
      })
    )
    .mutation(async ({ input: { id, ...patch } }) => {
      const updateData: Record<string, any> = { ...patch };
      if (patch.phone) {
        const normPhone = normalizePhone(patch.phone);
        updateData.normalizedPhone = normPhone;
        // Check for duplicate phone when updating
        const duplicate = await Customer.findOne({
          _id: { $ne: id },
          $or: [{ normalizedPhone: normPhone }, { phone: patch.phone }],
        });
        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Another customer (${duplicate.name}) already uses this phone number`,
          });
        }
      }

      const customer = await Customer.findByIdAndUpdate(id, updateData, { new: true });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      return toApiCustomer(customer);
    }),
});

