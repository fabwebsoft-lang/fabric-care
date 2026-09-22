import { z } from "zod";
import mongoose from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
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
    customerId: c.customerId ?? null,
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
    const customers = await Customer.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    const stats = await Order.aggregate([
      { $match: { isDeleted: { $ne: true } } },
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

      let filter: Record<string, any> = { isDeleted: { $ne: true } };
      if (q) {
        const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const conditions: any[] = [
          { name: { $regex: escapedQuery, $options: "i" } },
          { customerId: { $regex: escapedQuery, $options: "i" } },
          { storedClothesCode: { $regex: escapedQuery, $options: "i" } },
          { phone: { $regex: escapedQuery, $options: "i" } },
        ];
        if (normDigits) {
          conditions.push({ normalizedPhone: { $regex: normDigits } });
        }
        filter = {
          $and: [{ isDeleted: { $ne: true } }, { $or: conditions }],
        };
      }

      const customers = await Customer.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(input.limit);

      return customers.map((c: any) => toApiCustomer(c));
    }),

  checkDuplicate: approvedProcedure
    .input(
      z.object({
        phone: z.string().optional(),
        customerId: z.string().optional(),
        excludeId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const conditions: any[] = [];

      if (input.phone) {
        const normPhone = normalizePhone(input.phone);
        if (normPhone) {
          conditions.push(
            { normalizedPhone: normPhone },
            { phone: input.phone.trim() },
            { phone: normPhone }
          );
        }
      }

      if (input.customerId && input.customerId.trim()) {
        const cleanId = input.customerId.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        conditions.push({ customerId: { $regex: `^${cleanId}$`, $options: "i" } });
      }

      if (conditions.length === 0) {
        return { exists: false, customer: null };
      }

      const filter: Record<string, any> = {
        isDeleted: { $ne: true },
        $or: conditions,
      };
      if (input.excludeId) {
        if (mongoose.isValidObjectId(input.excludeId)) {
          filter._id = { $ne: input.excludeId };
        } else {
          filter.customerId = { $ne: input.excludeId };
        }
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
        customerId: z.string().trim().min(1, "Customer ID is required"),
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
      const cleanCustomerId = input.customerId.trim();
      const normPhone = normalizePhone(input.phone);
      if (!normPhone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Valid phone number is required" });
      }

      // Check Customer ID uniqueness (case-insensitive)
      const existingId = await Customer.findOne({
        customerId: { $regex: `^${cleanCustomerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });
      if (existingId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This Customer ID is already used",
        });
      }

      // Check Phone uniqueness
      const existingPhone = await Customer.findOne({
        $or: [{ normalizedPhone: normPhone }, { phone: input.phone.trim() }],
      });

      if (existingPhone) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A customer with this mobile number already exists",
        });
      }

      const customer = await Customer.create({
        ...input,
        customerId: cleanCustomerId,
        phone: input.phone.trim(),
        normalizedPhone: normPhone,
        storedClothesCode: input.storedClothesCode?.trim() || null,
      });

      return toApiCustomer(customer);
    }),

  update: approvedProcedure
    .input(
      z.object({
        id: z.string(),
        customerId: z.string().trim().min(1).optional(),
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
      const excludeFilter = mongoose.isValidObjectId(id) ? { _id: { $ne: id } } : { customerId: { $ne: id } };

      if (patch.customerId) {
        const cleanCustomerId = patch.customerId.trim();
        // Check for duplicate Customer ID
        const duplicateId = await Customer.findOne({
          ...excludeFilter,
          customerId: { $regex: `^${cleanCustomerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });
        if (duplicateId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This Customer ID is already used",
          });
        }
        updateData.customerId = cleanCustomerId;
      }

      if (patch.phone) {
        const normPhone = normalizePhone(patch.phone);
        updateData.normalizedPhone = normPhone;
        // Check for duplicate phone when updating
        const duplicate = await Customer.findOne({
          ...excludeFilter,
          $or: [{ normalizedPhone: normPhone }, { phone: patch.phone }],
        });
        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A customer with this mobile number already exists",
          });
        }
      }

      let customer: any = null;
      if (mongoose.isValidObjectId(id)) {
        customer = await Customer.findByIdAndUpdate(id, updateData, { new: true });
      }
      if (!customer) {
        customer = await Customer.findOneAndUpdate(
          { $or: [{ customerId: id }, { phone: id }] },
          updateData,
          { new: true }
        );
      }

      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      return toApiCustomer(customer);
    }),

  delete: requirePermission("canDeleteCustomers")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userLabel = ctx.activeRole
        ? String(ctx.activeRole).charAt(0).toUpperCase() + String(ctx.activeRole).slice(1)
        : "Admin";
      let customer: any = null;
      if (mongoose.isValidObjectId(input.id)) {
        customer = await Customer.findByIdAndUpdate(
          input.id,
          { isDeleted: true, deletedAt: new Date(), deletedBy: userLabel },
          { new: true }
        );
      }
      if (!customer) {
        customer = await Customer.findOneAndUpdate(
          { $or: [{ customerId: input.id }, { phone: input.id }] },
          { isDeleted: true, deletedAt: new Date(), deletedBy: userLabel },
          { new: true }
        );
      }
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      return { success: true };
    }),

  deleteAll: requirePermission("canDeleteCustomers").mutation(async () => {
    await Customer.deleteMany({});
    return { success: true };
  }),
});
