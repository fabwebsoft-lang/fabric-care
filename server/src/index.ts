import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { env } from "./env.js";
import { connectDB } from "./db.js";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./trpc/trpc.js";

async function main() {
  await connectDB();

  const app = express();
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(
    "/trpc",
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
