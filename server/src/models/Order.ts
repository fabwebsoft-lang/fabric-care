import { Schema, model, type InferSchemaType } from "mongoose";

const orderItemSchema = new Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    clothTags: { type: [String], default: [] },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    _id: { type: String }, // human-readable order number, e.g. WP-20260917-001-FC01
    customer: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    customerType: { type: String, enum: ["Normal", "Premium"], default: "Normal" },
    clothesCode: { type: String, default: null },
    serviceType: { type: String, default: "Standard Laundry" },
    status: {
      type: String,
      enum: ["Received", "Processing", "Ready", "Collected"],
      default: "Received",
    },
    deliveryType: { type: String, enum: ["Shop Collection", "Home Delivery"], default: null },
    dueAt: { type: Date, default: null },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    items: { type: [orderItemSchema], default: [] },
  },
  { timestamps: true, _id: false }
);

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = model("Order", orderSchema);
