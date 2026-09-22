import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const deviceSchema = new Schema(
  {
    deviceLabel: { type: String, required: true },
    userAgent: { type: String, default: null },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type DeviceDoc = InferSchemaType<typeof deviceSchema>;
export const Device: Model<DeviceDoc> = (mongoose.models.Device as Model<DeviceDoc>) || model<DeviceDoc>("Device", deviceSchema);
