import { Schema, model, type InferSchemaType } from "mongoose";
import { normalizePhone } from "../lib/phone.js";

const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    normalizedPhone: { type: String, required: true, unique: true, index: true },
    customerType: { type: String, enum: ["Normal", "Premium"], default: "Normal" },
    address: { type: String, default: null },
    alternatePhone: { type: String, default: null },
    notes: { type: String, default: null },
    storedClothesCode: { type: String, default: null },
  },
  { timestamps: true }
);

customerSchema.pre("save", function (this: any) {
  if (this.phone && !this.normalizedPhone) {
    this.normalizedPhone = normalizePhone(this.phone);
  }
});

export type CustomerDoc = InferSchemaType<typeof customerSchema>;
export const Customer = model("Customer", customerSchema);

