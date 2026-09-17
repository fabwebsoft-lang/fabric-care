import { Schema, model, type InferSchemaType } from "mongoose";

const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    customerType: { type: String, enum: ["Normal", "Premium"], default: "Normal" },
    address: { type: String, default: null },
    alternatePhone: { type: String, default: null },
    notes: { type: String, default: null },
    storedClothesCode: { type: String, default: null },
  },
  { timestamps: true }
);

export type CustomerDoc = InferSchemaType<typeof customerSchema>;
export const Customer = model("Customer", customerSchema);
