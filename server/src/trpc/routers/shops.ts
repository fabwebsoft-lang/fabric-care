import { z } from "zod";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Shop } from "../../models/Shop.js";
import { Order } from "../../models/Order.js";
import { IroningTask } from "../../models/IroningTask.js";
import { Expense } from "../../models/Expense.js";
import { DeletedBill } from "../../models/DeletedBill.js";
import { Customer } from "../../models/Customer.js";
import { Product } from "../../models/Product.js";
import { Device } from "../../models/Device.js";
import { Worker } from "../../models/Worker.js";

type DefaultProductDef = {
  name: string;
  category: "Men's Wear" | "Women's Wear" | "Kids Wear" | "Household" | "Other";
  serviceType: "Wash & Fold" | "Wash & Iron" | "Dry Clean" | "Iron Only" | "Steam Iron" | "Other";
  price: number;
  staffWashRate: number;
  staffIroningRate: number;
  rateUnit: "per_piece" | "per_order" | "per_kg";
  status: "Active" | "Inactive";
};

const DEFAULT_PRODUCTS: DefaultProductDef[] = [
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
    defaultStaffIroningRate: Number(shop.defaultStaffIroningRate ?? 10),
    defaultStaffWashRate: Number(shop.defaultStaffWashRate ?? 15),
    defaultRateUnit: (shop.defaultRateUnit ?? "per_piece") as "per_piece" | "per_order" | "per_kg",
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

  audit: approvedProcedure.query(async () => {
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

    return {
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
    };
  }),

  updateSettings: requirePermission("canManageSettings")
    .input(
      z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        customerNotifications: z.boolean().optional(),
        pricingTier: z.string().optional(),
        defaultStaffIroningRate: z.number().min(0).optional(),
        defaultStaffWashRate: z.number().min(0).optional(),
        defaultRateUnit: z.enum(["per_piece", "per_order", "per_kg"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const shop = await getOrCreateShop();
      shop.name = input.name;
      shop.address = input.address;
      if (input.customerNotifications !== undefined) shop.customerNotifications = input.customerNotifications;
      if (input.pricingTier) shop.pricingTier = input.pricingTier;
      if (input.defaultStaffIroningRate !== undefined) shop.defaultStaffIroningRate = input.defaultStaffIroningRate;
      if (input.defaultStaffWashRate !== undefined) shop.defaultStaffWashRate = input.defaultStaffWashRate;
      if (input.defaultRateUnit) shop.defaultRateUnit = input.defaultRateUnit;
      await shop.save();
      return toApiShop(shop);
    }),

  recordBackup: requirePermission("canManageSettings").mutation(async () => {
    const shop = await getOrCreateShop();
    shop.lastBackupAt = new Date();
    await shop.save();
    return { lastBackupAt: shop.lastBackupAt.toISOString() };
  }),

  resetAllData: requirePermission("canManageSettings")
    .input(
      z
        .object({
          resetProductsToDefault: z.boolean().default(true),
          clearAllProducts: z.boolean().default(false),
          clearOrders: z.boolean().default(true),
          clearExpenses: z.boolean().default(true),
          clearCustomers: z.boolean().default(true),
          clearRecycleBin: z.boolean().default(true),
          clearDevices: z.boolean().default(false),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const resetProducts = input?.resetProductsToDefault ?? true;
      const clearProducts = input?.clearAllProducts ?? false;
      const clearOrders = input?.clearOrders ?? true;
      const clearExpenses = input?.clearExpenses ?? true;
      const clearCustomers = input?.clearCustomers ?? true;
      const clearRecycleBin = input?.clearRecycleBin ?? true;
      const clearDevices = input?.clearDevices ?? false;

      if (clearOrders) {
        await Order.deleteMany({});
        await IroningTask.deleteMany({});
      }

      if (clearExpenses) {
        await Expense.deleteMany({});
      }

      if (clearRecycleBin) {
        await DeletedBill.deleteMany({});
      }

      if (clearCustomers) {
        await Customer.deleteMany({});
      }

      if (clearDevices) {
        await Device.deleteMany({});
      }

      if (clearProducts) {
        await Product.deleteMany({});
      } else if (resetProducts) {
        await Product.deleteMany({});
        for (const def of DEFAULT_PRODUCTS) {
          await Product.create(def as any);
        }
      }

      return {
        success: true,
        message: "All selected data has been completely cleared and reset.",
      };
    }),
});
