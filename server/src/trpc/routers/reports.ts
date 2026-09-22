import { z } from "zod";
import { router, requirePermission } from "../trpc.js";
import { Order } from "../../models/Order.js";
import { Expense } from "../../models/Expense.js";

const filterInput = z
  .object({
    period: z.enum(["today", "7_days", "month", "financial_year", "custom"]).default("month"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .optional();

function getPeriodDateRange(period: "today" | "7_days" | "month" | "financial_year" | "custom", startStr?: string, endStr?: string) {
  const now = new Date();

  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end, groupMode: "day" as const };
  }

  if (period === "7_days") {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return { start, end, groupMode: "day" as const };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, groupMode: "day" as const };
  }

  if (period === "financial_year") {
    // Indian FY runs April 1 to March 31
    const currentMonth = now.getMonth(); // 0-indexed (April is 3)
    const fyStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const start = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
    const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
    return { start, end, groupMode: "month" as const };
  }

  // Custom period
  const start = startStr ? new Date(startStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endStr ? new Date(endStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return { start, end, groupMode: (diffDays > 62 ? "month" : "day") as "month" | "day" };
}

export const reportsRouter = router({
  businessStatements: requirePermission("canViewReports")
    .input(filterInput)
    .query(async ({ input }) => {
      const selectedPeriod = input?.period || "month";
      const { start, end, groupMode } = getPeriodDateRange(selectedPeriod, input?.startDate, input?.endDate);

      // Fetch all non-deleted orders and expenses within date range
      const orders = await Order.find({
        isDeleted: { $ne: true },
        createdAt: { $gte: start, $lte: end },
      }).sort({ createdAt: 1 });

      const expenses = await Expense.find({
        isDeleted: { $ne: true },
        expenseDate: { $gte: start, $lte: end },
      }).sort({ expenseDate: 1 });

      const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const totalCollected = orders.reduce((s, o) => s + (o.amountPaid || 0), 0);
      const totalPending = totalRevenue - totalCollected;

      let totalLabourCost = 0;
      let totalOtherExpenses = 0;
      for (const e of expenses) {
        if (e.isSystemGenerated || (e.category && e.category.toLowerCase().includes("labour"))) {
          totalLabourCost += Number(e.amount || 0);
        } else {
          totalOtherExpenses += Number(e.amount || 0);
        }
      }
      const totalExpenses = totalLabourCost + totalOtherExpenses;
      const netProfit = totalRevenue - totalExpenses;

      const buckets = new Map<string, { label: string; date: string; sales: number; collected: number; labour: number; expenses: number; orders: number }>();

      if (groupMode === "month") {
        // Pre-populate months between start and end
        let cur = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cur <= end) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
          const label = cur.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
          buckets.set(key, { label, date: label, sales: 0, collected: 0, labour: 0, expenses: 0, orders: 0 });
          cur.setMonth(cur.getMonth() + 1);
        }
      } else {
        // Pre-populate days between start and end (capped at 62 days)
        let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        while (cur <= end) {
          const key = cur.toISOString().slice(0, 10);
          const label = cur.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          buckets.set(key, { label, date: label, sales: 0, collected: 0, labour: 0, expenses: 0, orders: 0 });
          cur.setDate(cur.getDate() + 1);
        }
      }

      for (const o of orders) {
        const d = new Date(o.createdAt!);
        const key = groupMode === "month"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : d.toISOString().slice(0, 10);

        let bucket = buckets.get(key);
        if (!bucket) {
          const label = groupMode === "month"
            ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
            : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          bucket = { label, date: label, sales: 0, collected: 0, labour: 0, expenses: 0, orders: 0 };
          buckets.set(key, bucket);
        }
        bucket.sales += o.totalAmount || 0;
        bucket.collected += o.amountPaid || 0;
        bucket.orders += 1;
      }

      for (const e of expenses) {
        const d = new Date(e.expenseDate);
        const key = groupMode === "month"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : d.toISOString().slice(0, 10);

        let bucket = buckets.get(key);
        if (!bucket) {
          const label = groupMode === "month"
            ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
            : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          bucket = { label, date: label, sales: 0, collected: 0, labour: 0, expenses: 0, orders: 0 };
          buckets.set(key, bucket);
        }
        if (e.isSystemGenerated || (e.category && e.category.toLowerCase().includes("labour"))) {
          bucket.labour += e.amount || 0;
        }
        bucket.expenses += e.amount || 0;
      }

      const dailyStats = [...buckets.entries()]
        .map(([rawKey, v]) => ({
          rawKey,
          date: v.label,
          label: v.label,
          sales: v.sales,
          revenue: v.sales,
          collected: v.collected,
          labour: v.labour,
          expenses: v.expenses,
          orders: v.orders,
          net: v.sales - v.expenses,
        }));

      return {
        period: selectedPeriod,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalRevenue,
        totalCollected,
        totalPending: Math.max(0, totalPending),
        totalLabourCost,
        totalOtherExpenses,
        totalExpenses,
        netProfit,
        orderCount: orders.length,
        avgOrderValue: orders.length ? Math.round(totalRevenue / orders.length) : 0,
        dailyStats,
        dailyBreakdown: dailyStats,
      };
    }),
});
