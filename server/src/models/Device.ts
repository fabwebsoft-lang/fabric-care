import { Schema, model, type InferSchemaType } from "mongoose";

const deviceSchema = new Schema(
  {
    deviceLabel: { type: String, required: true },
    userAgent: { type: String, default: null },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type DeviceDoc = InferSchemaType<typeof deviceSchema>;
export const Device = model("Device", deviceSchema);
