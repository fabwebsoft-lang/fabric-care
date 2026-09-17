import { router, requirePermission } from "../trpc.js";
import { Order } from "../../models/Order.js";
import { Expense } from "../../models/Expense.js";

export const reportsRouter = router({
  // dailyStats here is computed from real Order/Expense data, replacing the
  // hardcoded week-of-fake-numbers the frontend mock used to return.
  businessStatements: requirePermission("canViewReports").query(async () => {
    const orders = await Order.find();
    const expenses = await Expense.find();

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalCollected = orders.reduce((s, o) => s + o.amountPaid, 0);
    const totalPending = totalRevenue - totalCollected;
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalCollected - totalExpenses;

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const days = new Map<string, { revenue: number; collected: number; expenses: number }>();
    const dayBucket = (key: string) => {
      let bucket = days.get(key);
      if (!bucket) {
        bucket = { revenue: 0, collected: 0, expenses: 0 };
        days.set(key, bucket);
      }
      return bucket;
    };

    for (const o of orders) {
      const bucket = dayBucket(dayKey(o.createdAt!));
      bucket.revenue += o.totalAmount;
      bucket.collected += o.amountPaid;
    }
    for (const e of expenses) {
      dayBucket(dayKey(e.expenseDate)).expenses += e.amount;
    }

    const dailyStats = [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, v]) => ({ date, ...v, net: v.collected - v.expenses }));

    return {
      totalRevenue,
      totalCollected,
      totalPending,
      totalExpenses,
      netProfit,
      orderCount: orders.length,
      avgOrderValue: orders.length ? Math.round(totalRevenue / orders.length) : 0,
      dailyStats,
    };
  }),
});
