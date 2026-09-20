import { router, approvedProcedure } from "../trpc.js";
import { Order } from "../../models/Order.js";

export const dashboardRouter = router({
  stats: approvedProcedure.query(async () => {
    const orders = await Order.find();

    const now = new Date();
    const isToday = (date?: Date | string | null) => {
      if (!date) return false;
      const d = new Date(date);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };

    const todayOrders = orders.filter((o) => isToday(o.createdAt));
    const todaysRevenue = todayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const collectedToday = todayOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);
    const pendingDues = orders.reduce((s, o) => s + Math.max(0, (o.totalAmount || 0) - (o.amountPaid || 0)), 0);
    const ordersReceived = orders.filter((o) => o.status === "Received").length;
    const processingCount = orders.filter((o) => o.status === "Processing").length;
    const readyCount = orders.filter((o) => o.status === "Ready").length;
    const itemsInProcess = orders
      .filter((o) => o.status === "Processing")
      .reduce((sum, o) => sum + o.items.reduce((acc, item) => acc + (item.quantity || 0), 0), 0);

    return {
      todaysRevenue,
      collectedToday,
      pendingDues,
      inProcessCount: ordersReceived + processingCount,
      readyCount,
      ordersReceived,
      itemsInProcess,
      processCounts: {
        Received: ordersReceived,
        Processing: processingCount,
        Ready: readyCount,
      },
    };
  }),
});
