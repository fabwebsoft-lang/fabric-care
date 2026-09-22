import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, requirePermission, approvedProcedure } from "../trpc.js";
import { Expense } from "../../models/Expense.js";

export const expensesRouter = router({
  list: approvedProcedure.query(async () => {
    const expenses = await Expense.find({ isDeleted: { $ne: true } }).sort({ expenseDate: -1 });
    return expenses.map((e: any) => ({
      id: e._id.toString(),
      title: e.title,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      expenseDate: e.expenseDate.toISOString(),
      notes: e.notes,
      reference: e.reference,
      staffId: e.staffId ? e.staffId.toString() : null,
      taskId: e.taskId ? e.taskId.toString() : null,
      orderId: e.orderId ?? null,
      isSystemGenerated: Boolean(e.isSystemGenerated),
      expenseType: e.expenseType ?? (e.isSystemGenerated ? "Staff Labour" : "Manual"),
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
      const expense = await Expense.create({ ...input, expenseDate: new Date(input.expenseDate), isSystemGenerated: false, expenseType: "Manual" });
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
      const existing = await Expense.findById(input.id);
      if (!existing || existing.isDeleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      if (existing.isSystemGenerated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "System-generated labour expenses cannot be edited manually.",
        });
      }

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
        isSystemGenerated: Boolean(updated.isSystemGenerated),
        expenseType: updated.expenseType,
        createdAt: updated.createdAt!.toISOString(),
      };
    }),

  delete: requirePermission("canDeleteExpenses")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await Expense.findById(input.id);
      if (!existing || existing.isDeleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      if (existing.isSystemGenerated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "System-generated labour expenses cannot be deleted manually. To reverse this labour entry, move the order back to the previous step in Active Process.",
        });
      }

      const userLabel = ctx.activeRole
        ? String(ctx.activeRole).charAt(0).toUpperCase() + String(ctx.activeRole).slice(1)
        : "Admin";
      const deleted = await Expense.findByIdAndUpdate(
        input.id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userLabel,
        },
        { new: true }
      );
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      return { success: true };
    }),

  deleteAll: requirePermission("canDeleteExpenses").mutation(async () => {
    await Expense.deleteMany({});
    return { success: true };
  }),
});
