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

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow all origins for the laundry management app
    callback(null, true);
  },
  credentials: true,
};

app.use(cors(corsOptions));
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

// tRPC handlers
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
