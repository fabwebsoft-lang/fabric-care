import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { normalizePhone } from "../lib/phone.js";

const customerSchema = new Schema(
  {
    customerId: { type: String, default: null, trim: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    normalizedPhone: { type: String, required: true, index: true },
    customerType: { type: String, enum: ["Normal", "Premium"], default: "Normal" },
    address: { type: String, default: null },
    alternatePhone: { type: String, default: null },
    notes: { type: String, default: null },
    storedClothesCode: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

customerSchema.index(
  { normalizedPhone: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

customerSchema.pre("save", function (this: any) {
  if (this.phone && !this.normalizedPhone) {
    this.normalizedPhone = normalizePhone(this.phone);
  }
});

export type CustomerDoc = InferSchemaType<typeof customerSchema>;
export const Customer: Model<CustomerDoc> = (mongoose.models.Customer as Model<CustomerDoc>) || model<CustomerDoc>("Customer", customerSchema);

