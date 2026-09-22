import express, { type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import mongoose from "mongoose";
import { appRouter } from "../server/src/trpc/router.js";
import { createContext } from "../server/src/trpc/trpc.js";
import { Order } from "../server/src/models/Order.js";
import { IroningTask } from "../server/src/models/IroningTask.js";
import { Expense } from "../server/src/models/Expense.js";
import { DeletedBill } from "../server/src/models/DeletedBill.js";
import { Customer } from "../server/src/models/Customer.js";
import { Product } from "../server/src/models/Product.js";
import { Worker } from "../server/src/models/Worker.js";
import { Shop } from "../server/src/models/Shop.js";
import { Device } from "../server/src/models/Device.js";

const DEFAULT_PRODUCTS = [
  { name: "Shirt", category: "Men's Wear", serviceType: "Wash & Iron", price: 50, staffWashRate: 15, staffIroningRate: 10, rateUnit: "per_piece", status: "Active" },
  { name: "Pant", category: "Men's Wear", serviceType: "Wash & Iron", price: 60, staffWashRate: 15, staffIroningRate: 10, rateUnit: "per_piece", status: "Active" },
  { name: "Vasti / Dhoti", category: "Men's Wear", serviceType: "Wash & Iron", price: 50, staffWashRate: 15, staffIroningRate: 10, rateUnit: "per_piece", status: "Active" },
  { name: "Suit (2-pc)", category: "Men's Wear", serviceType: "Dry Clean", price: 180, staffWashRate: 50, staffIroningRate: 30, rateUnit: "per_piece", status: "Active" },
  { name: "Saree", category: "Women's Wear", serviceType: "Dry Clean", price: 120, staffWashRate: 40, staffIroningRate: 25, rateUnit: "per_piece", status: "Active" },
  { name: "Dress", category: "Women's Wear", serviceType: "Wash & Iron", price: 100, staffWashRate: 25, staffIroningRate: 15, rateUnit: "per_piece", status: "Active" },
  { name: "Blanket", category: "Household", serviceType: "Wash & Fold", price: 200, staffWashRate: 50, staffIroningRate: 0, rateUnit: "per_piece", status: "Active" },
  { name: "Curtain", category: "Household", serviceType: "Wash & Fold", price: 150, staffWashRate: 40, staffIroningRate: 20, rateUnit: "per_piece", status: "Active" },
  { name: "Standard Laundry", category: "Other", serviceType: "Wash & Iron", price: 60, staffWashRate: 15, staffIroningRate: 10, rateUnit: "per_piece", status: "Active" },
];

const app = express();

// Cache DB connection across serverless invocations
let isConnected = false;

async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    return;
  }
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn("MONGODB_URI is not configured in environment.");
    return;
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
  });
  isConnected = true;
  console.log("MongoDB connected in Vercel Serverless Function");
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Ensure DB is connected for every request
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("Database connection failure in serverless handler:", err);
  }
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, status: "healthy", db: mongoose.connection.readyState === 1 ? "connected" : "connecting" });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, status: "healthy", db: mongoose.connection.readyState === 1 ? "connected" : "connecting" });
});

// Explicit routing for audit and clean-reset to bypass any rewrite prefix ambiguity
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.url.includes("audit")) {
    try {
      await connectDB();

      const [
        ordersCount,
        customersCount,
        productsCount,
        workersCount,
        expensesCount,
        ironingTasksCount,
        deletedBillsCount,
        devicesCount,
        shopsCount,
      ] = await Promise.all([
        Order.countDocuments({}),
        Customer.countDocuments({}),
        Product.countDocuments({}),
        Worker.countDocuments({}),
        Expense.countDocuments({}),
        IroningTask.countDocuments({}),
        DeletedBill.countDocuments({}),
        Device.countDocuments({}),
        Shop.countDocuments({}),
      ]);

      const workers = await Worker.find({}, "name role email active").lean();
      const shop = await Shop.findOne({}, "name address shopCode").lean();
      const recentOrders = await Order.find({}, "orderNumber customerName status totalAmount createdAt").sort({ createdAt: -1 }).limit(10).lean();
      const customersSample = await Customer.find({}, "name phone totalOrders").sort({ createdAt: -1 }).limit(10).lean();

      return res.json({
        success: true,
        dbStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        counts: {
          orders: ordersCount,
          customers: customersCount,
          products: productsCount,
          workers: workersCount,
          expenses: expensesCount,
          ironingTasks: ironingTasksCount,
          deletedBills_recycleBin: deletedBillsCount,
          devices: devicesCount,
          shops: shopsCount,
        },
        staffProfiles: workers.map((w: any) => ({ name: w.name, role: w.role, email: w.email || null, active: w.active })),
        shopConfig: shop ? { name: shop.name, address: shop.address, shopCode: shop.shopCode } : null,
        ordersSample: recentOrders.map((o: any) => ({ orderNumber: o.orderNumber, customer: o.customerName, status: o.status, amount: o.totalAmount })),
        customersSample: customersSample.map((c: any) => ({ name: c.name, phone: c.phone, ordersCount: c.totalOrders })),
      });
    } catch (err: any) {
      console.error("Audit error:", err);
      return res.status(500).json({ success: false, error: err?.message || "Audit failed" });
    }
  }

  if (req.url.includes("clean-reset")) {
    try {
      await connectDB();

      await Order.deleteMany({});
      await IroningTask.deleteMany({});
      await Expense.deleteMany({});
      await DeletedBill.deleteMany({});
      await Customer.deleteMany({});
      await Product.deleteMany({});

      for (const def of DEFAULT_PRODUCTS) {
        await Product.create(def as any);
      }

      return res.json({
        success: true,
        message: "Database successfully wiped and reset to clean state for client handover.",
        resetCounts: {
          orders: 0,
          expenses: 0,
          customers: 0,
          defaultProductsCount: DEFAULT_PRODUCTS.length,
        },
      });
    } catch (err: any) {
      console.error("Clean reset error:", err);
      return res.status(500).json({ success: false, error: err?.message || "Failed to reset database" });
    }
  }

  next();
});

// tRPC handlers - mount on multiple paths to handle Vercel rewrites robustly
const trpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext,
});

app.use("/trpc", trpcMiddleware);
app.use("/api/trpc", trpcMiddleware);
app.use("/api/index", trpcMiddleware);
app.use("/api", trpcMiddleware);
app.use((req: Request, res: Response, next: NextFunction) => {
  // If not handled yet and appears to be a tRPC call, try trpcMiddleware directly
  if (req.url.includes("products.") || req.url.includes("orders.") || req.url.includes("ironing.") || req.url.includes("batch=")) {
    return trpcMiddleware(req, res, next);
  }
  next();
});

export default app;
