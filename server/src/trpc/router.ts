import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { ordersRouter } from "./routers/orders.js";
import { customersRouter } from "./routers/customers.js";
import { expensesRouter } from "./routers/expenses.js";
import { shopsRouter } from "./routers/shops.js";
import { workersRouter } from "./routers/workers.js";
import { devicesRouter } from "./routers/devices.js";
import { reportsRouter } from "./routers/reports.js";
import { dashboardRouter } from "./routers/dashboard.js";
import { productsRouter } from "./routers/products.js";
import { recycleBinRouter } from "./routers/recycleBin.js";
import { ironingRouter } from "./routers/ironing.js";

export const appRouter = router({
  auth: authRouter,
  orders: ordersRouter,
  customers: customersRouter,
  expenses: expensesRouter,
  shops: shopsRouter,
  workers: workersRouter,
  devices: devicesRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  products: productsRouter,
  recycleBin: recycleBinRouter,
  ironing: ironingRouter,
});

export type AppRouter = typeof appRouter;
