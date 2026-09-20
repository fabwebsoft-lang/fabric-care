import express, { type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { env } from "./env.js";
import { connectDB } from "./db.js";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./trpc/trpc.js";

// In-memory rate limiting map for auth endpoints (brute-force protection)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  // Only rate limit login and signup operations
  const path = req.path || "";
  const isAuthAction =
    path.includes("auth.login") ||
    path.includes("auth.signup") ||
    (req.body && (req.body["0"]?.path?.includes("auth.login") || req.body["0"]?.path?.includes("auth.signup")));

  if (!isAuthAction) {
    return next();
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown-ip";

  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes window
  const maxAttempts = 10; // Max 10 attempts per 15 minutes

  const record = rateLimitMap.get(clientIp);
  if (!record || record.resetAt < now) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (record.count >= maxAttempts) {
    const retrySecs = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retrySecs));
    return res.status(429).json({
      error: {
        message: `Too many login attempts. Please try again in ${Math.ceil(retrySecs / 60)} minutes.`,
        code: "TOO_MANY_REQUESTS",
      },
    });
  }

  record.count += 1;
  next();
}

// Clean up expired rate-limit records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(ip);
    }
  }
}, 10 * 60 * 1000);

async function main() {
  await connectDB();

  const app = express();

  // Hide server signature
  app.disable("x-powered-by");

  // Security Headers Middleware
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:;"
    );
    next();
  });

  // Allowed CORS origins (support comma-separated env values and vercel domains)
  const configuredOrigins = env.corsOrigin.split(",").map((s) => s.trim());
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Allow server-to-server or non-browser tools
      const isAllowed =
        configuredOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:");
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, status: "healthy" }));

  app.use(
    "/trpc",
    authRateLimiter,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.listen(env.port, () => {
    console.log(`Fabric Care API listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
