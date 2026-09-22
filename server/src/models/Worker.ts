import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

// "pending" = signed up but not yet approved by an admin; carries no permissions.
export const WORKER_ROLES = ["pending", "admin", "manager", "staff"] as const;

const workerSchema = new Schema(
  {
    name: { type: String, required: true },
    // Self-signup accounts have email + passwordHash and log in directly.
    // Admin-created counter workers may have neither, and instead use pinHash
    // for quick role-switching on a shared device (see workers.verifyPin).
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    role: { type: String, enum: WORKER_ROLES, default: "pending" },
    pinHash: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type WorkerDoc = InferSchemaType<typeof workerSchema>;
export const Worker = (mongoose.models.Worker as any) || model("Worker", workerSchema);
