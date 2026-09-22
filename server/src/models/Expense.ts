import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const expenseSchema = new Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    expenseDate: { type: Date, required: true },
    notes: { type: String, default: null },
    reference: { type: String, default: null, index: true, sparse: true },
    staffId: { type: Schema.Types.ObjectId, ref: "Worker", default: null },
    taskId: { type: Schema.Types.ObjectId, ref: "IroningTask", default: null },
    orderId: { type: String, default: null, index: true, sparse: true },
    isSystemGenerated: { type: Boolean, default: false },
    expenseType: { type: String, default: "Manual" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export type ExpenseDoc = InferSchemaType<typeof expenseSchema>;
export const Expense: Model<ExpenseDoc> = (mongoose.models.Expense as Model<ExpenseDoc>) || model<ExpenseDoc>("Expense", expenseSchema);
