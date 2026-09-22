// @ts-nocheck
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import mongoose from "mongoose";
import { appRouter } from "../server/src/trpc/router.js";
import { createContext } from "../server/src/trpc/trpc.js";

const app = express();

const DEFAULT_MONGO_URI =
  "mongodb+srv://fabwebsoft_db_user:fab-web-123@cluster0.2tsyfd7.mongodb.net/fabric_care?retryWrites=true&w=majority&appName=Cluster0";

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
    process.env.MONGO_URL ||
    DEFAULT_MONGO_URI;

  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);

  cachedDbPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
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

// Ensure DB is connected before any API or tRPC route handles the request
app.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await connectDB();
    next();
  } catch (err: any) {
    console.error("DB connection error in serverless function:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Database connection failed",
        message: err.message,
        hint: "Check that MongoDB Atlas Network Access allows 0.0.0.0/0 (allow from anywhere) for Vercel serverless functions.",
      });
    }
  }
});

// REST Health Check & Root Endpoints
app.get(["/", "/api", "/api/health", "/health", "/api/index/health", "/status", "/api/status"], (_req: Request, res: Response) => {
  const activeUri =
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL;

  const isDbConnected = mongoose.connection.readyState === 1;

  return res.json({
    ok: isDbConnected,
    service: "Fabric Care Backend API",
    status: isDbConnected ? "healthy" : "db_disconnected",
    database: isDbConnected ? "MongoDB Atlas Connected" : "Disconnected",
    db: isDbConnected ? "connected" : "disconnected",
    hasMongoUriEnv: Boolean(activeUri),
    endpoints: {
      root: "/",
      health: "/api/health",
      trpc: "/api/trpc",
    },
    timestamp: new Date().toISOString(),
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
