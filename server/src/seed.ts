import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import { Shop } from "./models/Shop.js";
import { Worker } from "./models/Worker.js";
import { hashSecret } from "./lib/auth.js";

async function main() {
  await connectDB();

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME || "Shop Owner";

  if (!adminEmail || !adminPassword) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running the seed script");
  }

  const passwordHash = await hashSecret(adminPassword);
  await Worker.findOneAndUpdate(
    { email: adminEmail.toLowerCase() },
    { name: adminName, email: adminEmail.toLowerCase(), passwordHash, role: "admin", active: true },
    { upsert: true }
  );
  console.log(`Admin account ready: ${adminEmail}`);

  const shopCode = process.env.SEED_SHOP_CODE || "FC01";
  await Shop.findOneAndUpdate(
    { shopCode },
    {
      $setOnInsert: {
        name: process.env.SEED_SHOP_NAME || "Fabric Care",
        address: process.env.SEED_SHOP_ADDRESS || "17/B3, 1st street, Pandian Nagar, Dindigul",
        shopCode,
      },
    },
    { upsert: true }
  );
  console.log(`Shop ready: ${shopCode}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
