import { z } from "zod";
import mongoose from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Order } from "../../models/Order.js";
import { Customer } from "../../models/Customer.js";
import { DeletedBill } from "../../models/DeletedBill.js";
import { Expense } from "../../models/Expense.js";
import { IroningTask } from "../../models/IroningTask.js";
import { Product } from "../../models/Product.js";
import { normalizePhone } from "../../lib/phone.js";

const orderItemInput = z.object({
  productId: z.string().nullable().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  staffIroningRate: z.number().min(0).optional(),
  clothTags: z.array(z.string()).optional(),
});

function toApiOrder(o: any) {
  return {
    id: o._id as string,
    customerId: (o.customerId as string | null) || null,
    customer: o.customer,
    phone: o.phone,
    customerType: o.customerType,
    clothesCode: o.clothesCode,
    serviceType: o.serviceType,
    status: o.status,
    deliveryType: o.deliveryType,
    dueAt: o.dueAt ? o.dueAt.toISOString() : null,
    totalAmount: o.totalAmount,
    amountPaid: o.amountPaid,
    discount: o.discount,
    items: o.items,
    branch: o.branch || "Pandian Nagar",
    branchAddress: o.branchAddress || (o.branch?.includes("SKT") ? "SKT Dindigul" : "17/B3, 1st street, Pandian Nagar, Dindigul"),
    createdAt: o.createdAt!.toISOString(),
    updatedAt: o.updatedAt!.toISOString(),
  };
}

async function nextOrderId(): Promise<string> {
  const fcOrders = await Order.find(
    { _id: { $regex: /^FC-\d+$/ } },
    { _id: 1 }
  ).lean();

  let maxNum = 0;
  for (const o of fcOrders) {
    const match = (o._id as string).match(/^FC-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidateId = `FC-${nextNum < 10000 ? String(nextNum).padStart(4, "0") : nextNum}`;

  while (await Order.exists({ _id: candidateId })) {
    nextNum++;
    candidateId = `FC-${nextNum < 10000 ? String(nextNum).padStart(4, "0") : nextNum}`;
  }

  return candidateId;
}

export const ordersRouter = router({
  list: approvedProcedure.query(async () => {
    const orders = await Order.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    return orders.map(toApiOrder);
  }),

  create: requirePermission("canCreateOrders")
    .input(
      z.object({
        customerRefId: z.string().optional(),
        customerId: z.string().trim().min(1, "Customer ID is required"),
        customerName: z.string().trim().min(1, "Customer name is required"),
        phone: z.string().trim().min(1, "Phone number is required"),
        customerType: z.enum(["Normal", "Premium"]).default("Normal"),
        serviceType: z.string().default("Standard Laundry"),
        deliveryType: z.enum(["Shop Collection", "Home Delivery"]).default("Shop Collection"),
        dueAt: z.string().datetime().optional(),
        orderDate: z.string().optional(),
        totalAmount: z.number().nonnegative(),
        amountPaid: z.number().nonnegative().default(0),
        discount: z.number().nonnegative().default(0),
        storedClothesCode: z.string().optional(),
        address: z.string().optional(),
        alternatePhone: z.string().optional(),
        notes: z.string().optional(),
        branch: z.string().optional(),
        branchAddress: z.string().optional(),
        updateCustomerMaster: z.boolean().optional(),
        items: z.array(orderItemInput).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const id = await nextOrderId();
      const normPhone = normalizePhone(input.phone);
      const cleanCustomerId = input.customerId.trim();

      let orderCustomerId: string = cleanCustomerId;
      let existingCustomer: any = null;

      if (input.customerRefId) {
        // Link to existing customer safely without throwing CastError
        if (mongoose.isValidObjectId(input.customerRefId)) {
          existingCustomer = await Customer.findById(input.customerRefId);
        }
        if (!existingCustomer) {
          existingCustomer = await Customer.findOne({
            $or: [
              { customerId: input.customerRefId },
              { normalizedPhone: normPhone },
              { phone: input.phone.trim() },
            ],
          });
        }
      }

      if (existingCustomer) {
        if (!existingCustomer.customerId) {
          existingCustomer.customerId = cleanCustomerId;
        }
        orderCustomerId = existingCustomer.customerId || cleanCustomerId;
        if (input.updateCustomerMaster) {
          existingCustomer.name = input.customerName;
          existingCustomer.phone = input.phone;
          existingCustomer.normalizedPhone = normPhone;
          if (input.address !== undefined) existingCustomer.address = input.address || null;
          if (input.alternatePhone !== undefined) existingCustomer.alternatePhone = input.alternatePhone || null;
          if (input.notes !== undefined) existingCustomer.notes = input.notes || null;
          await existingCustomer.save();
        }
      } else {
        // Check Customer ID duplicate for new customer (case-insensitive)
        const existingId = await Customer.findOne({
          customerId: { $regex: `^${cleanCustomerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });
        if (existingId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This Customer ID is already used",
          });
        }

        // Check Phone duplicate for new customer
        const duplicate = await Customer.findOne({
          $or: [{ normalizedPhone: normPhone }, { phone: input.phone.trim() }],
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A customer with this mobile number already exists: ${duplicate.name} (${duplicate.phone}). Please select the existing customer.`,
          });
        }

        // Create new customer record
        await Customer.create({
          customerId: cleanCustomerId,
          name: input.customerName,
          phone: input.phone.trim(),
          normalizedPhone: normPhone,
          customerType: input.customerType,
          address: input.address?.trim() || null,
          alternatePhone: input.alternatePhone?.trim() || null,
          notes: input.notes?.trim() || null,
        });
      }

      const branchName = input.branch || (input.branchAddress?.includes("SKT") ? "SKT Dindigul" : "Pandian Nagar");
      const branchAddr =
        input.branchAddress ||
        (branchName.includes("SKT") ? "SKT Dindigul" : "17/B3, 1st street, Pandian Nagar, Dindigul");

      // Auto-enrich items with live Product catalog ID and staffIroningRate
      const dbProducts = await Product.find({ isArchived: { $ne: true } }).lean();
      const enrichedItems = (input.items || []).map((item) => {
        const itemCopy = { ...item };
        let matched: any = null;
        if (itemCopy.productId) {
          matched = dbProducts.find((p: any) => p._id.toString() === String(itemCopy.productId));
        }
        if (!matched && itemCopy.name) {
          const normName = itemCopy.name.toLowerCase().trim();
          matched = dbProducts.find((p: any) => p.name.toLowerCase().trim() === normName);
          if (!matched) {
            matched = dbProducts.find((p: any) => {
              const pNorm = p.name.toLowerCase().trim();
              return pNorm.includes(normName) || normName.includes(pNorm);
            });
          }
        }
        if (matched) {
          itemCopy.productId = matched._id.toString();
          if (itemCopy.staffIroningRate === undefined || itemCopy.staffIroningRate === 0) {
            itemCopy.staffIroningRate = matched.staffIroningRate ?? 10;
          }
        }
        return itemCopy;
      });

      const order = await Order.create({
        _id: id,
        customerId: orderCustomerId,
        customer: input.customerName,
        phone: input.phone.trim(),
        customerType: input.customerType,
        clothesCode: input.storedClothesCode || null,
        serviceType: input.serviceType,
        deliveryType: input.deliveryType,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        totalAmount: input.totalAmount,
        amountPaid: input.amountPaid,
        discount: input.discount,
        items: enrichedItems,
        branch: branchName,
        branchAddress: branchAddr,
      });

      return toApiOrder(order);
    }),

  updateStatus: requirePermission("canUpdateOrderStatus")
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["Received", "Processing", "Ironing", "Ready", "Collected"]),
        deliveryType: z.enum(["Shop Collection", "Home Delivery"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updateData: any = { status: input.status };
      if (input.deliveryType) {
        updateData.deliveryType = input.deliveryType;
      }
      const order = await Order.findByIdAndUpdate(
        input.id,
        updateData,
        { new: true }
      );
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      // If moving backwards before Ready stage (to Received or Processing), void any linked labour expenses
      if (input.status === "Received" || input.status === "Processing") {
        await IroningTask.updateMany(
          { orderId: input.id },
          { status: "Voided" }
        );
        await Expense.updateMany(
          { orderId: input.id, isSystemGenerated: true },
          { isDeleted: true, deletedAt: new Date(), deletedBy: "System (Order Step Rollback)" }
        );
      }

      return toApiOrder(order);
    }),

  bulkUpdateStatus: requirePermission("canUpdateOrderStatus")
    .input(
      z.object({
        ids: z.array(z.string()).min(1, "At least one order ID required"),
        status: z.enum(["Received", "Processing", "Ironing", "Ready", "Collected"]),
      })
    )
    .mutation(async ({ input }) => {
      const result = await Order.updateMany(
        { _id: { $in: input.ids } },
        { $set: { status: input.status } }
      );
      return { count: result.modifiedCount, ids: input.ids };
    }),

  settlePayment: requirePermission("canSettlePayments")
    .input(
      z.object({
        id: z.string(),
        amount: z.number().positive(),
        deliveryType: z.enum(["Shop Collection", "Home Delivery"]).optional(),
        markCollected: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const order = await Order.findById(input.id);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      order.amountPaid = Math.min(order.totalAmount, order.amountPaid + input.amount);
      if (input.deliveryType) {
        order.deliveryType = input.deliveryType;
      }
      if (input.markCollected || order.amountPaid >= order.totalAmount) {
        order.status = "Collected";
      }
      await order.save();
      return toApiOrder(order);
    }),

  bulkMarkAsPaid: requirePermission("canSettlePayments")
    .input(
      z.object({
        ids: z.array(z.string()).min(1, "At least one order ID required"),
      })
    )
    .mutation(async ({ input }) => {
      const orders = await Order.find({ _id: { $in: input.ids } });
      let updatedCount = 0;
      for (const order of orders) {
        if (order.amountPaid < order.totalAmount) {
          order.amountPaid = order.totalAmount;
          await order.save();
          updatedCount++;
        }
      }
      return { count: updatedCount, ids: input.ids };
    }),

  delete: requirePermission("canDeleteOrders")
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const userLabel = ctx.activeRole
        ? String(ctx.activeRole).charAt(0).toUpperCase() + String(ctx.activeRole).slice(1)
        : "Admin";
      
      let order = await Order.findById(input.id);
      if (!order) {
        order = await Order.findOne({ _id: input.id.trim() });
      }
      if (!order) {
        order = await Order.findOne({
          $or: [
            { _id: { $regex: `^${input.id.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
            ...(mongoose.isValidObjectId(input.id.trim()) ? [{ _id: new mongoose.Types.ObjectId(input.id.trim()) as any }] : []),
          ],
        });
      }

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const now = new Date();
      order.isDeleted = true;
      order.deletedAt = now;
      order.deletedBy = userLabel;
      await order.save();

      // Store deleted bill snapshot permanently in backend
      try {
        await DeletedBill.findOneAndUpdate(
          { orderId: order._id },
          {
            orderId: order._id,
            customerId: order.customerId,
            customer: order.customer,
            phone: order.phone,
            customerType: order.customerType,
            clothesCode: order.clothesCode,
            serviceType: order.serviceType,
            status: order.status,
            deliveryType: order.deliveryType,
            dueAt: order.dueAt,
            totalAmount: order.totalAmount,
            amountPaid: order.amountPaid,
            discount: order.discount,
            items: order.items,
            originalCreatedAt: order.createdAt,
            deletedAt: now,
            deletedBy: userLabel,
            reason: input.reason || "User deleted bill",
            action: "moved_to_recycle_bin",
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error("Failed to archive deleted bill snapshot:", err);
      }

      return { success: true };
    }),

  deleteAll: requirePermission("canDeleteOrders").mutation(async () => {
    await Order.deleteMany({});
    await IroningTask.deleteMany({});
    await DeletedBill.deleteMany({});
    return { success: true };
  }),
});
