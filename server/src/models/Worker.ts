import { Schema, model, type InferSchemaType } from "mongoose";

export const WORKER_ROLES = ["admin", "manager", "staff", "owner", "worker"] as const;

const workerSchema = new Schema(
  {
    name: { type: String, required: true },
    role: { type: String, enum: WORKER_ROLES, required: true },
    pinHash: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type WorkerDoc = InferSchemaType<typeof workerSchema>;
export const Worker = model("Worker", workerSchema);
