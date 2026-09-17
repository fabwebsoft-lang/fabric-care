import { Schema, model, type InferSchemaType } from "mongoose";

const shopSchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    customerNotifications: { type: Boolean, default: true },
    pricingTier: { type: String, default: "Normal + Premium" },
    shopCode: { type: String, required: true, unique: true },
    lastBackupAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type ShopDoc = InferSchemaType<typeof shopSchema>;
export const Shop = model("Shop", shopSchema);
