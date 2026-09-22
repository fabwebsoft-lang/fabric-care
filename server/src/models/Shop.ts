import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const shopSchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    customerNotifications: { type: Boolean, default: true },
    pricingTier: { type: String, default: "Normal + Premium" },
    defaultStaffIroningRate: { type: Number, default: 10, min: 0 },
    defaultStaffWashRate: { type: Number, default: 15, min: 0 },
    defaultRateUnit: {
      type: String,
      enum: ["per_piece", "per_order", "per_kg"],
      default: "per_piece",
    },
    shopCode: { type: String, required: true, unique: true },
    lastBackupAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type ShopDoc = InferSchemaType<typeof shopSchema>;
export const Shop: Model<ShopDoc> = (mongoose.models.Shop as Model<ShopDoc>) || model<ShopDoc>("Shop", shopSchema);
