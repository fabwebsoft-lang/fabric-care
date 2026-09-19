import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, approvedProcedure, requirePermission } from "../trpc.js";
import { Order } from "../../models/Order.js";
import { Customer } from "../../models/Customer.js";
import { normalizePhone } from "../../lib/phone.js";

const orderItemInput = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  clothTags: z.array(z.string()).optional(),
});

function toApiOrder(o: any) {
  return {
    id: o._id as string,
    customerId: (o.customerId as string | null) || null,
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
        customerId: z.string().optional(),
        customerName: z.string().trim().min(1, "Customer name is required"),
        phone: z.string().trim().min(1, "Phone number is required"),
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
        updateCustomerMaster: z.boolean().optional(),
        items: z.array(orderItemInput).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const id = await nextOrderId("FC01");
      const normPhone = normalizePhone(input.phone);
      const clothesCode = input.storedClothesCode?.trim() || `C-${normPhone.slice(-4) || "0000"}`;

      let linkedCustomerId: string | null = null;

      if (input.customerId) {
        // Link to existing customer
        const existingCustomer = await Customer.findById(input.customerId);
        if (existingCustomer) {
          linkedCustomerId = existingCustomer._id.toString();
          if (input.updateCustomerMaster) {
            existingCustomer.name = input.customerName;
            existingCustomer.phone = input.phone;
            existingCustomer.normalizedPhone = normPhone;
            existingCustomer.customerType = input.customerType;
            if (input.address !== undefined) existingCustomer.address = input.address || null;
            if (input.alternatePhone !== undefined) existingCustomer.alternatePhone = input.alternatePhone || null;
            if (input.notes !== undefined) existingCustomer.notes = input.notes || null;
            if (input.storedClothesCode !== undefined) existingCustomer.storedClothesCode = clothesCode;
            await existingCustomer.save();
          }
        }
      }

      if (!linkedCustomerId) {
        // Check if customer already exists by phone (duplicate prevention on creation)
        const duplicate = await Customer.findOne({
          $or: [{ normalizedPhone: normPhone }, { phone: input.phone.trim() }],
        });

        if (duplicate) {
          // If in new customer mode and duplicate phone is found, reject
          throw new TRPCError({
            code: "CONFLICT",
            message: `A customer with this mobile number already exists: ${duplicate.name} (${duplicate.phone}). Please select the existing customer.`,
          });
        }

        // Create new customer record
        const newCustomer = await Customer.create({
          name: input.customerName,
          phone: input.phone.trim(),
          normalizedPhone: normPhone,
          customerType: input.customerType,
          address: input.address?.trim() || null,
          alternatePhone: input.alternatePhone?.trim() || null,
          notes: input.notes?.trim() || null,
          storedClothesCode: clothesCode,
        });
        linkedCustomerId = newCustomer._id.toString();
      }

      const order = await Order.create({
        _id: id,
        customerId: linkedCustomerId,
        customer: input.customerName,
        phone: input.phone.trim(),
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
        amountPaid: z.number().min(0).default(0),
        deliveryType: z.enum(["Shop Collection", "Home Delivery"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const order = await Order.findById(input.id);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const addedPaid = Math.max(0, input.amountPaid || 0);
      order.amountPaid = Math.min(order.totalAmount, order.amountPaid + addedPaid);
      order.status = "Collected";
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
