import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";

const DEFAULT_PRODUCTS = [
  { name: "Shirt", category: "Men's Wear", serviceType: "Wash & Iron", price: 50, status: "Active" },
  { name: "Pant", category: "Men's Wear", serviceType: "Wash & Iron", price: 60, status: "Active" },
  { name: "Vasti / Dhoti", category: "Men's Wear", serviceType: "Wash & Iron", price: 50, status: "Active" },
  { name: "Suit (2-pc)", category: "Men's Wear", serviceType: "Dry Clean", price: 180, status: "Active" },
  { name: "Saree", category: "Women's Wear", serviceType: "Dry Clean", price: 120, status: "Active" },
  { name: "Dress", category: "Women's Wear", serviceType: "Wash & Iron", price: 100, status: "Active" },
  { name: "Blanket", category: "Household", serviceType: "Wash & Fold", price: 200, status: "Active" },
  { name: "Curtain", category: "Household", serviceType: "Wash & Fold", price: 150, status: "Active" },
];

async function ensureDefaultProducts() {
  const count = await Product.countDocuments();
  if (count === 0) {
    try {
      await Product.insertMany(DEFAULT_PRODUCTS);
    } catch {
      // Ignore if concurrent insert happens
    }
  }
}

function toApiProduct(p: any) {
  return {
    id: p._id.toString(),
    name: p.name,
    category: p.category,
    serviceType: p.serviceType,
    price: p.price,
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
});
