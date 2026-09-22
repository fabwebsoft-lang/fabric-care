import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

const deletedOrderItemSchema = new Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    clothTags: { type: [String], default: [] },
  },
  { _id: false }
);

const deletedBillSchema = new Schema(
  {
    orderId: { type: String, required: true, index: true },
    customerId: { type: String, default: null, index: true },
    customer: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    customerType: { type: String, enum: ["Normal", "Premium"], default: "Normal" },
    clothesCode: { type: String, default: null },
    serviceType: { type: String, default: "Standard Laundry" },
    status: {
      type: String,
      enum: ["Received", "Processing", "Ironing", "Ready", "Collected"],
      default: "Received",
    },
    deliveryType: { type: String, enum: ["Shop Collection", "Home Delivery"], default: null },
    dueAt: { type: Date, default: null },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    items: { type: [deletedOrderItemSchema], default: [] },
    originalCreatedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: Date.now, index: true },
    deletedBy: { type: String, default: "Admin" },
    reason: { type: String, default: null },
    action: {
      type: String,
      enum: ["moved_to_recycle_bin", "permanently_deleted", "restored"],
      default: "moved_to_recycle_bin",
    },
  },
  { timestamps: true }
);

export type DeletedBillDoc = InferSchemaType<typeof deletedBillSchema>;
export const DeletedBill = (mongoose.models.DeletedBill as any) || model("DeletedBill", deletedBillSchema);
