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
  let trimmed = (rawName || "").trim();
  let extractedQty: number | undefined = undefined;

  // Handle "5 items · Standard Laundry" or "5 pcs - Shirt" or "5 · Standard Laundry"
  const prefixMatch = trimmed.match(/^(\d+)\s*(?:items|pcs|pieces|garments|cloths|clothes)?\s*[·\.\:\-\*x\s]\s*(.+)$/i);
  if (prefixMatch) {
    extractedQty = Number(prefixMatch[1]) || 1;
    trimmed = prefixMatch[2].trim();
  }

  // Handle "Standard Laundry · 5 items" or "Shirt x 5"
  const suffixMatch = trimmed.match(/^(.+?)\s*[·\.\:\-\*x\s]\s*(\d+)\s*(?:items|pcs|pieces)?$/i);
  if (suffixMatch) {
    extractedQty = Number(suffixMatch[2]) || 1;
    trimmed = suffixMatch[1].trim();
  }

  // Remove any leftover prefix
  trimmed = trimmed.replace(/^\d+\s*(?:items|pcs|pieces)?\s*[·\.\:\-\*]\s*/i, "").trim();

  return { cleanName: trimmed || "Standard Laundry", extractedQty };
}

export const ironingRouter = router({
  /**
   * Start washing stage for an order by assigning an active staff member.
   * Does NOT create an expense until completed.
   */
  startWashing: approvedProcedure
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
      const fallbackDefaultRate = shop?.defaultStaffWashRate ?? 15;

      // Fetch all active products to resolve live wash rates
      const products = await Product.find({ isArchived: { $ne: true } });

      const rawOrderItems = (order.items && order.items.length > 0)
        ? order.items
        : [{ name: order.serviceType || "Standard Laundry", quantity: 1, price: order.totalAmount || 50 }];

      const productIdMap = new Map<string, number>();
      const productNameMap = new Map<string, number>();
      for (const p of products) {
        if (p.staffWashRate !== undefined && p.staffWashRate !== null) {
          productIdMap.set(p._id.toString(), p.staffWashRate);
          productNameMap.set(p.name.toLowerCase().trim(), p.staffWashRate);
        }
      }

      const taskItems = rawOrderItems.map((item: any) => {
        const { cleanName, extractedQty } = extractCleanGarmentName(item.name);
        const qty = item.quantity && item.quantity > 0 ? item.quantity : (extractedQty || 1);

        let rate: number | undefined;
        if (item.productId && productIdMap.has(item.productId.toString())) {
          const r = productIdMap.get(item.productId.toString());
          if (r !== undefined && r !== null) rate = r;
        }
        if (rate === undefined) {
          const cleanLower = cleanName.toLowerCase().trim();
          const rawLower = (item.name || "").toLowerCase().trim();
          if (productNameMap.has(cleanLower)) {
            rate = productNameMap.get(cleanLower);
          } else if (productNameMap.has(rawLower)) {
            rate = productNameMap.get(rawLower);
          } else {
            productNameMap.forEach((pRate, pName) => {
              if (rate === undefined && (cleanLower.includes(pName) || pName.includes(cleanLower))) {
                rate = pRate;
              }
            });
          }
        }
        if (rate === undefined && productNameMap.has("standard laundry")) {
          rate = productNameMap.get("standard laundry");
        }
        if (rate === undefined && item.staffWashRate !== undefined && item.staffWashRate !== null && item.staffWashRate > 0) {
          rate = item.staffWashRate;
        }
        // Fallback default rate if unconfigured
        const finalRate = rate !== undefined && rate !== null ? Math.max(0, rate) : fallbackDefaultRate;
        return {
          name: cleanName,
          quantity: qty,
          staffRate: finalRate,
          staffEarning: qty * finalRate,
        };
      });

      const totalPieces = taskItems.reduce((acc, i) => acc + i.quantity, 0);
      const totalEarning = taskItems.reduce((acc, i) => acc + i.staffEarning, 0);

      let task = await IroningTask.findOne({
        orderId: input.orderId,
        taskType: "washing",
      }).sort({ createdAt: -1 });

      if (!task) {
        task = await IroningTask.create({
          taskType: "washing",
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
      } else {
        task.staffId = staff._id as mongoose.Types.ObjectId;
        task.staffName = staff.name;
        task.customer = order.customer;
        task.items = taskItems as any;
        task.totalPieces = totalPieces;
        task.totalEarning = totalEarning;
        task.status = "In Progress";
        task.startedAt = new Date();
        task.completedAt = null;
        task.assignedBy = ctx.activeRole || "Admin";
        await task.save();
      }

      // Clean up any extra duplicate washing tasks for this order
      await IroningTask.deleteMany({
        _id: { $ne: task._id },
        orderId: input.orderId,
        taskType: "washing",
      });

      // Advance Order to Processing status
      order.status = "Processing";
      await order.save();

      return {
        success: true,
        message: `Washing started and assigned to ${staff.name}`,
        task: {
          id: task._id.toString(),
          taskType: task.taskType || "washing",
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
   * Get active/current washing task for an order.
   */
  getActiveWashingTask: approvedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      const task = await IroningTask.findOne({
        orderId: input.orderId,
        taskType: "washing",
        status: { $in: ["In Progress", "Completed"] },
      }).sort({ createdAt: -1 });

      if (!task) return null;

      let displayItems = (task.items || []).map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        staffRate: i.staffRate,
        staffEarning: i.staffEarning,
      }));
      let displayTotalPieces = task.totalPieces;
      let displayTotalEarning = task.totalEarning;

      if (task.status === "In Progress") {
        const products = await Product.find({ isArchived: { $ne: true } });
        const shop = await Shop.findOne();
        const fallbackRate = shop?.defaultStaffWashRate ?? 15;

        const nameMap = new Map<string, number>();
        for (const p of products) {
          if (p.staffWashRate !== undefined && p.staffWashRate !== null) {
            nameMap.set(p.name.toLowerCase().trim(), p.staffWashRate);
          }
        }

        displayItems = (task.items || []).map((i: any) => {
          const { cleanName, extractedQty } = extractCleanGarmentName(i.name);
          const qty = i.quantity && i.quantity > 0 ? i.quantity : (extractedQty || 1);
          const cleanLower = cleanName.toLowerCase().trim();

          let r: number | undefined;
          if (nameMap.has(cleanLower)) {
            r = nameMap.get(cleanLower);
          } else if (nameMap.has("standard laundry")) {
            r = nameMap.get("standard laundry");
          } else if (i.staffRate !== undefined && i.staffRate !== null && i.staffRate > 0) {
            r = i.staffRate;
          } else {
            r = fallbackRate;
          }

          const resolvedRate = r !== undefined && r !== null ? Math.max(0, r) : fallbackRate;
          return {
            name: cleanName,
            quantity: qty,
            staffRate: resolvedRate,
            staffEarning: qty * resolvedRate,
          };
        });

        displayTotalPieces = displayItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
        displayTotalEarning = displayItems.reduce((acc: number, item: any) => acc + (item.staffEarning || 0), 0);
      }

      return {
        id: task._id.toString(),
        taskType: task.taskType || "washing",
        orderId: task.orderId,
        staffId: task.staffId.toString(),
        staffName: task.staffName,
        customer: task.customer,
        items: displayItems,
        totalPieces: displayTotalPieces,
        totalEarning: displayTotalEarning,
        status: task.status,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        assignedBy: task.assignedBy,
      };
    }),

  /**
   * Complete Washing stage:
   * 1. Validates staff rates.
   * 2. Calculates final staff labour earnings.
   * 3. Creates/updates linked internal Expense under "Staff / Washing Labour".
   * 4. Moves order to "Ironing".
   */
  completeWashing: approvedProcedure
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

      // Check if any washing task already exists for this order (whether In Progress or Completed)
      let task = await IroningTask.findOne({
        orderId: input.orderId,
        taskType: "washing",
      }).sort({ createdAt: -1 });

      if (!task) {
        if (!input.staffId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Please select a staff member to complete this washing task.",
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
          taskType: "washing",
          orderId: input.orderId,
          staffId: staff._id,
          staffName: staff.name,
          customer: order.customer,
          items: [],
          status: "In Progress",
          startedAt: new Date(),
          assignedBy: ctx.activeRole || "Admin",
        });
      } else {
        // Update staff if provided and valid
        if (input.staffId) {
          const staff = await Worker.findById(input.staffId);
          if (staff && staff.active && staff.role !== "pending") {
            task.staffId = staff._id as mongoose.Types.ObjectId;
            task.staffName = staff.name;
          }
        }
        task.customer = order.customer;
      }

      // Clean up any extra duplicate washing tasks for this order
      await IroningTask.deleteMany({
        _id: { $ne: task._id },
        orderId: input.orderId,
        taskType: "washing",
      });

      const shop = await Shop.findOne();
      const fallbackDefaultRate = shop?.defaultStaffWashRate ?? 15;

      const products = await Product.find({ isArchived: { $ne: true } });

      const rawOrderItems = (order.items && order.items.length > 0)
        ? order.items
        : [{ name: order.serviceType || "Standard Laundry", quantity: 1, price: order.totalAmount || 50 }];

      const productIdMap = new Map<string, number>();
      const productNameMap = new Map<string, number>();
      for (const p of products) {
        if (p.staffWashRate !== undefined && p.staffWashRate !== null) {
          productIdMap.set(p._id.toString(), p.staffWashRate);
          productNameMap.set(p.name.toLowerCase().trim(), p.staffWashRate);
        }
      }

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
            if (r !== undefined && r !== null) rate = r;
          }
          if (rate === undefined) {
            const cleanLower = cleanName.toLowerCase().trim();
            const rawLower = (item.name || "").toLowerCase().trim();
            if (productNameMap.has(cleanLower)) {
              rate = productNameMap.get(cleanLower);
            } else if (productNameMap.has(rawLower)) {
              rate = productNameMap.get(rawLower);
            } else {
              productNameMap.forEach((pRate, pName) => {
                if (rate === undefined && (cleanLower.includes(pName) || pName.includes(cleanLower))) {
                  rate = pRate;
                }
              });
            }
          }
          if (rate === undefined && productNameMap.has("standard laundry")) {
            rate = productNameMap.get("standard laundry");
          }
          if (rate === undefined && item.staffWashRate !== undefined && item.staffWashRate !== null && item.staffWashRate > 0) {
            rate = item.staffWashRate;
          }
        }
        const finalRate = rate !== undefined && rate !== null ? Math.max(0, rate) : fallbackDefaultRate;

        return {
          name: cleanName,
          quantity: qty,
          staffRate: finalRate,
          staffEarning: qty * finalRate,
        };
      });

      const totalPieces = completedItems.reduce((acc, i) => acc + i.quantity, 0);
      const totalEarning = completedItems.reduce((acc, i) => acc + i.staffEarning, 0);

      const reference = `WASHING-PAYMENT-${task.orderId}-${task.staffId.toString()}-${task._id.toString()}`;

      // Create or update linked internal Expense under "Staff / Washing Labour"
      let linkedExpense = await Expense.findOne({
        $or: [
          ...(task.expenseId ? [{ _id: task.expenseId }] : []),
          { reference },
          { taskId: task._id },
          { orderId: task.orderId, category: "Staff / Washing Labour", isSystemGenerated: true },
        ],
      });

      if (totalEarning > 0) {
        if (!linkedExpense) {
          linkedExpense = await Expense.create({
            title: `Washing Labour - ${task.staffName}`,
            category: "Staff / Washing Labour",
            amount: totalEarning,
            paymentMethod: "Cash",
            expenseDate: new Date(),
            notes: `Washing labour for Order #${order._id} (${totalPieces} pcs @ ₹${totalEarning})`,
            reference,
            staffId: task.staffId,
            taskId: task._id,
            orderId: task.orderId,
            isSystemGenerated: true,
            expenseType: "Staff / Washing Labour",
            deletedBy: null,
            isDeleted: false,
          });
        } else {
          linkedExpense.title = `Washing Labour - ${task.staffName}`;
          linkedExpense.amount = totalEarning;
          linkedExpense.category = "Staff / Washing Labour";
          linkedExpense.notes = `Washing labour for Order #${order._id} (${totalPieces} pcs @ ₹${totalEarning})`;
          linkedExpense.reference = reference;
          linkedExpense.staffId = task.staffId;
          linkedExpense.taskId = task._id;
          linkedExpense.orderId = task.orderId;
          linkedExpense.isSystemGenerated = true;
          linkedExpense.expenseType = "Staff / Washing Labour";
          linkedExpense.isDeleted = false;
          linkedExpense.deletedAt = null;
          linkedExpense.deletedBy = null;
          await linkedExpense.save();
        }

        // Clean up any extra duplicate system expenses for this washing labour
        if (linkedExpense) {
          await Expense.deleteMany({
            _id: { $ne: linkedExpense._id },
            orderId: task.orderId,
            category: "Staff / Washing Labour",
            isSystemGenerated: true,
          });
        }
      } else if (linkedExpense) {
        // If earning is 0, delete or mark deleted
        await Expense.findByIdAndDelete(linkedExpense._id);
        linkedExpense = null;
      }

      task.items = completedItems as any;
      task.totalPieces = totalPieces;
      task.totalEarning = totalEarning;
      task.status = "Completed";
      task.completedAt = new Date();
      task.expenseId = linkedExpense ? (linkedExpense._id as mongoose.Types.ObjectId) : null;
      task.reference = reference;
      await task.save();

      // Advance Order to Ironing
      order.status = "Ironing";
      await order.save();

      return {
        success: true,
        message: totalEarning > 0
          ? `Washing completed! ₹${totalEarning} labour expense credited for ${task.staffName}.`
          : `Washing completed for ${task.staffName}. Order moved to Ironing stage.`,
        task: {
          id: task._id.toString(),
          taskType: "washing",
          orderId: task.orderId,
          staffName: task.staffName,
          totalPieces: task.totalPieces,
          totalEarning: task.totalEarning,
        },
        expenseId: linkedExpense ? linkedExpense._id.toString() : null,
      };
    }),

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

      // Fetch all active products to resolve live rates
      const products = await Product.find({ isArchived: { $ne: true } });

      const rawOrderItems = (order.items && order.items.length > 0)
        ? order.items
        : [{ name: order.serviceType || "Standard Laundry", quantity: 1, price: order.totalAmount || 50 }];

      const productIdMap = new Map<string, number>();
      const productNameMap = new Map<string, number>();
      for (const p of products) {
        if (p.staffIroningRate !== undefined && p.staffIroningRate !== null) {
          productIdMap.set(p._id.toString(), p.staffIroningRate);
          productNameMap.set(p.name.toLowerCase().trim(), p.staffIroningRate);
        }
      }

      const taskItems = rawOrderItems.map((item: any) => {
        const { cleanName, extractedQty } = extractCleanGarmentName(item.name);
        const qty = item.quantity && item.quantity > 0 ? item.quantity : (extractedQty || 1);

        let rate: number | undefined;
        if (item.productId && productIdMap.has(item.productId.toString())) {
          const r = productIdMap.get(item.productId.toString());
          if (r !== undefined && r !== null) rate = r;
        }
        if (rate === undefined) {
          const cleanLower = cleanName.toLowerCase().trim();
          const rawLower = (item.name || "").toLowerCase().trim();
          if (productNameMap.has(cleanLower)) {
            rate = productNameMap.get(cleanLower);
          } else if (productNameMap.has(rawLower)) {
            rate = productNameMap.get(rawLower);
          } else {
            productNameMap.forEach((pRate, pName) => {
              if (rate === undefined && (cleanLower.includes(pName) || pName.includes(cleanLower))) {
                rate = pRate;
              }
            });
          }
        }
        if (rate === undefined && productNameMap.has("standard laundry")) {
          rate = productNameMap.get("standard laundry");
        }
        if (rate === undefined && item.staffIroningRate !== undefined && item.staffIroningRate !== null && item.staffIroningRate > 0) {
          rate = item.staffIroningRate;
        }
        // Fallback default rate if unconfigured
        const finalRate = rate !== undefined && rate !== null ? Math.max(0, rate) : fallbackDefaultRate;
        return {
          name: cleanName,
          quantity: qty,
          staffRate: finalRate,
          staffEarning: qty * finalRate,
        };
      });

      const totalPieces = taskItems.reduce((acc, i) => acc + i.quantity, 0);
      const totalEarning = taskItems.reduce((acc, i) => acc + i.staffEarning, 0);

      let task = await IroningTask.findOne({
        orderId: input.orderId,
        taskType: { $ne: "washing" },
      }).sort({ createdAt: -1 });

      if (!task) {
        task = await IroningTask.create({
          taskType: "ironing",
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
      } else {
        task.taskType = "ironing";
        task.staffId = staff._id as mongoose.Types.ObjectId;
        task.staffName = staff.name;
        task.customer = order.customer;
        task.items = taskItems as any;
        task.totalPieces = totalPieces;
        task.totalEarning = totalEarning;
        task.status = "In Progress";
        task.startedAt = new Date();
        task.completedAt = null;
        task.assignedBy = ctx.activeRole || "Admin";
        await task.save();
      }

      // Clean up any extra duplicate ironing tasks for this order
      await IroningTask.deleteMany({
        _id: { $ne: task._id },
        orderId: input.orderId,
        taskType: { $ne: "washing" },
      });

      // Advance Order to Ironing status
      order.status = "Ironing";
      await order.save();

      return {
        success: true,
        message: `Ironing started and assigned to ${staff.name}`,
        task: {
          id: task._id.toString(),
          taskType: "ironing",
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
        taskType: { $ne: "washing" },
        status: { $in: ["In Progress", "Completed"] },
      }).sort({ createdAt: -1 });

      if (!task) return null;

      // If in progress, dynamically refresh item rates from live Product catalog
      let displayItems: Array<{ name: string; quantity: number; staffRate: number; staffEarning: number }> =
        (task.items || []).map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          staffRate: i.staffRate,
          staffEarning: i.staffEarning,
        }));
      let displayTotalPieces = task.totalPieces;
      let displayTotalEarning = task.totalEarning;

      if (task.status === "In Progress") {
        const products = await Product.find({ isArchived: { $ne: true } });
        const shop = await Shop.findOne();
        const fallbackRate = shop?.defaultStaffIroningRate ?? 10;

        const nameMap = new Map<string, number>();
        for (const p of products) {
          if (p.staffIroningRate !== undefined && p.staffIroningRate !== null) {
            nameMap.set(p.name.toLowerCase().trim(), p.staffIroningRate);
          }
        }

        displayItems = (task.items || []).map((i: any) => {
          const { cleanName, extractedQty } = extractCleanGarmentName(i.name);
          const qty = i.quantity && i.quantity > 0 ? i.quantity : (extractedQty || 1);
          const cleanLower = cleanName.toLowerCase().trim();

          let r: number | undefined;
          if (nameMap.has(cleanLower)) {
            r = nameMap.get(cleanLower);
          } else if (nameMap.has("standard laundry")) {
            r = nameMap.get("standard laundry");
          } else if (i.staffRate !== undefined && i.staffRate !== null && i.staffRate > 0) {
            r = i.staffRate;
          } else {
            r = fallbackRate;
          }

          const resolvedRate = r !== undefined && r !== null ? Math.max(0, r) : fallbackRate;
          return {
            name: cleanName,
            quantity: qty,
            staffRate: resolvedRate,
            staffEarning: qty * resolvedRate,
          };
        });

        displayTotalPieces = displayItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
        displayTotalEarning = displayItems.reduce((acc: number, item: any) => acc + (item.staffEarning || 0), 0);
      }

      return {
        id: task._id.toString(),
        taskType: "ironing",
        orderId: task.orderId,
        staffId: task.staffId.toString(),
        staffName: task.staffName,
        customer: task.customer,
        items: displayItems,
        totalPieces: displayTotalPieces,
        totalEarning: displayTotalEarning,
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

      // Check if any ironing task already exists for this order (whether In Progress or Completed)
      let task = await IroningTask.findOne({
        orderId: input.orderId,
        taskType: { $ne: "washing" },
      }).sort({ createdAt: -1 });

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
          taskType: "ironing",
          orderId: input.orderId,
          staffId: staff._id,
          staffName: staff.name,
          customer: order.customer,
          items: [],
          status: "In Progress",
          startedAt: new Date(),
          assignedBy: ctx.activeRole || "Admin",
        });
      } else {
        // Update staff if provided and valid
        if (input.staffId) {
          const staff = await Worker.findById(input.staffId);
          if (staff && staff.active && staff.role !== "pending") {
            task.staffId = staff._id as mongoose.Types.ObjectId;
            task.staffName = staff.name;
          }
        }
        task.customer = order.customer;
      }

      // Clean up any extra duplicate ironing tasks for this order
      await IroningTask.deleteMany({
        _id: { $ne: task._id },
        orderId: input.orderId,
        taskType: { $ne: "washing" },
      });

      const shop = await Shop.findOne();
      const fallbackDefaultRate = shop?.defaultStaffIroningRate ?? 10;

      // Fetch all active products live from Product catalog
      const products = await Product.find({ isArchived: { $ne: true } });

      const rawOrderItems = (order.items && order.items.length > 0)
        ? order.items
        : [{ name: order.serviceType || "Standard Laundry", quantity: 1, price: order.totalAmount || 50 }];

      const productIdMap = new Map<string, number>();
      const productNameMap = new Map<string, number>();
      for (const p of products) {
        if (p.staffIroningRate !== undefined && p.staffIroningRate !== null) {
          productIdMap.set(p._id.toString(), p.staffIroningRate);
          productNameMap.set(p.name.toLowerCase().trim(), p.staffIroningRate);
        }
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
            if (r !== undefined && r !== null) rate = r;
          }
          if (rate === undefined) {
            const cleanLower = cleanName.toLowerCase().trim();
            const rawLower = (item.name || "").toLowerCase().trim();
            if (productNameMap.has(cleanLower)) {
              rate = productNameMap.get(cleanLower);
            } else if (productNameMap.has(rawLower)) {
              rate = productNameMap.get(rawLower);
            } else {
              productNameMap.forEach((pRate, pName) => {
                if (rate === undefined && (cleanLower.includes(pName) || pName.includes(cleanLower))) {
                  rate = pRate;
                }
              });
            }
          }
          if (rate === undefined && productNameMap.has("standard laundry")) {
            rate = productNameMap.get("standard laundry");
          }
          if (rate === undefined && item.staffIroningRate !== undefined && item.staffIroningRate !== null && item.staffIroningRate > 0) {
            rate = item.staffIroningRate;
          }
        }
        // Fallback default rate if unconfigured
        const finalRate = rate !== undefined && rate !== null ? Math.max(0, rate) : fallbackDefaultRate;

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
        $or: [
          ...(task.expenseId ? [{ _id: task.expenseId }] : []),
          { reference },
          { taskId: task._id },
          { orderId: task.orderId, category: "Staff / Ironing Labour", isSystemGenerated: true },
        ],
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

        // Clean up any extra duplicate system expenses for this ironing labour
        if (linkedExpense) {
          await Expense.deleteMany({
            _id: { $ne: linkedExpense._id },
            orderId: task.orderId,
            category: "Staff / Ironing Labour",
            isSystemGenerated: true,
          });
        }
      } else if (linkedExpense) {
        // If earning is 0, delete or mark deleted
        await Expense.findByIdAndDelete(linkedExpense._id);
        linkedExpense = null;
      }

      task.items = completedItems as any;
      task.totalPieces = totalPieces;
      task.totalEarning = totalEarning;
      task.status = "Completed";
      task.completedAt = new Date();
      task.expenseId = linkedExpense ? (linkedExpense._id as mongoose.Types.ObjectId) : null;
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
          taskType: "ironing",
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
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
          const isWash = task.taskType === "washing";
          expense.title = `${isWash ? "Washing" : "Ironing"} Labour - ${task.staffName}`;
          expense.amount = task.totalEarning;
          expense.notes = `${isWash ? "Washing" : "Ironing"} labour for Order #${task.orderId} (Corrected: ${task.totalPieces} pcs @ ₹${task.totalEarning})`;
          await expense.save();
        }
      }

      return { success: true, message: "Task and linked expense updated successfully", task };
    }),

  /**
   * Void task and void linked expense if order is reopened/moved back.
   */
  voidTask: approvedProcedure
    .input(
      z.object({
        orderId: z.string(),
        taskType: z.enum(["all", "ironing", "washing"]).optional().default("all"),
      })
    )
    .mutation(async ({ input }) => {
      const query: Record<string, any> = { orderId: input.orderId };
      if (input.taskType === "ironing") {
        query.taskType = { $ne: "washing" };
      } else if (input.taskType === "washing") {
        query.taskType = "washing";
      }

      const tasks = await IroningTask.find(query);
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

      if (input.taskType === "all") {
        await Expense.updateMany(
          { orderId: input.orderId, isSystemGenerated: true },
          { isDeleted: true, deletedAt: new Date(), deletedBy: "System (Voided Task)" }
        );
      } else if (input.taskType === "ironing") {
        await Expense.updateMany(
          { orderId: input.orderId, category: "Staff / Ironing Labour", isSystemGenerated: true },
          { isDeleted: true, deletedAt: new Date(), deletedBy: "System (Voided Ironing Task)" }
        );
      } else if (input.taskType === "washing") {
        await Expense.updateMany(
          { orderId: input.orderId, category: "Staff / Washing Labour", isSystemGenerated: true },
          { isDeleted: true, deletedAt: new Date(), deletedBy: "System (Voided Washing Task)" }
        );
      }

      return { success: true, message: "Labour task and associated expense voided." };
    }),

  /**
   * Staff Performance & Earnings Report.
   * Calculates from IroningTask collection supporting Ironing, Washing, or All services.
   */
  reports: approvedProcedure
    .input(
      z
        .object({
          period: z.enum(["today", "yesterday", "this_week", "this_month", "custom"]).default("today"),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          staffId: z.string().optional(),
          service: z.enum(["all", "ironing", "washing"]).optional().default("all"),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const period = input?.period || "today";
      const service = input?.service || "all";
      const { start, end } = getISTDateRange(period, input?.fromDate, input?.toDate);

      const deletedOrders = await Order.find({ isDeleted: true }, { _id: 1 }).lean();
      const deletedOrderIds = deletedOrders.map((o) => String(o._id));

      const filter: Record<string, any> = {
        status: "Completed",
        completedAt: { $gte: start, $lte: end },
        orderId: { $nin: deletedOrderIds },
      };

      if (service === "ironing") {
        filter.taskType = { $ne: "washing" };
      } else if (service === "washing") {
        filter.taskType = "washing";
      }

      if (input?.staffId && input.staffId !== "all") {
        filter.staffId = new (mongoose.Types.ObjectId as any)(input.staffId);
      }

      const tasks = await IroningTask.find(filter).sort({ completedAt: -1 }).lean();

      // Group by staff
      const staffMap = new Map<
        string,
        {
          staffId: string;
          staffName: string;
          ironingPieces: number;
          ironingEarnings: number;
          ironingTasksCount: number;
          washingPieces: number;
          washingEarnings: number;
          washingTasksCount: number;
          totalPieces: number;
          totalEarnings: number;
          completedTasksCount: number;
          tasks: Array<{
            id: string;
            taskType: "ironing" | "washing";
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
      let grandTotalIroningPieces = 0;
      let grandTotalIroningEarnings = 0;
      let grandTotalWashingPieces = 0;
      let grandTotalWashingEarnings = 0;

      for (const t of tasks) {
        const staffKey = String(t.staffId);
        if (!staffMap.has(staffKey)) {
          staffMap.set(staffKey, {
            staffId: staffKey,
            staffName: t.staffName,
            ironingPieces: 0,
            ironingEarnings: 0,
            ironingTasksCount: 0,
            washingPieces: 0,
            washingEarnings: 0,
            washingTasksCount: 0,
            totalPieces: 0,
            totalEarnings: 0,
            completedTasksCount: 0,
            tasks: [],
          });
        }

        const staffEntry = staffMap.get(staffKey)!;
        const isWash = t.taskType === "washing";
        const pieces = t.totalPieces || 0;
        const earning = t.totalEarning || 0;

        if (isWash) {
          staffEntry.washingPieces += pieces;
          staffEntry.washingEarnings += earning;
          staffEntry.washingTasksCount += 1;
          grandTotalWashingPieces += pieces;
          grandTotalWashingEarnings += earning;
        } else {
          staffEntry.ironingPieces += pieces;
          staffEntry.ironingEarnings += earning;
          staffEntry.ironingTasksCount += 1;
          grandTotalIroningPieces += pieces;
          grandTotalIroningEarnings += earning;
        }

        staffEntry.totalPieces += pieces;
        staffEntry.totalEarnings += earning;
        staffEntry.completedTasksCount += 1;
        staffEntry.tasks.push({
          id: String(t._id),
          taskType: (t.taskType === "washing" ? "washing" : "ironing"),
          orderId: t.orderId,
          customer: t.customer,
          completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : new Date().toISOString(),
          totalPieces: pieces,
          totalEarning: earning,
          items: t.items || [],
        });

        grandTotalPieces += pieces;
        grandTotalEarnings += earning;
      }

      const staffBreakdown = Array.from(staffMap.values()).sort(
        (a, b) => b.totalEarnings - a.totalEarnings
      );

      return {
        period,
        service,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalPieces: grandTotalPieces,
        totalEarnings: grandTotalEarnings,
        totalIroningPieces: grandTotalIroningPieces,
        totalIroningEarnings: grandTotalIroningEarnings,
        totalWashingPieces: grandTotalWashingPieces,
        totalWashingEarnings: grandTotalWashingEarnings,
        totalTasksCount: tasks.length,
        staffBreakdown,
      };
    }),

  /**
   * Summary cards for Dashboard and Staff Management (Today's Ironing & Washing Staff Overview).
   */
  todayStats: approvedProcedure.query(async () => {
    const { start, end } = getISTDateRange("today");

    const deletedOrders = await Order.find({ isDeleted: true }, { _id: 1 }).lean();
    const deletedOrderIds = deletedOrders.map((o) => String(o._id));

    const [
      todayCompletedIroning,
      todayCompletedWashing,
      activeWorkersCount,
      inProgressIroningCount,
      inProgressWashingCount,
    ] = await Promise.all([
      IroningTask.find({
        taskType: { $ne: "washing" },
        status: "Completed",
        orderId: { $nin: deletedOrderIds },
        completedAt: { $gte: start, $lte: end },
      }).lean(),
      IroningTask.find({
        taskType: "washing",
        status: "Completed",
        orderId: { $nin: deletedOrderIds },
        completedAt: { $gte: start, $lte: end },
      }).lean(),
      Worker.countDocuments({ active: true, role: { $ne: "pending" } }),
      IroningTask.countDocuments({ taskType: { $ne: "washing" }, status: "In Progress", orderId: { $nin: deletedOrderIds } }),
      IroningTask.countDocuments({ taskType: "washing", status: "In Progress", orderId: { $nin: deletedOrderIds } }),
    ]);

    const todayPieces = todayCompletedIroning.reduce((sum, t) => sum + (t.totalPieces || 0), 0);
    const todayLabourCost = todayCompletedIroning.reduce((sum, t) => sum + (t.totalEarning || 0), 0);

    const todayWashedPieces = todayCompletedWashing.reduce((sum, t) => sum + (t.totalPieces || 0), 0);
    const todayWashingLabourCost = todayCompletedWashing.reduce((sum, t) => sum + (t.totalEarning || 0), 0);

    const uniqueActiveIroningStaff = new Set(todayCompletedIroning.map((t) => String(t.staffId))).size;
    const uniqueActiveWashingStaff = new Set(todayCompletedWashing.map((t) => String(t.staffId))).size;

    return {
      // Ironing
      todayPieces,
      todayLabourCost,
      activeIroningStaffToday: uniqueActiveIroningStaff,
      inProgressCount: inProgressIroningCount,

      // Washing
      todayWashedPieces,
      todayWashingLabourCost,
      activeWashingStaffToday: uniqueActiveWashingStaff,
      inProgressWashingCount,

      // Combined
      totalPiecesToday: todayPieces + todayWashedPieces,
      totalLabourCostToday: todayLabourCost + todayWashingLabourCost,
      activeStaffCount: activeWorkersCount,
    };
  }),
});

