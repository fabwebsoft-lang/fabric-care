import { useState, useMemo } from "react";
import { trpc, type RecycleBinItem, type RecycleBinItemType } from "@/lib/trpc";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  ClipboardList,
  UsersRound,
  WalletCards,
  Calendar,
  User,
  Phone,
  Layers,
  ArrowUpDown,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function RecycleBinView() {
  const { role, canDelete } = useAccessControl();
  const utils = trpc.useUtils();

  const { data: items = [], isLoading } = trpc.recycleBin.list.useQuery();
  const { data: counts = { total: 0, orders: 0, customers: 0, expenses: 0 } } = trpc.recycleBin.counts.useQuery();

  const [activeTab, setActiveTab] = useState<"all" | "order" | "customer" | "expense">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "type">("recent");

  // Confirmation Modals State
  const [itemToRestore, setItemToRestore] = useState<RecycleBinItem | null>(null);
  const [itemToDeleteForever, setItemToDeleteForever] = useState<RecycleBinItem | null>(null);
  const [showEmptyBinModal, setShowEmptyBinModal] = useState(false);

  // Mutations
  const restoreMutation = trpc.recycleBin.restore.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || "Item restored successfully");
      setItemToRestore(null);
    },
    onError: (err) => {
      toast.error("Failed to restore item", { description: err.message });
    },
  });

  const deleteForeverMutation = trpc.recycleBin.deleteForever.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || "Item permanently deleted");
      setItemToDeleteForever(null);
    },
    onError: (err) => {
      toast.error("Failed to permanently delete", { description: err.message });
    },
  });

  const emptyBinMutation = trpc.recycleBin.emptyBin.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || "Recycle bin emptied");
      setShowEmptyBinModal(false);
    },
    onError: (err) => {
      toast.error("Failed to empty recycle bin", { description: err.message });
    },
  });

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Tab Filter
        if (activeTab !== "all" && item.recordType !== activeTab) return false;

        // Search Filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.id.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          (item.customerName && item.customerName.toLowerCase().includes(q)) ||
          (item.phone && item.phone.toLowerCase().includes(q)) ||
          (item.itemsSummary && item.itemsSummary.toLowerCase().includes(q)) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          (item.deletedBy && item.deletedBy.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === "recent") {
          return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
        }
        if (sortBy === "type") {
          return a.recordType.localeCompare(b.recordType);
        }
        return 0;
      });
  }, [items, activeTab, searchQuery, sortBy]);

  const handleRestoreConfirm = () => {
    if (!itemToRestore) return;
    restoreMutation.mutate({ type: itemToRestore.recordType, id: itemToRestore.id });
  };

  const handleDeleteForeverConfirm = () => {
    if (!itemToDeleteForever) return;
    deleteForeverMutation.mutate({ type: itemToDeleteForever.recordType, id: itemToDeleteForever.id });
  };

  const handleEmptyBinConfirm = () => {
    emptyBinMutation.mutate({ type: activeTab });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <Trash2 className="size-5 sm:size-6 text-[#0F4C5C]" />
            Recycle Bin
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Deleted items are stored here until they are permanently deleted or restored.
          </p>
        </div>

        {counts.total > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowEmptyBinModal(true)}
              disabled={emptyBinMutation.isPending || !canDelete}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Permanently remove all items in the recycle bin"
            >
              <Trash2 className="size-4" />
              Empty Recycle Bin
            </button>
          </div>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Total Deleted */}
        <div
          onClick={() => setActiveTab("all")}
          className={`cursor-pointer rounded-2xl border p-3.5 sm:p-4 transition ${
            activeTab === "all"
              ? "bg-[#0F4C5C]/5 border-[#0F4C5C]/40 ring-2 ring-[#0F4C5C]/20 shadow-xs"
              : "border-slate-200/80 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Deleted
            </span>
            <span className="size-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Layers className="size-3.5" />
            </span>
          </div>
          <p className="font-display text-xl sm:text-2xl font-bold text-[#0F4C5C] mt-1">
            {counts.total}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">All recyclable items</p>
        </div>

        {/* Orders */}
        <div
          onClick={() => setActiveTab("order")}
          className={`cursor-pointer rounded-2xl border p-3.5 sm:p-4 transition ${
            activeTab === "order"
              ? "bg-blue-50 border-blue-400 ring-2 ring-blue-200 shadow-xs"
              : "border-slate-200/80 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Orders / Bills
            </span>
            <span className="size-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <ClipboardList className="size-3.5" />
            </span>
          </div>
          <p className="font-display text-xl sm:text-2xl font-bold text-blue-800 mt-1">
            {counts.orders}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Deleted laundry orders</p>
        </div>

        {/* Customers */}
        <div
          onClick={() => setActiveTab("customer")}
          className={`cursor-pointer rounded-2xl border p-3.5 sm:p-4 transition ${
            activeTab === "customer"
              ? "bg-amber-50 border-amber-400 ring-2 ring-amber-200 shadow-xs"
              : "border-slate-200/80 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Customers
            </span>
            <span className="size-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <UsersRound className="size-3.5" />
            </span>
          </div>
          <p className="font-display text-xl sm:text-2xl font-bold text-amber-800 mt-1">
            {counts.customers}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Quarantined client accounts</p>
        </div>

        {/* Expenses */}
        <div
          onClick={() => setActiveTab("expense")}
          className={`cursor-pointer rounded-2xl border p-3.5 sm:p-4 transition ${
            activeTab === "expense"
              ? "bg-purple-50 border-purple-400 ring-2 ring-purple-200 shadow-xs"
              : "border-slate-200/80 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-purple-700 uppercase tracking-wider">
              Expenses
            </span>
            <span className="size-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <WalletCards className="size-3.5" />
            </span>
          </div>
          <p className="font-display text-xl sm:text-2xl font-bold text-purple-800 mt-1">
            {counts.expenses}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Deleted expense vouchers</p>
        </div>
      </div>

      {/* Filter Tabs, Search & Sort Toolbar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "all"
                ? "bg-[#0F4C5C] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("order")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "order"
                ? "bg-[#0F4C5C] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Orders ({counts.orders})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customer")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "customer"
                ? "bg-[#0F4C5C] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Customers ({counts.customers})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expense")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "expense"
                ? "bg-[#0F4C5C] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Expenses ({counts.expenses})
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, customer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <ArrowUpDown className="size-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none pr-1 py-1"
            >
              <option value="recent">Recently Deleted</option>
              <option value="oldest">Oldest Deleted</option>
              <option value="type">Record Type</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
          Loading deleted items...
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 sm:p-16 text-center shadow-xs">
          <div className="mx-auto size-14 sm:size-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3.5 shadow-inner">
            <Trash2 className="size-7 sm:size-8" strokeWidth={1.75} />
          </div>
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-800">
            Recycle Bin is Empty
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
            Deleted items will appear here and can be restored if needed.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (lg and above) */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Record & Details</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Customer / Contact</th>
                    <th className="py-3 px-4">Amount / Dues</th>
                    <th className="py-3 px-4">Deleted Info</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    return (
                      <tr key={`${item.recordType}-${item.id}`} className="hover:bg-slate-50/60 transition">
                        {/* Title & Details */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 text-sm">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">{item.subtitle}</div>
                          )}
                          {item.itemsSummary && (
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 italic max-w-xs">
                              {item.itemsSummary}
                            </div>
                          )}
                        </td>

                        {/* Type Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              item.recordType === "order"
                                ? "bg-blue-100 text-blue-800"
                                : item.recordType === "customer"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {item.recordType === "order" && <ClipboardList className="size-3" />}
                            {item.recordType === "customer" && <UsersRound className="size-3" />}
                            {item.recordType === "expense" && <WalletCards className="size-3" />}
                            {item.recordType.toUpperCase()}
                          </span>
                        </td>

                        {/* Customer / Contact */}
                        <td className="py-3.5 px-4">
                          {item.customerName ? (
                            <div>
                              <div className="font-semibold text-slate-800">{item.customerName}</div>
                              {item.phone && (
                                <a
                                  href={`tel:${item.phone}`}
                                  className="text-[11px] text-[#0F4C5C] hover:underline inline-flex items-center gap-1 mt-0.5"
                                >
                                  <Phone className="size-3" /> {item.phone}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4">
                          {item.amount !== undefined ? (
                            <div>
                              <div className="font-bold text-slate-800">
                                ₹{Number(item.amount).toLocaleString("en-IN")}
                              </div>
                              {item.outstandingAmount !== undefined && item.outstandingAmount > 0 && (
                                <span className="text-[10px] font-semibold text-rose-600 block">
                                  ₹{item.outstandingAmount} due
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Deleted Info */}
                        <td className="py-3.5 px-4 text-[11px]">
                          <div className="text-slate-700 font-medium">
                            {new Date(item.deletedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            by <span className="font-semibold text-slate-600">{item.deletedBy}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setItemToRestore(item)}
                              disabled={restoreMutation.isPending}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-2xs active:scale-95"
                              title="Restore to active records"
                            >
                              <RotateCcw className="size-3.5" />
                              Restore
                            </button>

                            <button
                              type="button"
                              onClick={() => setItemToDeleteForever(item)}
                              disabled={deleteForeverMutation.isPending || !canDelete}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                              title="Permanently remove"
                            >
                              <Trash2 className="size-3.5" />
                              Delete Forever
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Card View (under lg) */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:hidden">
            {filteredItems.map((item) => (
              <div
                key={`${item.recordType}-${item.id}`}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                            item.recordType === "order"
                              ? "bg-blue-100 text-blue-800"
                              : item.recordType === "customer"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {item.recordType}
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm truncate">{item.title}</h4>
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.subtitle}</p>
                      )}
                    </div>

                    {item.amount !== undefined && (
                      <div className="text-right">
                        <span className="font-bold text-slate-800 text-sm">
                          ₹{Number(item.amount).toLocaleString("en-IN")}
                        </span>
                        {item.outstandingAmount !== undefined && item.outstandingAmount > 0 && (
                          <span className="text-[10px] font-semibold text-rose-600 block">
                            ₹{item.outstandingAmount} due
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Customer / Phone / Items info */}
                  <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                    {item.customerName && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Customer:</span>
                        <span className="font-semibold text-slate-800">{item.customerName}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Phone:</span>
                        <a href={`tel:${item.phone}`} className="font-medium text-[#0F4C5C] hover:underline">
                          {item.phone}
                        </a>
                      </div>
                    )}
                    {item.itemsSummary && (
                      <div className="p-2 bg-slate-50 rounded-xl text-[11px] text-slate-600 italic">
                        {item.itemsSummary}
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                      <span>
                        Deleted:{" "}
                        {new Date(item.deletedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>
                        by <strong className="text-slate-600">{item.deletedBy}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setItemToRestore(item)}
                    disabled={restoreMutation.isPending}
                    className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95 min-h-[38px]"
                  >
                    <RotateCcw className="size-3.5" /> Restore
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemToDeleteForever(item)}
                    disabled={deleteForeverMutation.isPending || !canDelete}
                    className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 min-h-[38px]"
                  >
                    <Trash2 className="size-3.5" /> Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {itemToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <RotateCcw className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Restore this item?</h3>
                <p className="text-xs text-slate-500">This item will be restored to its original location.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
              <p className="font-bold text-slate-800">{itemToRestore.title}</p>
              <p className="text-slate-500 text-[11px]">
                {itemToRestore.recordType.toUpperCase()} {itemToRestore.customerName ? `· ${itemToRestore.customerName}` : ""}
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setItemToRestore(null)}
                disabled={restoreMutation.isPending}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestoreConfirm}
                disabled={restoreMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#0F4C5C] hover:bg-[#0F4C5C]/90 text-white text-xs font-bold rounded-xl transition shadow-xs active:scale-95 min-h-[40px]"
              >
                {restoreMutation.isPending ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE FOREVER CONFIRMATION MODAL */}
      {itemToDeleteForever && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Delete permanently?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs space-y-1">
              <p className="font-bold text-slate-800">{itemToDeleteForever.title}</p>
              <p className="text-slate-500 text-[11px]">
                The selected record and its associated data will be permanently removed from the database.
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setItemToDeleteForever(null)}
                disabled={deleteForeverMutation.isPending}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteForeverConfirm}
                disabled={deleteForeverMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs active:scale-95 min-h-[40px]"
              >
                <Trash2 className="size-4" />
                {deleteForeverMutation.isPending ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPTY RECYCLE BIN CONFIRMATION MODAL */}
      {showEmptyBinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Empty Recycle Bin?</h3>
                <p className="text-xs text-slate-500">All deleted items will be permanently deleted.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              This action cannot be undone. Are you sure you want to permanently delete all {counts.total} item(s)?
            </p>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEmptyBinModal(false)}
                disabled={emptyBinMutation.isPending}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyBinConfirm}
                disabled={emptyBinMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs active:scale-95 min-h-[40px]"
              >
                <Trash2 className="size-4" />
                {emptyBinMutation.isPending ? "Deleting..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
