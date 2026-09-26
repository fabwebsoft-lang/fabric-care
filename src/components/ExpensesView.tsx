import { useState, useEffect, useRef, useMemo } from "react";
import { trpc, type Expense } from "@/lib/trpc";
import {
  WalletCards,
  Plus,
  Check,
  X,
  MoreVertical,
  Pencil,
  Trash2,
  User,
  Calendar,
  ChevronDown,
  Sparkles,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { toast } from "sonner";

// Extract staff name from expense title or category
function extractStaffName(expense: Expense): string {
  const title = (expense.title || "").trim();

  // If title has a dash or separator (e.g., "Ironing Labour – Chinras", "Ironing Labour - asfaq")
  if (/[-–—]/.test(title)) {
    const parts = title.split(/[-–—]/);
    if (parts.length >= 2) {
      const extracted = parts[parts.length - 1].trim();
      if (extracted) {
        return extracted;
      }
    }
  }

  // If category is staff-related or has wages
  const cat = (expense.category || "").toLowerCase();
  if (cat.includes("labour") || cat.includes("wages") || cat.includes("staff")) {
    if (title.includes(":")) {
      const parts = title.split(":");
      if (parts[1]?.trim()) return parts[1].trim();
    }
    return "Staff Member";
  }

  // General expense entry
  return "Shop Owner";
}

function formatExpenseDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getDateSortKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "1970-01-01";
    return d.toISOString().slice(0, 10);
  } catch {
    return "1970-01-01";
  }
}

interface DateGroup {
  dateKey: string;
  formattedDate: string;
  totalAmount: number;
  expenses: Expense[];
}

interface StaffGroup {
  staffName: string;
  totalAmount: number;
  totalEntries: number;
  latestDate: string;
  dateGroups: DateGroup[];
}

export default function ExpensesView() {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Collapsed state tracking (default is expanded / false)
  const [collapsedStaff, setCollapsedStaff] = useState<Record<string, boolean>>({});
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const menuRef = useRef<HTMLDivElement>(null);

  const { data: apiExpenses = [], isLoading } = trpc.expenses.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery();
  const utils = trpc.useUtils();

  // Close 3-dots action menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    if (menuOpenId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpenId]);

  const createExpenseMutation = trpc.expenses.create.useMutation({
    onSuccess: async (created) => {
      await utils.expenses.list.invalidate();
      await utils.dashboard.stats.invalidate();
      setShowExpenseModal(false);
      toast.success("Expense added", { description: `${created.title} · saved to the database` });
    },
    onError: (error) => toast.error("Could not save expense", { description: error.message }),
  });

  const updateExpenseMutation = trpc.expenses.update.useMutation({
    onSuccess: async (updated) => {
      await utils.expenses.list.invalidate();
      await utils.dashboard.stats.invalidate();
      setEditingExpense(null);
      toast.success("Expense updated", { description: `${updated.title} · changes saved` });
    },
    onError: (error) => toast.error("Could not update expense", { description: error.message }),
  });

  const deleteExpenseMutation = trpc.expenses.delete.useMutation({
    onSuccess: async () => {
      await utils.expenses.list.invalidate();
      await utils.dashboard.stats.invalidate();
      await utils.recycleBin.counts.invalidate();
      await utils.recycleBin.list.invalidate();
      setDeletingExpense(null);
      toast.success("Expense moved to Recycle Bin", {
        description: "You can restore or permanently delete it from the Recycle Bin.",
      });
    },
    onError: (error) => toast.error("Could not move expense to Recycle Bin", { description: error.message }),
  });

  const totalExpenseAmount = apiExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const totalCollectedAmount = orders.reduce((sum, o) => sum + Number(o.amountPaid || 0), 0);
  const netProfit = totalCollectedAmount - totalExpenseAmount;

  // Filter and Group Expenses by Staff Name -> Date
  const groupedExpenses = useMemo<StaffGroup[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = apiExpenses.filter((e) => {
      if (!q) return true;
      const staff = extractStaffName(e).toLowerCase();
      const title = (e.title || "").toLowerCase();
      const cat = (e.category || "").toLowerCase();
      const notes = (e.notes || "").toLowerCase();
      const method = (e.paymentMethod || "").toLowerCase();
      return (
        staff.includes(q) ||
        title.includes(q) ||
        cat.includes(q) ||
        notes.includes(q) ||
        method.includes(q)
      );
    });

    const staffMap = new Map<
      string,
      {
        staffName: string;
        totalAmount: number;
        totalEntries: number;
        latestDate: string;
        datesMap: Map<
          string,
          { dateKey: string; formattedDate: string; totalAmount: number; expenses: Expense[] }
        >;
      }
    >();

    for (const exp of filtered) {
      const staffName = extractStaffName(exp);
      const amount = Number(exp.amount || 0);
      const dateKey = getDateSortKey(exp.expenseDate);
      const formattedDate = formatExpenseDate(exp.expenseDate);

      if (!staffMap.has(staffName)) {
        staffMap.set(staffName, {
          staffName,
          totalAmount: 0,
          totalEntries: 0,
          latestDate: dateKey,
          datesMap: new Map(),
        });
      }

      const staffGroup = staffMap.get(staffName)!;
      staffGroup.totalAmount += amount;
      staffGroup.totalEntries += 1;
      if (dateKey > staffGroup.latestDate) {
        staffGroup.latestDate = dateKey;
      }

      if (!staffGroup.datesMap.has(dateKey)) {
        staffGroup.datesMap.set(dateKey, {
          dateKey,
          formattedDate,
          totalAmount: 0,
          expenses: [],
        });
      }

      const dateGroup = staffGroup.datesMap.get(dateKey)!;
      dateGroup.totalAmount += amount;
      dateGroup.expenses.push(exp);
    }

    const result: StaffGroup[] = Array.from(staffMap.values()).map((staff) => {
      const dateGroups = Array.from(staff.datesMap.values())
        .map((dg) => ({
          ...dg,
          expenses: dg.expenses.sort(
            (a, b) =>
              new Date(b.expenseDate || 0).getTime() - new Date(a.expenseDate || 0).getTime()
          ),
        }))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

      return {
        staffName: staff.staffName,
        totalAmount: staff.totalAmount,
        totalEntries: staff.totalEntries,
        latestDate: staff.latestDate,
        dateGroups,
      };
    });

    return result.sort(
      (a, b) =>
        b.latestDate.localeCompare(a.latestDate) || a.staffName.localeCompare(b.staffName)
    );
  }, [apiExpenses, searchQuery]);

  const toggleStaffCollapse = (staffName: string) => {
    setCollapsedStaff((prev) => ({
      ...prev,
      [staffName]: !prev[staffName],
    }));
  };

  const toggleDateCollapse = (staffName: string, dateKey: string) => {
    const key = `${staffName}__${dateKey}`;
    setCollapsedDates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const areAllCollapsed = useMemo(() => {
    if (groupedExpenses.length === 0) return false;
    return groupedExpenses.every((s) => collapsedStaff[s.staffName]);
  }, [groupedExpenses, collapsedStaff]);

  const toggleAllStaff = () => {
    if (areAllCollapsed) {
      setCollapsedStaff({});
    } else {
      const next: Record<string, boolean> = {};
      for (const s of groupedExpenses) {
        next[s.staffName] = true;
      }
      setCollapsedStaff(next);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <WalletCards className="size-5 sm:size-6 text-[#0F4C5C]" />
            Shop Expenses & Outflow
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Record shop overheads, wages, and raw materials to maintain accurate net profit
          </p>
        </div>

        <button
          onClick={() => {
            setEditingExpense(null);
            setShowExpenseModal(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 min-h-[44px]"
        >
          <Plus className="size-4" /> Add Expense
        </button>
      </div>

      <div className="grid gap-4 sm:gap-5 grid-cols-1 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs flex flex-col">
          {/* Top Summary Cards */}
          <div className="mb-5 grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Total Expenses</p>
              <p className="mt-1 text-base sm:text-lg font-bold text-rose-800">
                ₹{totalExpenseAmount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className={`rounded-xl p-3.5 border ${netProfit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>Net Profit</p>
              <p className={`mt-1 text-base sm:text-lg font-bold ${netProfit >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
                ₹{netProfit.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl p-3.5 bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Recorded Items</p>
              <p className="mt-1 text-base sm:text-lg font-bold text-blue-800">
                {apiExpenses.length} entries
              </p>
            </div>
          </div>

          {/* Search & Collapse Controls */}
          {apiExpenses.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by staff, title, category, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#0F4C5C] focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {groupedExpenses.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllStaff}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-[#0F4C5C] bg-slate-100/80 hover:bg-slate-200/80 rounded-lg transition shrink-0"
                >
                  <ChevronsUpDown className="size-3.5 text-slate-500" />
                  <span>{areAllCollapsed ? "Expand All" : "Collapse All"}</span>
                </button>
              )}
            </div>
          )}

          {/* Grouped Staff & Date Accordion List */}
          <div className="space-y-3.5">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading expenses...</div>
            ) : apiExpenses.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No expenses recorded yet.</div>
            ) : groupedExpenses.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No matching expenses found for &quot;{searchQuery}&quot;.
              </div>
            ) : (
              groupedExpenses.map((staff) => {
                const isStaffCollapsed = Boolean(collapsedStaff[staff.staffName]);
                const isOwner = staff.staffName.toLowerCase() === "shop owner";

                return (
                  <div
                    key={staff.staffName}
                    className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-visible transition"
                  >
                    {/* Staff Group Header */}
                    <button
                      type="button"
                      onClick={() => toggleStaffCollapse(staff.staffName)}
                      className="w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 bg-slate-50/70 hover:bg-slate-100/70 rounded-2xl transition text-left cursor-pointer select-none"
                      aria-expanded={!isStaffCollapsed}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`size-8 sm:size-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                            isOwner
                              ? "bg-slate-200 text-slate-700"
                              : "bg-[#0F4C5C]/10 text-[#0F4C5C]"
                          }`}
                        >
                          <User className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {staff.staffName}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                              {staff.totalEntries} {staff.totalEntries === 1 ? "entry" : "entries"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {staff.dateGroups.length} {staff.dateGroups.length === 1 ? "date" : "dates"} recorded
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <p className="text-xs sm:text-sm font-bold text-rose-600">
                            ₹{staff.totalAmount.toLocaleString("en-IN")}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium">Total Staff Outflow</p>
                        </div>
                        <div
                          className={`size-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                            isStaffCollapsed ? "-rotate-90" : "rotate-0"
                          }`}
                        >
                          <ChevronDown className="size-4" />
                        </div>
                      </div>
                    </button>

                    {/* Staff Group Content: Nested Date Sub-sections */}
                    {!isStaffCollapsed && (
                      <div className="p-3 sm:p-4 space-y-3 border-t border-slate-100 bg-slate-50/20 rounded-b-2xl">
                        {staff.dateGroups.map((dateGroup) => {
                          const dateKeyId = `${staff.staffName}__${dateGroup.dateKey}`;
                          const isDateCollapsed = Boolean(collapsedDates[dateKeyId]);

                          return (
                            <div
                              key={dateGroup.dateKey}
                              className="rounded-xl border border-slate-200/80 bg-white overflow-visible transition shadow-2xs"
                            >
                              {/* Date Sub-section Header */}
                              <button
                                type="button"
                                onClick={() => toggleDateCollapse(staff.staffName, dateGroup.dateKey)}
                                className="w-full flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-slate-50/80 hover:bg-slate-100/80 rounded-xl transition text-left cursor-pointer select-none"
                                aria-expanded={!isDateCollapsed}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="size-6 rounded-md bg-teal-50 text-[#0F4C5C] flex items-center justify-center shrink-0">
                                    <Calendar className="size-3.5" />
                                  </div>
                                  <span className="text-xs font-bold text-slate-800 truncate">
                                    {dateGroup.formattedDate}
                                  </span>
                                  <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {dateGroup.expenses.length}{" "}
                                    {dateGroup.expenses.length === 1 ? "item" : "items"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <span className="text-[11px] font-bold text-slate-700">
                                      ₹{dateGroup.totalAmount.toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                  <div
                                    className={`size-5 rounded flex items-center justify-center text-slate-400 transition-transform duration-200 ${
                                      isDateCollapsed ? "-rotate-90" : "rotate-0"
                                    }`}
                                  >
                                    <ChevronDown className="size-3.5" />
                                  </div>
                                </div>
                              </button>

                              {/* Individual Expense Entries under this Date */}
                              {!isDateCollapsed && (
                                <div className="divide-y divide-slate-100 px-3 py-1">
                                  {dateGroup.expenses.map((expense) => {
                                    const isMenuOpen = menuOpenId === expense.id;
                                    const isSystem = Boolean(expense.isSystemGenerated);

                                    return (
                                      <div
                                        key={expense.id}
                                        className="relative flex items-center justify-between gap-2.5 py-3 sm:py-3.5"
                                      >
                                        {/* Left: Icon & Info */}
                                        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                          <div
                                            className={`grid size-8 sm:size-9 shrink-0 place-items-center rounded-xl mt-0.5 sm:mt-0 ${
                                              isSystem
                                                ? "bg-purple-100 text-purple-700"
                                                : "bg-slate-100 text-[#0F4C5C]"
                                            }`}
                                          >
                                            {isSystem ? (
                                              <Sparkles className="size-4" />
                                            ) : (
                                              <WalletCards className="size-4" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                                {expense.title}
                                              </p>
                                              {isSystem && (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                                  System Generated
                                                </span>
                                              )}
                                            </div>

                                            <p className="mt-0.5 text-[10px] sm:text-[11px] text-slate-500 truncate">
                                              <span className="font-semibold text-[#0F4C5C]">
                                                {expense.category}
                                              </span>{" "}
                                              · {expense.paymentMethod}
                                            </p>

                                            {expense.notes && (
                                              <p className="mt-1 text-[10px] text-slate-600 bg-slate-50 border border-slate-100/90 rounded-md px-2 py-0.5 inline-block max-w-full truncate">
                                                {expense.notes}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        {/* Right: Amount + 3-dots Menu Button */}
                                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                          <p className="text-xs sm:text-sm font-bold text-rose-600">
                                            ₹{Number(expense.amount).toLocaleString("en-IN")}
                                          </p>

                                          {/* 3-dots Action Button */}
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuOpenId(isMenuOpen ? null : expense.id);
                                              }}
                                              className="size-9 sm:size-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#0F4C5C] hover:bg-slate-100 active:bg-slate-200 transition"
                                              aria-label={`Actions for ${expense.title}`}
                                              title="Actions"
                                            >
                                              <MoreVertical className="size-4" />
                                            </button>

                                            {/* Action Menu Popover */}
                                            {isMenuOpen && (
                                              <div
                                                ref={menuRef}
                                                className="absolute right-0 top-10 z-30 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setMenuOpenId(null);
                                                    setEditingExpense(expense);
                                                  }}
                                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0F4C5C] rounded-xl transition min-h-[40px]"
                                                >
                                                  <Pencil className="size-3.5 text-slate-500" />
                                                  <span>Edit Expense</span>
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setMenuOpenId(null);
                                                    setDeletingExpense(expense);
                                                  }}
                                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition min-h-[40px]"
                                                >
                                                  <Trash2 className="size-3.5 text-rose-600" />
                                                  <span>Delete</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Expense Distribution Panel (Unchanged) */}
        <section className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 sm:p-6 shadow-xs h-fit">
          <p className="text-xs sm:text-sm font-bold text-[#0F4C5C]">Expense Distribution</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Operational cost allocation by category</p>

          <div className="mt-5 space-y-3">
            {[
              "Staff / Ironing Labour",
              "Staff / Washing Labour",
              "Supplies",
              "Utilities",
              "Rent",
              "Wages",
              "Maintenance",
              "Transport",
              "Other",
            ].map((cat) => {
              const catTotal = apiExpenses
                .filter((e) => e.category.toLowerCase() === cat.toLowerCase())
                .reduce((sum, e) => sum + Number(e.amount || 0), 0);
              const percentage =
                totalExpenseAmount > 0 ? Math.round((catTotal / totalExpenseAmount) * 100) : 0;
              if (catTotal === 0 && cat.includes("Labour")) return null;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-medium">
                    <span>{cat}</span>
                    <span>
                      ₹{catTotal.toLocaleString("en-IN")} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#0F4C5C] rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Add / Edit Expense Modal */}
      {(showExpenseModal || editingExpense) && (
        <ExpenseModal
          initialExpense={editingExpense}
          onClose={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
          onSave={(expenseData) => {
            if (editingExpense) {
              updateExpenseMutation.mutate({
                id: editingExpense.id,
                title: expenseData.title,
                category: expenseData.category,
                amount: expenseData.amount,
                paymentMethod: expenseData.method,
                expenseDate: new Date(`${expenseData.date}T12:00:00Z`).toISOString(),
                notes: expenseData.notes,
              });
            } else {
              createExpenseMutation.mutate({
                title: expenseData.title,
                category: expenseData.category,
                amount: expenseData.amount,
                paymentMethod: expenseData.method,
                expenseDate: new Date(`${expenseData.date}T12:00:00Z`).toISOString(),
                notes: expenseData.notes,
              });
            }
          }}
          isSubmitting={createExpenseMutation.isPending || updateExpenseMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingExpense && (
        <DeleteConfirmModal
          expense={deletingExpense}
          onClose={() => setDeletingExpense(null)}
          onConfirm={() => {
            deleteExpenseMutation.mutate({ id: deletingExpense.id });
          }}
          isDeleting={deleteExpenseMutation.isPending}
        />
      )}
    </div>
  );
}

function ExpenseModal({
  initialExpense,
  onClose,
  onSave,
  isSubmitting,
}: {
  initialExpense?: Expense | null;
  onClose: () => void;
  onSave: (expense: { title: string; category: string; amount: number; date: string; method: string; notes?: string }) => void;
  isSubmitting?: boolean;
}) {
  const isEditing = Boolean(initialExpense);
  const [title, setTitle] = useState(initialExpense?.title || "");
  const [category, setCategory] = useState(initialExpense?.category || "Supplies");
  const [amount, setAmount] = useState(initialExpense?.amount ? String(initialExpense.amount) : "");
  const [method, setMethod] = useState(initialExpense?.paymentMethod || "Cash");
  const [date, setDate] = useState(() => {
    if (initialExpense?.expenseDate) {
      return new Date(initialExpense.expenseDate).toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState(initialExpense?.notes || "");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Add an expense name first.");
      return;
    }
    const num = Number(amount);
    if (!amount || isNaN(num) || num <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }
    onSave({
      title: title.trim(),
      category,
      amount: num,
      date,
      method,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-3 sm:p-4 backdrop-blur-sm min-h-screen"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 id="expense-modal-title" className="font-display text-base sm:text-lg font-bold text-[#0F4C5C]">
            {isEditing ? "Edit Expense" : "Add an Expense"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-[11px] sm:text-xs text-slate-500">
          {isEditing
            ? "Update this expense entry to keep your financial logs and net profit accurate."
            : "Record shop costs so your revenue and net balance stay accurate."}
        </p>

        <form onSubmit={handleSave} className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-700">Expense Title *</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs outline-none focus:border-[#0F4C5C] focus:ring-2 focus:ring-[#0F4C5C]/20"
              placeholder="e.g. Detergent supplies, Electricity bill, Murugan Wages"
              required
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-700">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-[#0F4C5C]"
              >
                <option>Supplies</option>
                <option>Wages</option>
                <option>Utilities</option>
                <option>Rent</option>
                <option>Maintenance</option>
                <option>Transport</option>
                <option>Other</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-700">Amount (₹) *</span>
              <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 focus-within:border-[#0F4C5C]">
                <span className="text-xs text-slate-400 font-bold">₹</span>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full bg-transparent px-2 py-2.5 text-xs outline-none font-bold text-slate-800"
                  placeholder="0"
                  required
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-700">Payment Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-[#0F4C5C]"
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Bank transfer</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-700">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-[#0F4C5C]"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Notes <span className="font-normal normal-case text-slate-400">(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[58px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-[#0F4C5C]"
              placeholder="Add details or vendor name..."
            />
          </label>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto flex-1 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C5C] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0F4C5C]/90 active:scale-[.98] transition min-h-[44px]"
            >
              <Check className="size-4" /> {isEditing ? "Update Expense" : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  expense,
  onClose,
  onConfirm,
  isDeleting,
}: {
  expense: Expense;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-3 sm:p-4 backdrop-blur-sm min-h-screen">
      <div className="w-full max-w-sm rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <Trash2 className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Move to Recycle Bin?</h3>
            <p className="text-xs text-slate-500">This item will be moved to the Recycle Bin and can be restored later.</p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
          <p className="font-bold text-slate-800">{expense.title}</p>
          <p className="text-slate-500 text-[11px]">
            {expense.category} · ₹{Number(expense.amount).toLocaleString("en-IN")} · {expense.paymentMethod}
          </p>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs active:scale-95 min-h-[44px]"
          >
            <Trash2 className="size-4" /> {isDeleting ? "Moving..." : "Move to Recycle Bin"}
          </button>
        </div>
      </div>
    </div>
  );
}
