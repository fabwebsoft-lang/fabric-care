import { z } from "zod";
import mongoose from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Order } from "../../models/Order.js";
import { Customer } from "../../models/Customer.js";
import { Expense } from "../../models/Expense.js";
import { DeletedBill } from "../../models/DeletedBill.js";

export type RecycleBinItemType = "order" | "customer" | "expense";

export interface RecycleBinItem {
  id: string;
  recordType: RecycleBinItemType;
  title: string;
  subtitle?: string;
  customerName?: string;
  phone?: string;
  amount?: number;
  outstandingAmount?: number;
  itemsSummary?: string;
  originalDate?: string;
  deletedAt: string;
  deletedBy: string;
}

export const recycleBinRouter = router({
  list: approvedProcedure.query(async (): Promise<RecycleBinItem[]> => {
    const [deletedOrders, deletedCustomers, deletedExpenses] = await Promise.all([
      Order.find({ isDeleted: true }).sort({ deletedAt: -1, updatedAt: -1 }),
      Customer.find({ isDeleted: true }).sort({ deletedAt: -1, updatedAt: -1 }),
      Expense.find({ isDeleted: true }).sort({ deletedAt: -1, updatedAt: -1 }),
    ]);

    const items: RecycleBinItem[] = [];

    // Map Orders
    for (const o of deletedOrders) {
      const totalAmount = o.totalAmount || 0;
      const amountPaid = o.amountPaid || 0;
      const outstanding = Math.max(0, totalAmount - amountPaid);
      const itemsCount = (o.items || []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);

      items.push({
        id: o._id as string,
        recordType: "order",
        title: `Bill ${o._id}`,
        subtitle: `${itemsCount} items · ${o.serviceType || "Laundry"}`,
        customerName: o.customer,
        phone: o.phone,
        amount: totalAmount,
        outstandingAmount: outstanding,
        itemsSummary: (o.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(", "),
        originalDate: o.createdAt ? o.createdAt.toISOString() : undefined,
        deletedAt: o.deletedAt ? o.deletedAt.toISOString() : (o.updatedAt ? o.updatedAt.toISOString() : new Date().toISOString()),
        deletedBy: o.deletedBy || "Admin",
      });
    }

    // Map Customers
    for (const c of deletedCustomers) {
      items.push({
        id: c._id.toString(),
        recordType: "customer",
        title: c.name,
        subtitle: c.customerId ? `Customer ID: ${c.customerId}` : "Customer Account",
        customerName: c.name,
        phone: c.phone,
        itemsSummary: c.address || c.notes || undefined,
        originalDate: c.createdAt ? c.createdAt.toISOString() : undefined,
        deletedAt: c.deletedAt ? c.deletedAt.toISOString() : (c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString()),
        deletedBy: c.deletedBy || "Admin",
      });
    }

    // Map Expenses
    for (const e of deletedExpenses) {
      items.push({
        id: e._id.toString(),
        recordType: "expense",
        title: e.title,
        subtitle: `${e.category} · ${e.paymentMethod}`,
        amount: e.amount,
        itemsSummary: e.notes || undefined,
        originalDate: e.expenseDate ? e.expenseDate.toISOString() : undefined,
        deletedAt: e.deletedAt ? e.deletedAt.toISOString() : (e.updatedAt ? e.updatedAt.toISOString() : new Date().toISOString()),
        deletedBy: e.deletedBy || "Admin",
      });
    }

    // Sort all by deletedAt descending
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    return items;
  }),

  counts: approvedProcedure.query(async () => {
    const [ordersCount, customersCount, expensesCount] = await Promise.all([
      Order.countDocuments({ isDeleted: true }),
      Customer.countDocuments({ isDeleted: true }),
      Expense.countDocuments({ isDeleted: true }),
    ]);

    return {
      total: ordersCount + customersCount + expensesCount,
      orders: ordersCount,
      customers: customersCount,
      expenses: expensesCount,
    };
  }),

  restore: requirePermission("canDeleteOrders")
    .input(
      z.object({
        type: z.enum(["order", "customer", "expense"]),
        id: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.type === "order") {
        let restored = await Order.findByIdAndUpdate(
          input.id,
          { isDeleted: false, deletedAt: null, deletedBy: null },
          { new: true }
        );
        if (!restored) {
          restored = await Order.findOneAndUpdate(
            { _id: input.id.trim() },
            { isDeleted: false, deletedAt: null, deletedBy: null },
            { new: true }
          );
        }
        if (!restored) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        // Update DeletedBill record if it exists
        try {
          await DeletedBill.findOneAndUpdate(
            { orderId: restored._id },
            { action: "restored" }
          );
        } catch (e) {
          console.error("Failed to update DeletedBill status on restore:", e);
        }

        return { success: true, message: `Order ${restored._id} restored successfully` };
      }

      if (input.type === "customer") {
        let restored: any = null;
        if (mongoose.isValidObjectId(input.id)) {
          restored = await Customer.findByIdAndUpdate(
            input.id,
            { isDeleted: false, deletedAt: null, deletedBy: null },
            { new: true }
          );
        }
        if (!restored) {
          restored = await Customer.findOneAndUpdate(
            { $or: [{ customerId: input.id }, { phone: input.id }] },
            { isDeleted: false, deletedAt: null, deletedBy: null },
            { new: true }
          );
        }
        if (!restored) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        return { success: true, message: `Customer ${restored.name} restored successfully` };
      }

      if (input.type === "expense") {
        const restored = await Expense.findByIdAndUpdate(
          input.id,
          { isDeleted: false, deletedAt: null, deletedBy: null },
          { new: true }
        );
        if (!restored) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
        return { success: true, message: `Expense ${restored.title} restored successfully` };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid record type" });
    }),

  deleteForever: requirePermission("canDeleteOrders")
    .input(
      z.object({
        type: z.enum(["order", "customer", "expense"]),
        id: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.type === "order") {
        let orderToPermanentlyDelete = await Order.findById(input.id);
        if (!orderToPermanentlyDelete) {
          orderToPermanentlyDelete = await Order.findOne({ _id: input.id.trim() });
        }

        if (orderToPermanentlyDelete) {
          // Ensure DeletedBill has complete archive snapshot before removing from active table
          try {
            await DeletedBill.findOneAndUpdate(
              { orderId: orderToPermanentlyDelete._id },
              {
                orderId: orderToPermanentlyDelete._id,
                customerId: orderToPermanentlyDelete.customerId,
                customer: orderToPermanentlyDelete.customer,
                phone: orderToPermanentlyDelete.phone,
                customerType: orderToPermanentlyDelete.customerType,
                clothesCode: orderToPermanentlyDelete.clothesCode,
                serviceType: orderToPermanentlyDelete.serviceType,
                status: orderToPermanentlyDelete.status,
                deliveryType: orderToPermanentlyDelete.deliveryType,
                dueAt: orderToPermanentlyDelete.dueAt,
                totalAmount: orderToPermanentlyDelete.totalAmount,
                amountPaid: orderToPermanentlyDelete.amountPaid,
                discount: orderToPermanentlyDelete.discount,
                items: orderToPermanentlyDelete.items,
                originalCreatedAt: orderToPermanentlyDelete.createdAt,
                deletedAt: orderToPermanentlyDelete.deletedAt || new Date(),
                deletedBy: orderToPermanentlyDelete.deletedBy || "Admin",
                action: "permanently_deleted",
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.error("Failed to archive DeletedBill on deleteForever:", e);
          }
        }

        let deleted = await Order.findByIdAndDelete(input.id);
        if (!deleted) {
          deleted = await Order.findOneAndDelete({ _id: input.id.trim() });
        }
        if (!deleted && !orderToPermanentlyDelete) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        return { success: true, message: `Order ${input.id} permanently deleted` };
      }

      if (input.type === "customer") {
        let deleted: any = null;
        if (mongoose.isValidObjectId(input.id)) {
          deleted = await Customer.findByIdAndDelete(input.id);
        }
        if (!deleted) {
          deleted = await Customer.findOneAndDelete({
            $or: [{ customerId: input.id }, { phone: input.id }],
          });
        }
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        return { success: true, message: `Customer ${deleted.name} permanently deleted` };
      }

      if (input.type === "expense") {
        const deleted = await Expense.findByIdAndDelete(input.id);
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
        return { success: true, message: `Expense ${deleted.title} permanently deleted` };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid record type" });
    }),

  emptyBin: requirePermission("canDeleteOrders")
    .input(
      z
        .object({
          type: z.enum(["all", "order", "customer", "expense"]).default("all"),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const type = input?.type || "all";

      let ordersDeleted = 0;
      let customersDeleted = 0;
      let expensesDeleted = 0;

      if (type === "all" || type === "order") {
        const deletedOrders = await Order.find({ isDeleted: true });
        for (const o of deletedOrders) {
          try {
            await DeletedBill.findOneAndUpdate(
              { orderId: o._id },
              {
                orderId: o._id,
                customerId: o.customerId,
                customer: o.customer,
                phone: o.phone,
                customerType: o.customerType,
                clothesCode: o.clothesCode,
                serviceType: o.serviceType,
                status: o.status,
                deliveryType: o.deliveryType,
                dueAt: o.dueAt,
                totalAmount: o.totalAmount,
                amountPaid: o.amountPaid,
                discount: o.discount,
                items: o.items,
                originalCreatedAt: o.createdAt,
                deletedAt: o.deletedAt || new Date(),
                deletedBy: o.deletedBy || "Admin",
                action: "permanently_deleted",
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.error("Failed to archive DeletedBill on emptyBin:", e);
          }
        }
        const res = await Order.deleteMany({ isDeleted: true });
        ordersDeleted = res.deletedCount || 0;
      }

      if (type === "all" || type === "customer") {
        const res = await Customer.deleteMany({ isDeleted: true });
        customersDeleted = res.deletedCount || 0;
      }

      if (type === "all" || type === "expense") {
        const res = await Expense.deleteMany({ isDeleted: true });
        expensesDeleted = res.deletedCount || 0;
      }

      const totalDeleted = ordersDeleted + customersDeleted + expensesDeleted;
      return {
        success: true,
        totalDeleted,
        ordersDeleted,
        customersDeleted,
        expensesDeleted,
        message: `Permanently removed ${totalDeleted} item(s) from Recycle Bin`,
      };
    }),

  archivedBills: approvedProcedure.query(async () => {
    const records = await DeletedBill.find().sort({ deletedAt: -1 }).lean();
    return records.map((r) => ({
      orderId: r.orderId,
      customerId: r.customerId,
      customer: r.customer,
      phone: r.phone,
      serviceType: r.serviceType,
      totalAmount: r.totalAmount,
      amountPaid: r.amountPaid,
      discount: r.discount,
      items: r.items,
      deletedAt: r.deletedAt?.toISOString(),
      deletedBy: r.deletedBy,
      reason: r.reason,
      action: r.action,
    }));
  }),
});
