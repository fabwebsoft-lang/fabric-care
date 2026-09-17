import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Order } from "../../models/Order.js";
import { Customer } from "../../models/Customer.js";

const orderItemInput = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  clothTags: z.array(z.string()).optional(),
});

function toApiOrder(o: InstanceType<typeof Order>) {
  return {
    id: o._id as string,
    customer: o.customer,
    phone: o.phone,
    customerType: o.customerType,
    clothesCode: o.clothesCode,
    serviceType: o.serviceType,
    status: o.status,
    deliveryType: o.deliveryType,
    dueAt: o.dueAt ? o.dueAt.toISOString() : null,
    totalAmount: o.totalAmount,
    amountPaid: o.amountPaid,
    discount: o.discount,
    items: o.items,
    createdAt: o.createdAt!.toISOString(),
    updatedAt: o.updatedAt!.toISOString(),
  };
}

async function nextOrderId(shopCode: string) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const countToday = await Order.countDocuments({ _id: { $regex: `^WP-${dateStr}-` } });
  const seq = String(countToday + 1).padStart(3, "0");
  return `WP-${dateStr}-${seq}-${shopCode}`;
}

export const ordersRouter = router({
  list: approvedProcedure.query(async () => {
    const orders = await Order.find().sort({ createdAt: -1 });
    return orders.map(toApiOrder);
  }),

  create: requirePermission("canCreateOrders")
    .input(
      z.object({
        customerName: z.string().min(1),
        phone: z.string().min(1),
        customerType: z.enum(["Normal", "Premium"]).default("Normal"),
        serviceType: z.string().default("Standard Laundry"),
        deliveryType: z.enum(["Shop Collection", "Home Delivery"]).default("Shop Collection"),
        dueAt: z.string().datetime().optional(),
        totalAmount: z.number().nonnegative(),
        amountPaid: z.number().nonnegative().default(0),
        discount: z.number().nonnegative().default(0),
        storedClothesCode: z.string().optional(),
        address: z.string().optional(),
        alternatePhone: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(orderItemInput).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const id = await nextOrderId("FC01");
      const clothesCode = input.storedClothesCode || `C-${input.phone.slice(-4)}`;

      const order = await Order.create({
        _id: id,
        customer: input.customerName,
        phone: input.phone,
        customerType: input.customerType,
        clothesCode,
        serviceType: input.serviceType,
        status: "Received",
        deliveryType: input.deliveryType,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        totalAmount: input.totalAmount,
        amountPaid: input.amountPaid,
        discount: input.discount,
        items: input.items,
      });

      await Customer.findOneAndUpdate(
        { phone: input.phone },
        {
          $setOnInsert: {
            name: input.customerName,
            phone: input.phone,
            customerType: input.customerType,
            address: input.address ?? null,
            alternatePhone: input.alternatePhone ?? null,
            notes: input.notes ?? null,
            storedClothesCode: clothesCode,
          },
        },
        { upsert: true }
      );

      return toApiOrder(order);
    }),

  updateStatus: requirePermission("canUpdateOrderStatus")
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["Received", "Processing", "Ready", "Collected"]),
        deliveryType: z.enum(["Shop Collection", "Home Delivery"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const order = await Order.findByIdAndUpdate(
        input.id,
        { status: input.status, ...(input.deliveryType && { deliveryType: input.deliveryType }) },
        { new: true }
      );
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      return toApiOrder(order);
    }),

  settlePayment: requirePermission("canSettlePayments")
    .input(
      z.object({
        id: z.string(),
        amountPaid: z.number().positive(),
        deliveryType: z.enum(["Shop Collection", "Home Delivery"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const order = await Order.findById(input.id);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const newPaid = Math.min(order.totalAmount, order.amountPaid + input.amountPaid);
      order.amountPaid = newPaid;
      if (newPaid >= order.totalAmount) order.status = "Collected";
      if (input.deliveryType) order.deliveryType = input.deliveryType;
      await order.save();
      return toApiOrder(order);
    }),

  delete: requirePermission("canDeleteOrders")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await Order.findByIdAndDelete(input.id);
      return { success: true };
    }),
});
