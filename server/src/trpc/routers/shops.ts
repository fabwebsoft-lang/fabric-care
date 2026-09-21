import { z } from "zod";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Shop } from "../../models/Shop.js";

async function getOrCreateShop() {
  let shop = await Shop.findOne();
  if (!shop) {
    shop = await Shop.create({
      name: "Fabric Care",
      address: "17/B3, 1st street, Pandian Nagar, Dindigul",
      shopCode: "FC01",
    });
  }
  return shop;
}

function toApiShop(shop: Awaited<ReturnType<typeof getOrCreateShop>>) {
  return {
    id: shop._id.toString(),
    name: shop.name,
    address: shop.address,
    customerNotifications: shop.customerNotifications ? 1 : 0,
    pricingTier: shop.pricingTier,
    shopCode: shop.shopCode,
    lastBackupAt: shop.lastBackupAt ? shop.lastBackupAt.toISOString() : null,
    createdAt: shop.createdAt!.toISOString(),
    updatedAt: shop.updatedAt!.toISOString(),
  };
}

export const shopsRouter = router({
  list: approvedProcedure.query(async () => {
    const shop = await getOrCreateShop();
    return [toApiShop(shop)];
  }),

  updateSettings: requirePermission("canManageSettings")
    .input(
      z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        customerNotifications: z.boolean().optional(),
        pricingTier: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const shop = await getOrCreateShop();
      shop.name = input.name;
      shop.address = input.address;
      if (input.customerNotifications !== undefined) shop.customerNotifications = input.customerNotifications;
      if (input.pricingTier) shop.pricingTier = input.pricingTier;
      await shop.save();
      return toApiShop(shop);
    }),

  recordBackup: requirePermission("canManageSettings").mutation(async () => {
    const shop = await getOrCreateShop();
    shop.lastBackupAt = new Date();
    await shop.save();
    return { lastBackupAt: shop.lastBackupAt.toISOString() };
  }),
});
