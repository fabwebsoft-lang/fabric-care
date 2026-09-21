import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, requirePermission, approvedProcedure } from "../trpc.js";
import { Expense } from "../../models/Expense.js";

export const expensesRouter = router({
  list: approvedProcedure.query(async () => {
    const expenses = await Expense.find().sort({ expenseDate: -1 });
    return expenses.map((e) => ({
      id: e._id.toString(),
      title: e.title,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      expenseDate: e.expenseDate.toISOString(),
      notes: e.notes,
      createdAt: e.createdAt!.toISOString(),
    }));
  }),

  create: requirePermission("canRecordExpenses")
    .input(
      z.object({
        title: z.string().min(1),
        category: z.string().min(1),
        amount: z.number().positive(),
        paymentMethod: z.string().min(1),
        expenseDate: z.string().datetime(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const expense = await Expense.create({ ...input, expenseDate: new Date(input.expenseDate) });
      return { id: expense._id.toString(), title: expense.title };
    }),

  update: requirePermission("canRecordExpenses")
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        category: z.string().min(1),
        amount: z.number().positive(),
        paymentMethod: z.string().min(1),
        expenseDate: z.string().datetime(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, expenseDate, ...rest } = input;
      const updated = await Expense.findByIdAndUpdate(
        id,
        {
          ...rest,
          expenseDate: new Date(expenseDate),
        },
        { new: true }
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      return {
        id: updated._id.toString(),
        title: updated.title,
        category: updated.category,
        amount: updated.amount,
        paymentMethod: updated.paymentMethod,
        expenseDate: updated.expenseDate.toISOString(),
        notes: updated.notes,
        createdAt: updated.createdAt!.toISOString(),
      };
    }),

  delete: requirePermission("canDeleteExpenses")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const deleted = await Expense.findByIdAndDelete(input.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      return { success: true };
    }),
});
