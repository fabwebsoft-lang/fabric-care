import { z } from "zod";
import { router, requirePermission, protectedProcedure } from "../trpc.js";
import { Expense } from "../../models/Expense.js";

export const expensesRouter = router({
  list: protectedProcedure.query(async () => {
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
      return { id: expense._id.toString() };
    }),

  delete: requirePermission("canDeleteExpenses")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await Expense.findByIdAndDelete(input.id);
      return { success: true };
    }),
});
