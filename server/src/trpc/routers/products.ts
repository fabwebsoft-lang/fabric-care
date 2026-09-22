import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";

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

async function ensureDefaultProducts() {
  const activeCount = await Product.countDocuments({ isArchived: { $ne: true } });
  if (activeCount === 0) {
    for (const def of DEFAULT_PRODUCTS) {
      try {
        await Product.create(def);
      } catch {}
    }
  }

  // Ensure valid numeric rates
  try {
    const allActive = await Product.find({ isArchived: { $ne: true } });
    for (const p of allActive) {
      let modified = false;
      if (p.staffIroningRate === undefined || p.staffIroningRate === null) {
        p.staffIroningRate = 10;
        modified = true;
      }
      if (p.staffWashRate === undefined || p.staffWashRate === null) {
        p.staffWashRate = 15;
        modified = true;
      }
      if (modified) {
        await p.save();
      }
    }
  } catch (err) {
    console.error("Failed to verify product rates:", err);
  }
}

  // 3. Auto-migrate and re-link existing stuck/active orders
  try {
    const products = await Product.find({ isArchived: { $ne: true } });
    const productMap = new Map<string, any>();
    for (const p of products) {
      productMap.set(p.name.toLowerCase().trim(), p);
    }
    const defaultProduct = productMap.get("standard laundry") || products[0];

    const activeOrders = await Order.find({
      status: { $in: ["Received", "Processing", "Ironing"] },
      isDeleted: { $ne: true },
    });

    for (const order of activeOrders) {
      let modified = false;
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const rawName = (item.name || "").trim();
          const prefixMatch = rawName.match(/^(\d+)\s*(?:items|pcs|pieces)?\s*[·\.\:\-\*x\s]\s*(.+)$/i);
          let cleanName = rawName;
          if (prefixMatch) {
            cleanName = prefixMatch[2].trim();
            if (!item.quantity || item.quantity <= 1) {
              item.quantity = Number(prefixMatch[1]) || 1;
              modified = true;
            }
          }
          const matched =
            productMap.get(cleanName.toLowerCase()) ||
            Array.from(productMap.values()).find(
              (p) =>
                p.name.toLowerCase().includes(cleanName.toLowerCase()) ||
                cleanName.toLowerCase().includes(p.name.toLowerCase())
            ) ||
            defaultProduct;

          if (matched) {
            if (item.name !== cleanName) {
              item.name = cleanName;
              modified = true;
            }
            if (!item.productId || item.productId !== matched._id.toString()) {
              item.productId = matched._id.toString();
              modified = true;
            }
            if (
              item.staffIroningRate === undefined ||
              item.staffIroningRate === null ||
              item.staffIroningRate === 0
            ) {
              item.staffIroningRate = matched.staffIroningRate ?? 10;
              modified = true;
            }
          }
        }
      }
      if (modified) {
        await order.save();
      }
    }
  } catch (err) {
    console.error("Auto-migration of orders error:", err);
  }
}

function toApiProduct(p: any) {
  return {
    id: p._id.toString(),
    name: p.name,
    category: p.category,
    serviceType: p.serviceType,
    price: p.price,
    staffWashRate: Number(p.staffWashRate ?? 0),
    staffIroningRate: Number(p.staffIroningRate ?? 10),
    rateUnit: (p.rateUnit ?? "per_piece") as "per_piece" | "per_order" | "per_kg",
    status: p.status as "Active" | "Inactive",
    isArchived: Boolean(p.isArchived),
    createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export const productsRouter = router({
  list: approvedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.string().optional(),
          serviceType: z.string().optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      await ensureDefaultProducts();

      const filter: Record<string, any> = { isArchived: { $ne: true } };

      if (input?.search && input.search.trim()) {
        filter.name = { $regex: input.search.trim(), $options: "i" };
      }

      if (input?.category && input.category !== "All") {
        filter.category = input.category;
      }

      if (input?.serviceType && input.serviceType !== "All") {
        filter.serviceType = input.serviceType;
      }

      if (input?.status && input.status !== "All") {
        filter.status = input.status;
      }

      const products = await Product.find(filter).sort({ createdAt: -1 });
      return products.map(toApiProduct);
    }),

  activeList: approvedProcedure.query(async () => {
    await ensureDefaultProducts();
    const products = await Product.find({ status: "Active", isArchived: { $ne: true } }).sort({ name: 1 });
    return products.map(toApiProduct);
  }),

  create: requirePermission("canManageSettings")
    .input(
      z.object({
        name: z.string().trim().min(1, "Item name is required"),
        category: z.enum(["Men's Wear", "Women's Wear", "Kids Wear", "Household", "Other"]),
        serviceType: z.enum(["Wash & Fold", "Wash & Iron", "Dry Clean", "Iron Only", "Steam Iron", "Other"]),
        price: z.number().positive("Price must be greater than 0"),
        staffWashRate: z.number().min(0, "Staff wash rate cannot be negative").default(0),
        staffIroningRate: z.number().min(0, "Staff ironing rate cannot be negative").default(10),
        rateUnit: z.enum(["per_piece", "per_order", "per_kg"]).default("per_piece"),
        status: z.enum(["Active", "Inactive"]).default("Active"),
      })
    )
    .mutation(async ({ input }) => {
      // Check for duplicate active item with same name
      const existing = await Product.findOne({
        name: { $regex: `^${input.name.trim()}$`, $options: "i" },
        isArchived: { $ne: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `An item named "${input.name.trim()}" already exists.`,
        });
      }

      const product = await Product.create({
        name: input.name.trim(),
        category: input.category,
        serviceType: input.serviceType,
        price: input.price,
        staffWashRate: input.staffWashRate ?? 0,
        staffIroningRate: input.staffIroningRate ?? 10,
        rateUnit: input.rateUnit ?? "per_piece",
        status: input.status,
      });

      return toApiProduct(product);
    }),

  update: requirePermission("canManageSettings")
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1, "Item name is required").optional(),
        category: z.enum(["Men's Wear", "Women's Wear", "Kids Wear", "Household", "Other"]).optional(),
        serviceType: z.enum(["Wash & Fold", "Wash & Iron", "Dry Clean", "Iron Only", "Steam Iron", "Other"]).optional(),
        price: z.number().positive("Price must be greater than 0").optional(),
        staffWashRate: z.number().min(0, "Staff wash rate cannot be negative").optional(),
        staffIroningRate: z.number().min(0, "Staff ironing rate cannot be negative").optional(),
        rateUnit: z.enum(["per_piece", "per_order", "per_kg"]).optional(),
        status: z.enum(["Active", "Inactive"]).optional(),
      })
    )
    .mutation(async ({ input: { id, ...patch } }) => {
      if (patch.name) {
        const existing = await Product.findOne({
          _id: { $ne: id },
          name: { $regex: `^${patch.name.trim()}$`, $options: "i" },
          isArchived: { $ne: true },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Another item named "${patch.name.trim()}" already exists.`,
          });
        }
      }

      const product = await Product.findByIdAndUpdate(
        id,
        {
          ...(patch.name && { name: patch.name.trim() }),
          ...(patch.category && { category: patch.category }),
          ...(patch.serviceType && { serviceType: patch.serviceType }),
          ...(patch.price !== undefined && { price: patch.price }),
          ...(patch.staffWashRate !== undefined && { staffWashRate: patch.staffWashRate }),
          ...(patch.staffIroningRate !== undefined && { staffIroningRate: patch.staffIroningRate }),
          ...(patch.rateUnit !== undefined && { rateUnit: patch.rateUnit }),
          ...(patch.status && { status: patch.status }),
        },
        { new: true }
      );

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      return toApiProduct(product);
    }),

  toggleStatus: requirePermission("canManageSettings")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const product = await Product.findById(input.id);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      product.status = product.status === "Active" ? "Inactive" : "Active";
      await product.save();

      return toApiProduct(product);
    }),

  delete: requirePermission("canManageSettings")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const product = await Product.findById(input.id);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Check if product is referenced in any orders
      const orderUsingItem = await Order.findOne({ "items.name": product.name });

      if (orderUsingItem) {
        // Safe archive approach: preserve historical references
        product.isArchived = true;
        product.status = "Inactive";
        await product.save();
        return { success: true, archived: true };
      } else {
        await Product.findByIdAndDelete(input.id);
        return { success: true, archived: false };
      }
    }),

  deleteAll: requirePermission("canManageSettings").mutation(async () => {
    await Product.deleteMany({});
    return { success: true };
  }),

  resetDefaults: requirePermission("canManageSettings").mutation(async () => {
    await Product.deleteMany({});
    for (const def of DEFAULT_PRODUCTS) {
      await Product.create(def);
    }
    return { success: true };
  }),
});
