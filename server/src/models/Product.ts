import { Schema, model, type InferSchemaType } from "mongoose";

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["Men's Wear", "Women's Wear", "Kids Wear", "Household", "Other"],
      default: "Men's Wear",
    },
    serviceType: {
      type: String,
      required: true,
      enum: ["Wash & Fold", "Wash & Iron", "Dry Clean", "Iron Only", "Steam Iron", "Other"],
      default: "Wash & Iron",
    },
    price: { type: Number, required: true, min: 0 },
    staffWashRate: { type: Number, default: 0, min: 0 },
    staffIroningRate: { type: Number, default: 10, min: 0 },
    rateUnit: {
      type: String,
      enum: ["per_piece", "per_order", "per_kg"],
      default: "per_piece",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ name: 1, isArchived: 1 });
productSchema.index({ status: 1, isArchived: 1 });

export type ProductDoc = InferSchemaType<typeof productSchema>;
export const Product = model("Product", productSchema);
