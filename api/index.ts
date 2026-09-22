// @ts-nocheck
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import mongoose from "mongoose";
import { appRouter } from "../server/src/trpc/router.js";
import { createContext } from "../server/src/trpc/trpc.js";

const app = express();

let cachedDbPromise: Promise<typeof mongoose> | null = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (cachedDbPromise) {
    return cachedDbPromise;
  }

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set in environment variables.");
  }

  mongoose.set("strictQuery", true);
  cachedDbPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
    })
    .catch((err) => {
      cachedDbPromise = null;
      throw err;
    });

  return cachedDbPromise;
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Ensure DB is connected
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("DB connection error in serverless function:", err);
  }
  next();
});

// REST Health Check Endpoint
app.get(["/api/health", "/health", "/api/index/health"], (_req: Request, res: Response) => {
  const activeUri =
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL;

  return res.json({
    ok: true,
    status: "healthy",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    hasMongoUriEnv: Boolean(activeUri),
  });
});

const trpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext,
});

// Universal tRPC handler: strips any prefix so tRPC router matches any procedure
app.use((req: Request, res: Response, next: NextFunction) => {
  const url = req.url;

  if (url.startsWith("/api/trpc/")) {
    req.url = url.slice("/api/trpc".length);
  } else if (url.startsWith("/api/trpc?")) {
    req.url = "/" + url.slice("/api/trpc".length);
  } else if (url.startsWith("/trpc/")) {
    req.url = url.slice("/trpc".length);
  } else if (url.startsWith("/trpc?")) {
    req.url = "/" + url.slice("/trpc".length);
  } else if (url.startsWith("/api/index/")) {
    req.url = url.slice("/api/index".length);
  } else if (url.startsWith("/api/index?")) {
    req.url = "/" + url.slice("/api/index".length);
  } else if (url.startsWith("/api/")) {
    req.url = url.slice("/api".length);
  } else if (url.startsWith("/api?")) {
    req.url = "/" + url.slice("/api".length);
  }

  return trpcMiddleware(req, res, (err) => {
    if (err) return next(err);
    if (!res.headersSent) {
      res.status(404).json({ error: "Endpoint not found", path: req.originalUrl || req.url });
    }
  });
});

export default app;
