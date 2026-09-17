import { router, approvedProcedure } from "../trpc.js";
import { Order } from "../../models/Order.js";

export const dashboardRouter = router({
  stats: approvedProcedure.query(async () => {
    const orders = await Order.find();
    const todaysRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const collectedToday = orders.reduce((s, o) => s + o.amountPaid, 0);
    const pendingDues = orders.reduce((s, o) => s + Math.max(0, o.totalAmount - o.amountPaid), 0);
    const ordersReceived = orders.filter((o) => o.status === "Received").length;
    const processingCount = orders.filter((o) => o.status === "Processing").length;
    const readyCount = orders.filter((o) => o.status === "Ready").length;
    const itemsInProcess = orders
      .filter((o) => o.status === "Processing")
      .reduce((sum, o) => sum + o.items.reduce((acc, item) => acc + item.quantity, 0), 0);

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
