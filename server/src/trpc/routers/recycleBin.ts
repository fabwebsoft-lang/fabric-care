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
  customerId?: string | null;
  phone?: string;
  customerType?: "Normal" | "Premium";
  clothesCode?: string | null;
  serviceType?: string;
  status?: string;
  deliveryType?: string | null;
  dueAt?: string | null;
  amount?: number;
  amountPaid?: number;
  discount?: number;
  outstandingAmount?: number;
  itemsSummary?: string;
  itemsList?: Array<{ name: string; quantity: number; price: number; clothTags?: string[] }>;
  originalDate?: string;
  deletedAt: string;
  deletedBy: string;
  reason?: string;
  action?: string;
}

async function runAutoCleanup() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Promise.all([
      Order.deleteMany({ isDeleted: true, deletedAt: { $lt: thirtyDaysAgo } }),
      DeletedBill.deleteMany({ deletedAt: { $lt: thirtyDaysAgo } }),
      Customer.deleteMany({ isDeleted: true, deletedAt: { $lt: thirtyDaysAgo } }),
      Expense.deleteMany({ isDeleted: true, deletedAt: { $lt: thirtyDaysAgo } }),
    ]);
  } catch (err) {
    console.error("Recycle bin auto-cleanup error:", err);
  }
}

export const recycleBinRouter = router({
  list: approvedProcedure.query(async (): Promise<RecycleBinItem[]> => {
    // Run automated 30-day cleanup
    await runAutoCleanup();

    const [deletedOrders, deletedBillsArchive, deletedCustomers, deletedExpenses] = await Promise.all([
      Order.find({ isDeleted: true }).sort({ deletedAt: -1, updatedAt: -1 }).lean(),
      DeletedBill.find({ action: { $ne: "restored" } }).sort({ deletedAt: -1 }).lean(),
      Customer.find({ isDeleted: true }).sort({ deletedAt: -1, updatedAt: -1 }).lean(),
      Expense.find({ isDeleted: true }).sort({ deletedAt: -1, updatedAt: -1 }).lean(),
    ]);

    const items: RecycleBinItem[] = [];
    const seenOrderIds = new Set<string>();

    // 1. Map deleted Orders from Order collection
    for (const o of deletedOrders) {
      const orderId = String(o._id);
      seenOrderIds.add(orderId);
      const totalAmount = o.totalAmount || 0;
      const amountPaid = o.amountPaid || 0;
      const outstanding = Math.max(0, totalAmount - amountPaid);
      const orderItems = (o.items || []) as Array<any>;
      const itemsCount = orderItems.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);

      items.push({
        id: orderId,
        recordType: "order",
        title: `Bill ${orderId}`,
        subtitle: `${itemsCount} item${itemsCount === 1 ? "" : "s"} · ${o.serviceType || "Laundry"}`,
        customerName: o.customer,
        customerId: o.customerId || null,
        phone: o.phone,
        customerType: (o.customerType as "Normal" | "Premium") || "Normal",
        clothesCode: o.clothesCode || null,
        serviceType: o.serviceType || "Standard Laundry",
        status: o.status || "Received",
        deliveryType: o.deliveryType || null,
        dueAt: o.dueAt ? new Date(o.dueAt).toISOString() : null,
        amount: totalAmount,
        amountPaid: amountPaid,
        discount: o.discount || 0,
        outstandingAmount: outstanding,
        itemsSummary: orderItems.map((i: any) => `${i.quantity}x ${i.name}`).join(", "),
        itemsList: orderItems.map((i: any) => ({
          name: i.name,
          quantity: i.quantity || 1,
          price: i.price || 0,
          clothTags: i.clothTags || [],
        })),
        originalDate: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
        deletedAt: o.deletedAt
          ? new Date(o.deletedAt).toISOString()
          : o.updatedAt
          ? new Date(o.updatedAt).toISOString()
          : new Date().toISOString(),
        deletedBy: o.deletedBy || "Admin",
      });
    }

    // 2. Map any remaining deleted bills from DeletedBill archive
    for (const db of deletedBillsArchive) {
      const orderId = String(db.orderId);
      if (seenOrderIds.has(orderId)) continue;
      seenOrderIds.add(orderId);

      const totalAmount = db.totalAmount || 0;
      const amountPaid = db.amountPaid || 0;
      const outstanding = Math.max(0, totalAmount - amountPaid);
      const billItems = (db.items || []) as Array<any>;
      const itemsCount = billItems.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);

      items.push({
        id: orderId,
        recordType: "order",
        title: `Bill ${orderId}`,
        subtitle: `${itemsCount} item${itemsCount === 1 ? "" : "s"} · ${db.serviceType || "Laundry"}`,
        customerName: db.customer,
        customerId: db.customerId || null,
        phone: db.phone,
        customerType: (db.customerType as "Normal" | "Premium") || "Normal",
        clothesCode: db.clothesCode || null,
        serviceType: db.serviceType || "Standard Laundry",
        status: db.status || "Received",
        deliveryType: db.deliveryType || null,
        dueAt: db.dueAt ? new Date(db.dueAt).toISOString() : null,
        amount: totalAmount,
        amountPaid: amountPaid,
        discount: db.discount || 0,
        outstandingAmount: outstanding,
        itemsSummary: billItems.map((i: any) => `${i.quantity}x ${i.name}`).join(", "),
        itemsList: billItems.map((i: any) => ({
          name: i.name,
          quantity: i.quantity || 1,
          price: i.price || 0,
          clothTags: i.clothTags || [],
        })),
        originalDate: db.originalCreatedAt ? new Date(db.originalCreatedAt).toISOString() : undefined,
        deletedAt: db.deletedAt ? new Date(db.deletedAt).toISOString() : new Date().toISOString(),
        deletedBy: db.deletedBy || "Admin",
        reason: db.reason || undefined,
        action: db.action || "moved_to_recycle_bin",
      });
    }

    // 3. Map Customers
    for (const c of deletedCustomers) {
      items.push({
        id: c._id.toString(),
        recordType: "customer",
        title: c.name,
        subtitle: c.customerId ? `Customer ID: ${c.customerId}` : "Customer Account",
        customerName: c.name,
        phone: c.phone,
        itemsSummary: c.address || c.notes || undefined,
        originalDate: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
        deletedAt: c.deletedAt
          ? new Date(c.deletedAt).toISOString()
          : c.updatedAt
          ? new Date(c.updatedAt).toISOString()
          : new Date().toISOString(),
        deletedBy: c.deletedBy || "Admin",
      });
    }

    // 4. Map Expenses
    for (const e of deletedExpenses) {
      items.push({
        id: e._id.toString(),
        recordType: "expense",
        title: e.title,
        subtitle: `${e.category} · ${e.paymentMethod}`,
        amount: e.amount,
        itemsSummary: e.notes || undefined,
        originalDate: e.expenseDate ? new Date(e.expenseDate).toISOString() : undefined,
        deletedAt: e.deletedAt
          ? new Date(e.deletedAt).toISOString()
          : e.updatedAt
          ? new Date(e.updatedAt).toISOString()
          : new Date().toISOString(),
        deletedBy: e.deletedBy || "Admin",
      });
    }

    // Sort all by deletedAt descending
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    return items;
  }),

  counts: approvedProcedure.query(async () => {
    const [deletedOrders, deletedBillsArchive, customersCount, expensesCount] = await Promise.all([
      Order.find({ isDeleted: true }, { _id: 1 }).lean(),
      DeletedBill.find({ action: { $ne: "restored" } }, { orderId: 1 }).lean(),
      Customer.countDocuments({ isDeleted: true }),
      Expense.countDocuments({ isDeleted: true }),
    ]);

    const orderIdSet = new Set<string>();
    for (const o of deletedOrders) orderIdSet.add(String(o._id));
    for (const db of deletedBillsArchive) orderIdSet.add(String(db.orderId));

    const ordersCount = orderIdSet.size;

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
        if (!restored) {
          // If the order was only in DeletedBill archive, restore it into Order collection
          const deletedBillDoc = await DeletedBill.findOne({ orderId: input.id });
          if (deletedBillDoc) {
            restored = await Order.create({
              _id: deletedBillDoc.orderId,
              customerId: deletedBillDoc.customerId,
              customer: deletedBillDoc.customer,
              phone: deletedBillDoc.phone,
              customerType: (deletedBillDoc.customerType as "Normal" | "Premium") || "Normal",
              clothesCode: deletedBillDoc.clothesCode || null,
              serviceType: deletedBillDoc.serviceType || "Standard Laundry",
              status: (deletedBillDoc.status as "Received" | "Processing" | "Ironing" | "Ready" | "Collected") || "Received",
              deliveryType: (deletedBillDoc.deliveryType as "Shop Collection" | "Home Delivery" | null) || null,
              dueAt: deletedBillDoc.dueAt,
              totalAmount: deletedBillDoc.totalAmount,
              amountPaid: deletedBillDoc.amountPaid || 0,
              discount: deletedBillDoc.discount || 0,
              items: deletedBillDoc.items || [],
              isDeleted: false,
              deletedAt: null,
              deletedBy: null,
            });
          }
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
        await DeletedBill.deleteMany({ orderId: input.id });
        let deleted = await Order.findByIdAndDelete(input.id);
        if (!deleted) {
          deleted = await Order.findOneAndDelete({ _id: input.id.trim() });
        }
        if (!deleted && mongoose.isValidObjectId(input.id)) {
          deleted = await Order.findByIdAndDelete(new mongoose.Types.ObjectId(input.id));
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
    return records.map((r: any) => ({
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
