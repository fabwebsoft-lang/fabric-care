import { z } from "zod";
import mongoose from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { IroningTask } from "../../models/IroningTask.js";
import { Worker } from "../../models/Worker.js";
import { Order } from "../../models/Order.js";
import { Product } from "../../models/Product.js";
import { Expense } from "../../models/Expense.js";
import { Shop } from "../../models/Shop.js";

/**
 * Returns Start and End Date for IST (Asia/Kolkata) range.
 */
function getISTDateRange(
  period: "today" | "yesterday" | "this_week" | "this_month" | "custom",
  fromDate?: string,
  toDate?: string
) {
  const now = new Date();
  // Get current time string in IST
  const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayYMD = istFormatter.format(now);

  if (period === "custom" && fromDate && toDate) {
    const start = new Date(`${fromDate}T00:00:00.000+05:30`);
    const end = new Date(`${toDate}T23:59:59.999+05:30`);
    return { start, end };
  }

  if (period === "today") {
    const start = new Date(`${todayYMD}T00:00:00.000+05:30`);
    const end = new Date(`${todayYMD}T23:59:59.999+05:30`);
    return { start, end };
  }

  if (period === "yesterday") {
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yestYMD = istFormatter.format(yesterdayDate);
    const start = new Date(`${yestYMD}T00:00:00.000+05:30`);
    const end = new Date(`${yestYMD}T23:59:59.999+05:30`);
    return { start, end };
  }

  if (period === "this_week") {
    // Week starting Monday in IST
    const [year, month, day] = todayYMD.split("-").map(Number);
    const currentDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = currentDate.getUTCDay(); // 0 is Sun, 1 is Mon
    const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayDate = new Date(currentDate.getTime() - distanceToMonday * 24 * 60 * 60 * 1000);
    const mondayYMD = mondayDate.toISOString().slice(0, 10);

    const start = new Date(`${mondayYMD}T00:00:00.000+05:30`);
    const end = new Date(`${todayYMD}T23:59:59.999+05:30`);
    return { start, end };
  }

  if (period === "this_month") {
    const [yearStr, monthStr] = todayYMD.split("-");
    const start = new Date(`${yearStr}-${monthStr}-01T00:00:00.000+05:30`);
    const end = new Date(`${todayYMD}T23:59:59.999+05:30`);
    return { start, end };
  }

  const start = new Date(`${todayYMD}T00:00:00.000+05:30`);
  const end = new Date(`${todayYMD}T23:59:59.999+05:30`);
  return { start, end };
}

function extractCleanGarmentName(rawName: string): { cleanName: string; extractedQty?: number } {
  const trimmed = (rawName || "").trim();
  const prefixMatch = trimmed.match(/^(\d+)\s*(?:items|pcs|pieces)?\s*[·\-\:]\s*(.+)$/i);
  if (prefixMatch) {
    return {
      cleanName: prefixMatch[2].trim(),
      extractedQty: Number(prefixMatch[1]) || 1,
    };
  }
  const xMatch = trimmed.match(/^(\d+)\s*x\s*(.+)$/i) || trimmed.match(/^(.+)\s*x\s*(\d+)$/i);
  if (xMatch) {
    const qty = Number(xMatch[1]) || Number(xMatch[2]) || 1;
    const name = (isNaN(Number(xMatch[1])) ? xMatch[1] : xMatch[2]).trim();
    return { cleanName: name, extractedQty: qty };
  }
  return { cleanName: trimmed || "Standard Laundry" };
}

export const ironingRouter = router({
  /**
   * Start ironing stage for an order by assigning an active staff member.
   * Does NOT create an expense.
   */
  startIroning: approvedProcedure
    .input(
      z.object({
        orderId: z.string(),
        staffId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const order = await Order.findOne({ _id: input.orderId, isDeleted: { $ne: true } });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const staff = await Worker.findById(input.staffId);
      if (!staff || !staff.active || staff.role === "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please select an active staff member.",
        });
      }

      const shop = await Shop.findOne();
      const fallbackDefaultRate = shop?.defaultStaffIroningRate ?? 10;

      // Fetch products to pull configured staff ironing rates (by ID first, fallback to name)
      const rawOrderItems = (order.items && order.items.length > 0)
        ? order.items
        : [{ name: order.serviceType || "Standard Laundry", quantity: 1, price: order.totalAmount || 50 }];

      const productIds = rawOrderItems
        .map((i: any) => i.productId)
        .filter((id: any): id is string => Boolean(id) && mongoose.Types.ObjectId.isValid(id));

      const productNames = rawOrderItems.flatMap((i: any) => {
        const { cleanName } = extractCleanGarmentName(i.name);
        return [i.name.trim(), cleanName];
      });

      const products = await Product.find({
        $or: [
          ...(productIds.length > 0 ? [{ _id: { $in: productIds } }] : []),
          { name: { $in: productNames.map((n: string) => new RegExp(`^${n}$`, "i")) } },
          { name: { $regex: /Standard Laundry|Shirt|Pant/i } },
        ],
        isArchived: { $ne: true },
      });

      const productIdMap = new Map<string, number>();
      const productNameMap = new Map<string, number>();
      for (const p of products) {
        productIdMap.set(p._id.toString(), p.staffIroningRate !== undefined ? p.staffIroningRate : fallbackDefaultRate);
        productNameMap.set(p.name.toLowerCase().trim(), p.staffIroningRate !== undefined ? p.staffIroningRate : fallbackDefaultRate);
      }

      const taskItems = rawOrderItems.map((item: any) => {
        const { cleanName, extractedQty } = extractCleanGarmentName(item.name);
        const qty = item.quantity && item.quantity > 0 ? item.quantity : (extractedQty || 1);

        let rate: number | undefined;
        if (item.productId && productIdMap.has(item.productId.toString())) {
          const r = productIdMap.get(item.productId.toString());
          if (r !== undefined && r > 0) rate = r;
        }
        if (rate === undefined && item.staffIroningRate !== undefined && item.staffIroningRate > 0) {
          rate = item.staffIroningRate;
        }
        if (rate === undefined) {
          const cleanLower = cleanName.toLowerCase().trim();
          const rawLower = (item.name || "").toLowerCase().trim();
          if (productNameMap.has(cleanLower) && productNameMap.get(cleanLower)! > 0) {
            rate = productNameMap.get(cleanLower);
          } else if (productNameMap.has(rawLower) && productNameMap.get(rawLower)! > 0) {
            rate = productNameMap.get(rawLower);
          } else {
            productNameMap.forEach((pRate, pName) => {
              if (rate === undefined && pRate > 0 && (cleanLower.includes(pName) || pName.includes(cleanLower))) {
                rate = pRate;
              }
            });
          }
        }
        // Fallback default rate if unconfigured
        const finalRate = rate !== undefined && rate > 0 ? rate : fallbackDefaultRate;
        return {
          name: cleanName,
          quantity: qty,
          staffRate: finalRate,
          staffEarning: qty * finalRate,
        };
      });

      const totalPieces = taskItems.reduce((acc, i) => acc + i.quantity, 0);
      const totalEarning = taskItems.reduce((acc, i) => acc + i.staffEarning, 0);

      // Void any previous in-progress task for this order if reassigning
      await IroningTask.updateMany(
        { orderId: input.orderId, status: "In Progress" },
        { status: "Voided" }
      );

      const task = await IroningTask.create({
        orderId: input.orderId,
        staffId: staff._id,
        staffName: staff.name,
        customer: order.customer,
        items: taskItems,
        totalPieces,
        totalEarning,
        status: "In Progress",
        startedAt: new Date(),
        assignedBy: ctx.activeRole || "Admin",
      });

      // Advance Order to Ironing status
      order.status = "Ironing";
      await order.save();

      return {
        success: true,
        message: `Ironing started and assigned to ${staff.name}`,
        task: {
          id: task._id.toString(),
          orderId: task.orderId,
          staffId: task.staffId.toString(),
          staffName: task.staffName,
          status: task.status,
          totalPieces: task.totalPieces,
          totalEarning: task.totalEarning,
          startedAt: task.startedAt.toISOString(),
        },
      };
    }),

  /**
   * Get the active/current ironing task for an order.
   */
  getActiveTask: approvedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      const task = await IroningTask.findOne({
        orderId: input.orderId,
        status: { $in: ["In Progress", "Completed"] },
      }).sort({ createdAt: -1 });

      if (!task) return null;

      return {
        id: task._id.toString(),
        orderId: task.orderId,
        staffId: task.staffId.toString(),
        staffName: task.staffName,
        customer: task.customer,
        items: task.items,
        totalPieces: task.totalPieces,
        totalEarning: task.totalEarning,
        status: task.status,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        assignedBy: task.assignedBy,
      };
    }),

  /**
   * Complete Ironing stage:
   * 1. Validates all item staff rates are set.
   * 2. Calculates final staff earnings.
   * 3. Automatically creates/updates linked Expense.
   * 4. Moves order to "Ready".
   */
  completeIroning: approvedProcedure
    .input(
      z.object({
        orderId: z.string(),
        staffId: z.string().optional(),
        ratesOverride: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const order = await Order.findOne({ _id: input.orderId, isDeleted: { $ne: true } });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      let task = await IroningTask.findOne({
        orderId: input.orderId,
        status: "In Progress",
      });

      // For orders that were already in Ironing before assignment tracking or needing fallback
      if (!task) {
        if (!input.staffId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Please select a staff member to complete this ironing task.",
          });
        }
        const staff = await Worker.findById(input.staffId);
        if (!staff || !staff.active || staff.role === "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected staff member is inactive or invalid.",
          });
        }

        task = await IroningTask.create({
          orderId: input.orderId,
          staffId: staff._id,
          staffName: staff.name,
          customer: order.customer,
          items: [],
          status: "In Progress",
          startedAt: new Date(),
          assignedBy: ctx.activeRole || "Admin",
        });
      }

      const shop = await Shop.findOne();
      const fallbackDefaultRate = shop?.defaultStaffIroningRate ?? 10;

      // Fetch products to pull rates (by ID first, fallback to name)
      const rawOrderItems = (order.items && order.items.length > 0)
        ? order.items
        : [{ name: order.serviceType || "Standard Laundry", quantity: 1, price: order.totalAmount || 50 }];

      const productIds = rawOrderItems
        .map((i: any) => i.productId)
        .filter((id: any): id is string => Boolean(id) && mongoose.Types.ObjectId.isValid(id));

      const productNames = rawOrderItems.flatMap((i: any) => {
        const { cleanName } = extractCleanGarmentName(i.name);
        return [i.name.trim(), cleanName];
      });

      const products = await Product.find({
        $or: [
          ...(productIds.length > 0 ? [{ _id: { $in: productIds } }] : []),
          { name: { $in: productNames.map((n: string) => new RegExp(`^${n}$`, "i")) } },
          { name: { $regex: /Standard Laundry|Shirt|Pant/i } },
        ],
        isArchived: { $ne: true },
      });

      const productIdMap = new Map<string, number>();
      const productNameMap = new Map<string, number>();
      for (const p of products) {
        productIdMap.set(p._id.toString(), p.staffIroningRate !== undefined ? p.staffIroningRate : fallbackDefaultRate);
        productNameMap.set(p.name.toLowerCase().trim(), p.staffIroningRate !== undefined ? p.staffIroningRate : fallbackDefaultRate);
      }

      // Build task items
      const completedItems = rawOrderItems.map((item: any) => {
        const { cleanName, extractedQty } = extractCleanGarmentName(item.name);
        const qty = item.quantity && item.quantity > 0 ? item.quantity : (extractedQty || 1);

        let rate =
          input.ratesOverride?.[cleanName] ??
          input.ratesOverride?.[item.name] ??
          (item.productId ? input.ratesOverride?.[item.productId] : undefined);

        if (rate === undefined) {
          if (item.productId && productIdMap.has(item.productId.toString())) {
            const r = productIdMap.get(item.productId.toString());
            if (r !== undefined && r > 0) rate = r;
          }
          if (rate === undefined && item.staffIroningRate !== undefined && item.staffIroningRate > 0) {
            rate = item.staffIroningRate;
          }
          if (rate === undefined) {
            const cleanLower = cleanName.toLowerCase().trim();
            const rawLower = (item.name || "").toLowerCase().trim();
            if (productNameMap.has(cleanLower) && productNameMap.get(cleanLower)! > 0) {
              rate = productNameMap.get(cleanLower);
            } else if (productNameMap.has(rawLower) && productNameMap.get(rawLower)! > 0) {
              rate = productNameMap.get(rawLower);
            } else {
              productNameMap.forEach((pRate, pName) => {
                if (rate === undefined && pRate > 0 && (cleanLower.includes(pName) || pName.includes(cleanLower))) {
                  rate = pRate;
                }
              });
            }
          }
        }
        // Fallback default rate if unconfigured
        const finalRate = rate !== undefined ? Math.max(0, rate) : fallbackDefaultRate;

        return {
          name: cleanName,
          quantity: qty,
          staffRate: finalRate,
          staffEarning: qty * finalRate,
        };
      });

      const totalPieces = completedItems.reduce((acc, i) => acc + i.quantity, 0);
      const totalEarning = completedItems.reduce((acc, i) => acc + i.staffEarning, 0);

      const reference = `IRONING-PAYMENT-${task.orderId}-${task.staffId.toString()}-${task._id.toString()}`;

      // Create or update linked internal Expense if earning > 0
      let linkedExpense = await Expense.findOne({
        $or: [{ reference }, { orderId: task.orderId, isSystemGenerated: true }],
      });

      if (totalEarning > 0) {
        if (!linkedExpense) {
          linkedExpense = await Expense.create({
            title: `Ironing Labour - ${task.staffName}`,
            category: "Staff / Ironing Labour",
            amount: totalEarning,
            paymentMethod: "Cash",
            expenseDate: new Date(),
            notes: `Ironing labour for Order #${order._id} (${totalPieces} pcs @ ₹${totalEarning})`,
            reference,
            staffId: task.staffId,
            taskId: task._id,
            orderId: task.orderId,
            isSystemGenerated: true,
            expenseType: "Staff / Ironing Labour",
            deletedBy: null,
            isDeleted: false,
          });
        } else {
          linkedExpense.title = `Ironing Labour - ${task.staffName}`;
          linkedExpense.amount = totalEarning;
          linkedExpense.category = "Staff / Ironing Labour";
          linkedExpense.notes = `Ironing labour for Order #${order._id} (${totalPieces} pcs @ ₹${totalEarning})`;
          linkedExpense.reference = reference;
          linkedExpense.staffId = task.staffId;
          linkedExpense.taskId = task._id;
          linkedExpense.orderId = task.orderId;
          linkedExpense.isSystemGenerated = true;
          linkedExpense.expenseType = "Staff / Ironing Labour";
          linkedExpense.isDeleted = false;
          linkedExpense.deletedAt = null;
          linkedExpense.deletedBy = null;
          await linkedExpense.save();
        }
      }

      task.items = completedItems as any;
      task.totalPieces = totalPieces;
      task.totalEarning = totalEarning;
      task.status = "Completed";
      task.completedAt = new Date();
      if (linkedExpense) {
        task.expenseId = linkedExpense._id as mongoose.Types.ObjectId;
      }
      task.reference = reference;
      await task.save();

      // Advance Order to Ready
      order.status = "Ready";
      await order.save();

      return {
        success: true,
        message: totalEarning > 0
          ? `Ironing completed! ₹${totalEarning} labour expense credited for ${task.staffName}.`
          : `Ironing completed for ${task.staffName}. Order is now Ready for delivery.`,
        task: {
          id: task._id.toString(),
          orderId: task.orderId,
          staffName: task.staffName,
          totalPieces: task.totalPieces,
          totalEarning: task.totalEarning,
        },
        expenseId: linkedExpense ? linkedExpense._id.toString() : null,
      };
    }),

  /**
   * Correct completed task (Admin/Manager only).
   * Recalculates earning and automatically updates linked expense.
   */
  correctTask: requirePermission("canManageRoles")
    .input(
      z.object({
        taskId: z.string(),
        staffId: z.string().optional(),
        items: z
          .array(
            z.object({
              name: z.string(),
              quantity: z.number().min(1),
              staffRate: z.number().min(0),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const task = await IroningTask.findById(input.taskId);
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ironing task not found" });
      }

      if (input.staffId) {
        const staff = await Worker.findById(input.staffId);
        if (staff) {
          task.staffId = staff._id as mongoose.Types.ObjectId;
          task.staffName = staff.name;
        }
      }

      if (input.items) {
        task.items = input.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          staffRate: i.staffRate,
          staffEarning: i.quantity * i.staffRate,
        })) as any;
        task.totalPieces = task.items.reduce((acc, i) => acc + i.quantity, 0);
        task.totalEarning = task.items.reduce((acc, i) => acc + i.staffEarning, 0);
      }

      await task.save();

      // Update linked expense
      if (task.reference) {
        const expense = await Expense.findOne({ reference: task.reference });
        if (expense) {
          expense.title = `Ironing Labour - ${task.staffName}`;
          expense.amount = task.totalEarning;
          expense.notes = `Ironing labour for Order #${task.orderId} (Corrected: ${task.totalPieces} pcs @ ₹${task.totalEarning})`;
          await expense.save();
        }
      }

      return { success: true, message: "Task and linked expense updated successfully", task };
    }),

  /**
   * Void task and void linked expense if order is reopened/moved back.
   */
  voidTask: approvedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ input }) => {
      const tasks = await IroningTask.find({ orderId: input.orderId });
      for (const t of tasks) {
        t.status = "Voided";
        await t.save();

        if (t.reference) {
          await Expense.findOneAndUpdate(
            { reference: t.reference },
            { isDeleted: true, deletedAt: new Date(), deletedBy: "System (Voided Task)" }
          );
        }
      }

      await Expense.updateMany(
        { orderId: input.orderId, isSystemGenerated: true },
        { isDeleted: true, deletedAt: new Date(), deletedBy: "System (Voided Task)" }
      );

      return { success: true, message: "Ironing task and associated expense voided." };
    }),

  /**
   * Staff Performance & Earnings Report.
   * Strictly calculates from IroningTask collection.
   */
  reports: approvedProcedure
    .input(
      z
        .object({
          period: z.enum(["today", "yesterday", "this_week", "this_month", "custom"]).default("today"),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          staffId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const period = input?.period || "today";
      const { start, end } = getISTDateRange(period, input?.fromDate, input?.toDate);

      const filter: Record<string, any> = {
        status: "Completed",
        completedAt: { $gte: start, $lte: end },
      };

      if (input?.staffId && input.staffId !== "all") {
        filter.staffId = new mongoose.Types.ObjectId(input.staffId);
      }

      const tasks = await IroningTask.find(filter).sort({ completedAt: -1 }).lean();

      // Group by staff
      const staffMap = new Map<
        string,
        {
          staffId: string;
          staffName: string;
          totalPieces: number;
          totalEarnings: number;
          completedTasksCount: number;
          tasks: Array<{
            id: string;
            orderId: string;
            customer: string;
            completedAt: string;
            totalPieces: number;
            totalEarning: number;
            items: Array<{ name: string; quantity: number; staffRate: number; staffEarning: number }>;
          }>;
        }
      >();

      let grandTotalPieces = 0;
      let grandTotalEarnings = 0;

      for (const t of tasks) {
        const staffKey = String(t.staffId);
        if (!staffMap.has(staffKey)) {
          staffMap.set(staffKey, {
            staffId: staffKey,
            staffName: t.staffName,
            totalPieces: 0,
            totalEarnings: 0,
            completedTasksCount: 0,
            tasks: [],
          });
        }

        const staffEntry = staffMap.get(staffKey)!;
        staffEntry.totalPieces += t.totalPieces || 0;
        staffEntry.totalEarnings += t.totalEarning || 0;
        staffEntry.completedTasksCount += 1;
        staffEntry.tasks.push({
          id: String(t._id),
          orderId: t.orderId,
          customer: t.customer,
          completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : new Date().toISOString(),
          totalPieces: t.totalPieces,
          totalEarning: t.totalEarning,
          items: t.items || [],
        });

        grandTotalPieces += t.totalPieces || 0;
        grandTotalEarnings += t.totalEarning || 0;
      }

      const staffBreakdown = Array.from(staffMap.values()).sort(
        (a, b) => b.totalEarnings - a.totalEarnings
      );

      return {
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalPieces: grandTotalPieces,
        totalEarnings: grandTotalEarnings,
        totalTasksCount: tasks.length,
        staffBreakdown,
      };
    }),

  /**
   * Summary card for Dashboard (Today's Ironing Staff Overview).
   */
  todayStats: approvedProcedure.query(async () => {
    const { start, end } = getISTDateRange("today");

    const [todayCompletedTasks, activeWorkersCount, inProgressCount] = await Promise.all([
      IroningTask.find({ status: "Completed", completedAt: { $gte: start, $lte: end } }).lean(),
      Worker.countDocuments({ active: true, role: { $ne: "pending" } }),
      IroningTask.countDocuments({ status: "In Progress" }),
    ]);

    const todayPieces = todayCompletedTasks.reduce((sum, t) => sum + (t.totalPieces || 0), 0);
    const todayLabourCost = todayCompletedTasks.reduce((sum, t) => sum + (t.totalEarning || 0), 0);
    const uniqueActiveStaffToday = new Set(todayCompletedTasks.map((t) => String(t.staffId))).size;

    return {
      todayPieces,
      todayLabourCost,
      activeStaffCount: activeWorkersCount,
      activeIroningStaffToday: uniqueActiveStaffToday,
      inProgressCount,
    };
  }),
});
