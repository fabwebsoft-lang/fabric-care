import express, { type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import mongoose from "mongoose";
import { appRouter } from "../server/src/trpc/router.js";
import { createContext } from "../server/src/trpc/trpc.js";

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
  await mongoose.connect(mongoUri);
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

// One-touch reset endpoint to clean all test data for client handover
app.all(["/api/clean-reset", "/api/admin/clean-reset"], async (_req: Request, res: Response) => {
  try {
    await connectDB();
    const { Order } = await import("../server/src/models/Order.js");
    const { IroningTask } = await import("../server/src/models/IroningTask.js");
    const { Expense } = await import("../server/src/models/Expense.js");
    const { DeletedBill } = await import("../server/src/models/DeletedBill.js");
    const { Customer } = await import("../server/src/models/Customer.js");
    const { Product } = await import("../server/src/models/Product.js");

    await Order.deleteMany({});
    await IroningTask.deleteMany({});
    await Expense.deleteMany({});
    await DeletedBill.deleteMany({});
    await Customer.deleteMany({});
    await Product.deleteMany({});

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
    for (const def of DEFAULT_PRODUCTS) {
      await Product.create(def);
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
