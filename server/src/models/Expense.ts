import { Schema, model, type InferSchemaType } from "mongoose";

const expenseSchema = new Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    expenseDate: { type: Date, required: true },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export type ExpenseDoc = InferSchemaType<typeof expenseSchema>;
export const Expense = model("Expense", expenseSchema);
