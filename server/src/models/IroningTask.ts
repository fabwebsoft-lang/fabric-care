import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const ironingTaskItemSchema = new Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    staffRate: { type: Number, required: true, default: 0 },
    staffEarning: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const ironingTaskSchema = new Schema(
  {
    taskType: {
      type: String,
      enum: ["ironing", "washing"],
      default: "ironing",
      index: true,
    },
    orderId: { type: String, required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
    staffName: { type: String, required: true },
    customer: { type: String, required: true },
    items: { type: [ironingTaskItemSchema], default: [] },
    totalPieces: { type: Number, required: true, default: 0 },
    totalEarning: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["In Progress", "Completed", "Voided"],
      default: "In Progress",
      index: true,
    },
    startedAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    assignedBy: { type: String, default: "Admin" },
    expenseId: { type: Schema.Types.ObjectId, ref: "Expense", default: null },
    reference: { type: String, default: null, sparse: true },
  },
  { timestamps: true }
);

ironingTaskSchema.index({ taskType: 1, staffId: 1, completedAt: 1 });
ironingTaskSchema.index({ taskType: 1, orderId: 1, status: 1 });
ironingTaskSchema.index({ staffId: 1, completedAt: 1 });
ironingTaskSchema.index({ orderId: 1, status: 1 });

export type IroningTaskDoc = InferSchemaType<typeof ironingTaskSchema>;
export const IroningTask: Model<IroningTaskDoc> = (mongoose.models.IroningTask as Model<IroningTaskDoc>) || model<IroningTaskDoc>("IroningTask", ironingTaskSchema);

