import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { buildBillText, getSmsUri, getWhatsAppUri, BillOrder } from "@/lib/billText";
import {
  FileText,
  Search,
  Download,
  Eye,
  Trash2,
  Phone,
  Calendar,
  Share2,
  MessageSquare,
  CheckCircle2,
  X,
  ChevronDown,
  Check,
  Send,
  Copy,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  Received: "bg-amber-100 text-amber-800 border-amber-200",
  Processing: "bg-blue-100 text-blue-800 border-blue-200",
  Ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Collected: "bg-slate-100 text-slate-700 border-slate-200",
};

export type DateFilterOption =
  | "all"
  | "today"
  | "yesterday"
  | "7_days"
  | "this_month"
  | "last_month"
  | "custom";

/**
 * Returns YYYY-MM-DD string in Asia/Kolkata (IST) timezone.
 */
function toISTDateString(d: Date | string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

/**
 * Returns today's YYYY-MM-DD in IST.
 */
function getTodayIST(): string {
  return toISTDateString(new Date());
}

/**
 * Returns yesterday's YYYY-MM-DD in IST.
 */
function getYesterdayIST(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISTDateString(d);
}

export default function BillsView({ onNewOrder }: { onNewOrder: () => void }) {
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery();
  const utils = trpc.useUtils();
  const { canDelete } = useAccessControl();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Sheets
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [shareOrder, setShareOrder] = useState<any | null>(null);
  const [smsQueueOrders, setSmsQueueOrders] = useState<any[] | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<{
    type: "status" | "paid";
    status?: "Received" | "Processing" | "Ready" | "Collected";
    ids: string[];
  } | null>(null);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, searchQuery, dateFilter, customFromDate, customToDate]);

  // Mutations
  const bulkUpdateStatusMutation = trpc.orders.bulkUpdateStatus.useMutation({
    onSuccess: async (_data: { count: number; ids: string[] }, variables: { ids: string[]; status: any }) => {
      await utils.orders.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(`Updated status to ${variables.status} for ${variables.ids.length} bills`);
      setSelectedIds([]);
      setBulkConfirmAction(null);
    },
    onError: (err: Error) => toast.error("Failed to update status", { description: err.message }),
  });

  const bulkMarkAsPaidMutation = trpc.orders.bulkMarkAsPaid.useMutation({
    onSuccess: async (_data: { count: number; ids: string[] }, variables: { ids: string[] }) => {
      await utils.orders.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(`Marked ${variables.ids.length} bills as Paid in Full`);
      setSelectedIds([]);
      setBulkConfirmAction(null);
    },
    onError: (err: Error) => toast.error("Failed to update payments", { description: err.message }),
  });

  // Date filtering logic (IST based)
  const filteredOrders = useMemo(() => {
    const todayYMD = getTodayIST();
    const yesterdayYMD = getYesterdayIST();

    // 7 days ago in IST
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
    const sevenDaysAgoYMD = toISTDateString(sevenDaysAgoDate);

    // Current month/year in IST
    const [currentYearStr, currentMonthStr] = todayYMD.split("-");
    const currentYearMonth = `${currentYearStr}-${currentMonthStr}`;

    // Last month in IST
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const [lastMonthYearStr, lastMonthNumStr] = toISTDateString(lastMonthDate).split("-");
    const lastYearMonth = `${lastMonthYearStr}-${lastMonthNumStr}`;

    return orders.filter((o) => {
      // 1. Status Filter
      if (statusFilter !== "All" && o.status !== statusFilter) {
        return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q) ||
          (o.items && o.items.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // 3. Date Filter (IST)
      const orderYMD = toISTDateString(o.createdAt);
      if (!orderYMD) return true;

      if (dateFilter === "today") {
        return orderYMD === todayYMD;
      }
      if (dateFilter === "yesterday") {
        return orderYMD === yesterdayYMD;
      }
      if (dateFilter === "7_days") {
        return orderYMD >= sevenDaysAgoYMD && orderYMD <= todayYMD;
      }
      if (dateFilter === "this_month") {
        return orderYMD.startsWith(currentYearMonth);
      }
      if (dateFilter === "last_month") {
        return orderYMD.startsWith(lastYearMonth);
      }
      if (dateFilter === "custom") {
        if (customFromDate && orderYMD < customFromDate) return false;
        if (customToDate && orderYMD > customToDate) return false;
        return true;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery, dateFilter, customFromDate, customToDate]);

  // Summary Metrics for current filtered view
  const summary = useMemo(() => {
    const totalBilled = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalCollected = filteredOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
    const totalDue = Math.max(0, totalBilled - totalCollected);
    const paidCount = filteredOrders.filter((o) => (o.totalAmount || 0) <= (o.amountPaid || 0)).length;
    return { totalBilled, totalCollected, totalDue, paidCount, count: filteredOrders.length };
  }, [filteredOrders]);

  // Selection handlers
  const isAllSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedIds.includes(o.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const handleToggleRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // SMS handler for single order
  const handleSendSingleSms = (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!order.phone || !order.phone.trim()) {
      toast.error(`Customer ${order.customer} has no mobile number.`);
      return;
    }
    const text = buildBillText(order);
    const url = getSmsUri(order.phone, text);
    window.location.href = url;
    toast.success(`Opening SMS app for ${order.customer}...`);
  };

  // Share handler for single order
  const handleShareOrder = async (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const text = buildBillText(order);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Fabric Care Bill ${order.id}`,
          text,
        });
        toast.success("Bill shared successfully!");
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return; // User canceled share sheet
        }
      }
    }

    // Fallback share modal for desktop / unsupported Web Share
    setShareOrder(order);
  };

  // Bulk SMS
  const handleTriggerBulkSms = () => {
    const selectedOrdersList = orders.filter((o) => selectedIds.includes(o.id));
    if (selectedOrdersList.length === 0) return;
    setSmsQueueOrders(selectedOrdersList);
  };

  // Date Filter Labels
  const dateFilterLabels: Record<DateFilterOption, string> = {
    all: "All Dates",
    today: "Today",
    yesterday: "Yesterday",
    "7_days": "Last 7 Days",
    this_month: "This Month",
    last_month: "Last Month",
    custom:
      customFromDate || customToDate
        ? `${customFromDate || "Start"} to ${customToDate || "Today"}`
        : "Custom Range",
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <FileText className="size-5 sm:size-6 text-[#0F4C5C]" />
            Bills & Invoices
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Full history of customer laundry bills, SMS alerts, and bulk operations
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search bill #, name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>

          {/* Date Filter Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker((prev) => !prev)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                dateFilter !== "all"
                  ? "bg-[#0F4C5C]/10 border-[#0F4C5C] text-[#0F4C5C]"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Calendar className="size-3.5 text-[#0F4C5C]" />
              <span>{dateFilterLabels[dateFilter]}</span>
              <ChevronDown className="size-3 text-slate-400" />
            </button>

            {/* Date Filter Dropdown Popover */}
            {showDatePicker && (
              <div className="absolute right-0 sm:left-0 top-11 z-40 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 text-xs">Filter by Date (IST)</span>
                  {dateFilter !== "all" && (
                    <button
                      onClick={() => {
                        setDateFilter("all");
                        setCustomFromDate("");
                        setCustomToDate("");
                        setShowDatePicker(false);
                      }}
                      className="text-[10px] text-rose-600 font-bold hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {(
                    [
                      { id: "all", label: "All Time" },
                      { id: "today", label: "Today" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "7_days", label: "Last 7 Days" },
                      { id: "this_month", label: "This Month" },
                      { id: "last_month", label: "Last Month" },
                      { id: "custom", label: "Custom Date Range" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setDateFilter(opt.id);
                        if (opt.id !== "custom") setShowDatePicker(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition font-medium text-xs ${
                        dateFilter === opt.id
                          ? "bg-[#0F4C5C] text-white font-bold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {dateFilter === opt.id && <Check className="size-3.5" />}
                    </button>
                  ))}
                </div>

                {dateFilter === "custom" && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        From Date
                      </span>
                      <input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        To Date
                      </span>
                      <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="w-full py-1.5 bg-[#0F4C5C] text-white font-bold rounded-lg text-xs mt-1"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New Order Button */}
          <button
            onClick={onNewOrder}
            className="px-4 py-2 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            + New Order
          </button>
        </div>
      </div>

      {/* Filter Tabs & Summary Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* Status Pills */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
          {["All", "Received", "Processing", "Ready", "Collected"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#0F4C5C] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Filter Summary Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="font-bold text-slate-800">{summary.count} bills</span>
          <span>·</span>
          <span>₹{summary.totalBilled.toLocaleString("en-IN")} billed</span>
          <span>·</span>
          <span className="text-emerald-600 font-bold">
            ₹{summary.totalCollected.toLocaleString("en-IN")} paid
          </span>
          {summary.totalDue > 0 && (
            <>
              <span>·</span>
              <span className="text-rose-600 font-bold">
                ₹{summary.totalDue.toLocaleString("en-IN")} due
              </span>
            </>
          )}

          {dateFilter !== "all" && (
            <button
              onClick={() => {
                setDateFilter("all");
                setCustomFromDate("");
                setCustomToDate("");
              }}
              className="ml-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-bold text-[10px] flex items-center gap-1"
            >
              <X className="size-3" /> Clear date
            </button>
          )}
        </div>
      </div>

      {/* FEATURE 1: Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-30 bg-[#0F4C5C] text-white p-3 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 border border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="size-7 rounded-full bg-white/20 grid place-items-center font-bold text-xs">
              {selectedIds.length}
            </span>
            <span className="font-bold text-xs sm:text-sm">
              {selectedIds.length} {selectedIds.length === 1 ? "bill" : "bills"} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Change Dropdown Menu */}
            <div className="relative group">
              <select
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value as any;
                  if (val) {
                    setBulkConfirmAction({
                      type: "status",
                      status: val,
                      ids: selectedIds,
                    });
                    e.target.value = "";
                  }
                }}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="" disabled className="text-slate-800">
                  Change Status ▾
                </option>
                <option value="Received" className="text-slate-800">
                  Move to Received
                </option>
                <option value="Processing" className="text-slate-800">
                  Move to Processing
                </option>
                <option value="Ready" className="text-slate-800">
                  Move to Ready
                </option>
                <option value="Collected" className="text-slate-800">
                  Move to Collected
                </option>
              </select>
            </div>

            {/* Mark as Paid Button */}
            <button
              onClick={() => {
                setBulkConfirmAction({
                  type: "paid",
                  ids: selectedIds,
                });
              }}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
            >
              <CheckCircle2 className="size-3.5" /> Mark as Paid
            </button>

            {/* Bulk SMS Queue Button */}
            <button
              onClick={handleTriggerBulkSms}
              className="px-3 py-1.5 bg-white text-[#0F4C5C] hover:bg-slate-100 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
            >
              <Send className="size-3.5" /> Send SMS Queue
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white/90 rounded-xl text-xs font-medium transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Content (Table / Cards) */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading invoices...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200/80 shadow-xs">
          <FileText className="size-10 sm:size-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm sm:text-base font-bold text-slate-700">No bills found</p>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query, status tab, or date range filter
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards View (< md) */}
          <div className="grid gap-3 grid-cols-1 md:hidden">
            {filteredOrders.map((order) => {
              const isSelected = selectedIds.includes(order.id);
              const dueAmount = Math.max(0, order.totalAmount - order.amountPaid);
              const orderDateIST = toISTDateString(order.createdAt);

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 cursor-pointer transition active:bg-slate-50 relative ${
                    isSelected
                      ? "border-[#0F4C5C] ring-2 ring-[#0F4C5C]/20 bg-[#0F4C5C]/5"
                      : "border-slate-200 hover:border-[#0F4C5C]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {/* Row Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleRow(order.id, e as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="size-4 mt-0.5 rounded text-[#0F4C5C] focus:ring-[#0F4C5C] cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#0F4C5C]">
                            {order.id}
                          </span>
                          <span className="text-[10px] text-slate-400">{orderDateIST}</span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mt-0.5">{order.customer}</h3>
                        <a
                          href={`tel:${order.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-[#0F4C5C] hover:underline flex items-center gap-1 mt-0.5"
                          title="Tap to call customer"
                        >
                          <Phone className="size-3" /> {order.phone}
                        </a>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full border shrink-0 ${
                        statusStyles[order.status]
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 font-medium">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Garments:</span>
                    <p className="truncate">{order.items}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs gap-2">
                    <div>
                      <span className="text-slate-500 text-[11px]">Total: </span>
                      <strong className="text-slate-800 font-bold">{order.amount}</strong>
                      <span className="ml-2">
                        {dueAmount > 0 ? (
                          <span className="text-rose-600 font-bold text-[11px]">₹{dueAmount} due</span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">Paid</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleSendSingleSms(order, e)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                        title="Send SMS"
                      >
                        <MessageSquare className="size-3.5 text-[#0F4C5C]" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleShareOrder(order, e)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                        title="Share Bill"
                      >
                        <Share2 className="size-3.5 text-[#0F4C5C]" />
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 bg-slate-100 text-[#0F4C5C] font-bold rounded-lg text-[11px] flex items-center gap-1"
                      >
                        <Eye className="size-3" /> View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        className="size-4 rounded text-[#0F4C5C] focus:ring-[#0F4C5C] cursor-pointer"
                        title="Select All Displayed"
                      />
                    </th>
                    <th className="py-3 px-3">Bill # & Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Garments / Items</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const isSelected = selectedIds.includes(order.id);
                    const dueAmount = Math.max(0, order.totalAmount - order.amountPaid);
                    const orderDateIST = toISTDateString(order.createdAt);

                    return (
                      <tr
                        key={order.id}
                        className={`transition cursor-pointer ${
                          isSelected ? "bg-[#0F4C5C]/5" : "hover:bg-slate-50/60"
                        }`}
                        onClick={() => handleToggleRow(order.id)}
                      >
                        <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(order.id)}
                            className="size-4 rounded text-[#0F4C5C] focus:ring-[#0F4C5C] cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono font-bold text-[#0F4C5C] block">{order.id}</span>
                          <span className="text-[10px] text-slate-400 block">{orderDateIST}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{order.customer}</p>
                          <p className="text-slate-400 text-[10px]">{order.phone}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-[220px] truncate">
                          {order.items}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{order.amount}</td>
                        <td className="py-3.5 px-4 font-medium">
                          {dueAmount > 0 ? (
                            <span className="text-rose-600 font-bold">₹{dueAmount} due</span>
                          ) : (
                            <span className="text-emerald-600 font-bold">Paid</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                              statusStyles[order.status]
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            {/* Send SMS Button */}
                            <button
                              onClick={(e) => handleSendSingleSms(order, e)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-[#0F4C5C] font-semibold rounded-lg transition text-[11px]"
                              title="Send Bill via SMS"
                            >
                              <MessageSquare className="size-3.5" />
                            </button>

                            {/* Share Button */}
                            <button
                              onClick={(e) => handleShareOrder(order, e)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-[#0F4C5C] font-semibold rounded-lg transition text-[11px]"
                              title="Share Bill (WhatsApp / WebShare)"
                            >
                              <Share2 className="size-3.5" />
                            </button>

                            {/* View Button */}
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="px-2.5 py-1.5 bg-slate-100 text-[#0F4C5C] font-semibold rounded-lg hover:bg-slate-200 transition text-[11px] inline-flex items-center gap-1"
                            >
                              <Eye className="size-3.5" /> View
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
        </>
      )}

      {/* Confirmation Modal for Bulk Actions */}
      {bulkConfirmAction && (
        <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0F4C5C]">
              {bulkConfirmAction.type === "status"
                ? `Move ${bulkConfirmAction.ids.length} Bills to ${bulkConfirmAction.status}?`
                : `Mark ${bulkConfirmAction.ids.length} Bills as Paid in Full?`}
            </h3>
            <p className="text-xs text-slate-500">
              {bulkConfirmAction.type === "status"
                ? `This will update the order status to "${bulkConfirmAction.status}" for all ${bulkConfirmAction.ids.length} selected bills.`
                : `This will settle the outstanding dues and mark all ${bulkConfirmAction.ids.length} selected bills as Paid.`}
            </p>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setBulkConfirmAction(null)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  bulkUpdateStatusMutation.isPending || bulkMarkAsPaidMutation.isPending
                }
                onClick={() => {
                  if (bulkConfirmAction.type === "status" && bulkConfirmAction.status) {
                    bulkUpdateStatusMutation.mutate({
                      ids: bulkConfirmAction.ids,
                      status: bulkConfirmAction.status,
                    });
                  } else if (bulkConfirmAction.type === "paid") {
                    bulkMarkAsPaidMutation.mutate({
                      ids: bulkConfirmAction.ids,
                    });
                  }
                }}
                className="flex-1 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs disabled:opacity-50"
              >
                {bulkUpdateStatusMutation.isPending || bulkMarkAsPaidMutation.isPending
                  ? "Updating..."
                  : "Confirm & Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 3: Bulk SMS Queue Modal */}
      {smsQueueOrders && smsQueueOrders.length > 0 && (
        <BulkSmsQueueModal
          orders={smsQueueOrders}
          onClose={() => setSmsQueueOrders(null)}
        />
      )}

      {/* FEATURE 4: Fallback Share Sheet Modal */}
      {shareOrder && (
        <ShareBillModal order={shareOrder} onClose={() => setShareOrder(null)} />
      )}

      {/* Bill Details Modal */}
      {selectedOrder && (
        <BillDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onShare={() => {
            const order = selectedOrder;
            setSelectedOrder(null);
            handleShareOrder(order);
          }}
          onSendSms={() => {
            const order = selectedOrder;
            handleSendSingleSms(order);
          }}
        />
      )}
    </div>
  );
}

/**
 * FEATURE 3: Bulk SMS Queue Modal
 * Allows stepping through multiple bills sequentially.
 */
function BulkSmsQueueModal({
  orders,
  onClose,
}: {
  orders: any[];
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentOrder = orders[currentIndex];
  const isLast = currentIndex >= orders.length - 1;
  const billText = currentOrder ? buildBillText(currentOrder) : "";

  const handleSendAndNext = () => {
    if (!currentOrder.phone || !currentOrder.phone.trim()) {
      toast.error(`Customer ${currentOrder.customer} has no phone number.`);
    } else {
      const url = getSmsUri(currentOrder.phone, billText);
      window.location.href = url;
    }

    if (!isLast) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      toast.success("Completed SMS queue!");
      onClose();
    }
  };

  const handleSkip = () => {
    if (!isLast) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0F4C5C]">Send SMS Queue</h3>
            <p className="text-[11px] text-slate-500">
              Bill {currentIndex + 1} of {orders.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0F4C5C] transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / orders.length) * 100}%` }}
          />
        </div>

        {/* Current Order Summary */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-mono font-bold text-[#0F4C5C]">{currentOrder.id}</span>
            <span className="font-bold text-slate-800">{currentOrder.amount}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-semibold text-slate-800">{currentOrder.customer}</span>
            <span className="font-mono">{currentOrder.phone || "No phone"}</span>
          </div>
        </div>

        {/* Preview of message */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Message Preview:</span>
          <pre className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono whitespace-pre-wrap text-slate-700 max-h-36 overflow-y-auto">
            {billText}
          </pre>
        </div>

        <div className="pt-2 flex gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 py-2.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
          >
            {isLast ? "Close" : "Skip"}
          </button>
          <button
            type="button"
            onClick={handleSendAndNext}
            className="flex-1 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5"
          >
            <Send className="size-3.5" />
            {isLast ? "Send & Finish" : "Send & Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * FEATURE 4: Share Bill Modal (Fallback for Desktop / Browsers without Web Share API)
 */
function ShareBillModal({
  order,
  onClose,
}: {
  order: any;
  onClose: () => void;
}) {
  const billText = buildBillText(order);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(billText);
      toast.success("Bill text copied to clipboard!");
      onClose();
    } catch {
      toast.error("Could not copy text to clipboard.");
    }
  };

  const handleWhatsApp = () => {
    const url = getWhatsAppUri(order.phone, billText);
    window.open(url, "_blank");
    onClose();
  };

  const handleSms = () => {
    if (!order.phone) {
      toast.error("Customer has no phone number on record.");
      return;
    }
    const url = getSmsUri(order.phone, billText);
    window.location.href = url;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0F4C5C]">Share Bill</h3>
            <p className="text-[11px] text-slate-500">Bill {order.id} · {order.customer}</p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2">
          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 text-xs font-bold transition flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="size-4 text-emerald-600" /> Share on WhatsApp
            </span>
            <ExternalLink className="size-3.5 text-emerald-600" />
          </button>

          {/* Copy Plain Text */}
          <button
            onClick={handleCopyText}
            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Copy className="size-4 text-[#0F4C5C]" /> Copy Receipt Text
            </span>
            <Check className="size-3.5 text-slate-400" />
          </button>

          {/* Regular SMS */}
          <button
            onClick={handleSms}
            className="w-full p-3 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100/70 text-sky-800 text-xs font-bold transition flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Send className="size-4 text-sky-600" /> Send via SMS
            </span>
            <ExternalLink className="size-3.5 text-sky-600" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Bill Details Modal with Download, SMS, and Share buttons
 */
function BillDetailsModal({
  order,
  onClose,
  onShare,
  onSendSms,
}: {
  order: any;
  onClose: () => void;
  onShare: () => void;
  onSendSms: () => void;
}) {
  const { canDelete } = useAccessControl();
  const utils = trpc.useUtils();
  const dueAmount = Math.max(0, order.totalAmount - order.amountPaid);
  const orderDateIST = toISTDateString(order.createdAt);

  const deleteOrderMutation = trpc.orders.delete.useMutation({
    onSuccess: async () => {
      await utils.orders.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(`Bill ${order.id} deleted`);
      onClose();
    },
    onError: (err) => toast.error("Failed to delete bill", { description: err.message }),
  });

  const handleDelete = () => {
    if (!canDelete) {
      toast.error("Permission Denied", {
        description: "Staff role is restricted from deleting bills. Contact an Admin or Manager.",
      });
      return;
    }
    if (confirm(`Are you sure you want to delete Bill ${order.id}? This action cannot be undone.`)) {
      deleteOrderMutation.mutate({ id: order.id });
    }
  };

  const handleDownloadReceipt = () => {
    const receiptHtml = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fabric Care Receipt ${order.id}</title>
  <style>
    body { margin:0; background:#f8fafc; color:#0f172a; font:14px Arial,sans-serif; }
    .receipt { width:100%; max-width:580px; margin:24px auto; background:#fff; padding:28px; border-radius:16px; border:1px solid #e2e8f0; }
    .brand { color:#0F4C5C; font-size:22px; font-weight:700; }
    .muted { color:#64748b; font-size:12px; }
    .rule { border:0; border-top:1px solid #e2e8f0; margin:20px 0; }
    .row { display:flex; justify-space-between; padding:8px 0; font-size:13px; }
    .value { font-weight:700; text-align:right; }
    .footer { margin-top:24px; color:#64748b; font-size:11px; text-align:center; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">Fabric Care</div>
    <div class="muted">Laundry & Dry Cleaning Operations</div>
    <hr class="rule">
    <div class="row"><span class="muted">Bill #</span><span class="value">${order.id}</span></div>
    <div class="row"><span class="muted">Date</span><span class="value">${orderDateIST}</span></div>
    <div class="row"><span class="muted">Customer</span><span class="value">${order.customer}</span></div>
    <div class="row"><span class="muted">Phone</span><span class="value">${order.phone}</span></div>
    <div class="row"><span class="muted">Garments</span><span class="value">${order.items}</span></div>
    <div class="row"><span class="muted">Status</span><span class="value">${order.status}</span></div>
    <hr class="rule">
    <div class="row"><span class="muted">Total Amount</span><span class="value">${order.amount}</span></div>
    <div class="row"><span class="muted">Amount Paid</span><span class="value">₹${order.amountPaid}</span></div>
    <div class="row"><span class="muted">Balance Due</span><span class="value" style="color:${dueAmount > 0 ? '#e11d48' : '#059669'}">₹${dueAmount}</span></div>
    <div class="footer">Thank you for trusting Fabric Care!</div>
  </div>
</body>
</html>`;

    const blob = new Blob([receiptHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fabric-care-${order.id.toLowerCase()}-receipt.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded successfully");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F4C5C]/50 backdrop-blur-sm p-3 sm:p-6 flex justify-center items-center min-h-screen">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#0F4C5C]">{order.id}</span>
              <span className="text-[10px] text-slate-400 font-medium">{orderDateIST}</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">{order.customer}</h3>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Phone</span>
              <p className="font-bold text-slate-700 mt-0.5">{order.phone || "No phone"}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Status</span>
              <p className="font-bold text-[#0F4C5C] mt-0.5">{order.status}</p>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Garments List</span>
            <p className="font-medium text-slate-700">{order.items}</p>
          </div>

          <div className="bg-[#0F4C5C]/5 p-4 rounded-xl border border-[#0F4C5C]/20 space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span>Total Bill Amount:</span>
              <span className="font-bold text-slate-800 text-sm">{order.amount}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Advance Paid:</span>
              <span className="font-bold text-emerald-600">₹{order.amountPaid}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#0F4C5C]/15">
              <span className="font-bold text-slate-800">Remaining Balance:</span>
              <span className={`font-bold text-sm ${dueAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {dueAmount > 0 ? `₹${dueAmount}` : "Paid in Full"}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50 flex flex-wrap gap-2 justify-end shrink-0">
          <button
            onClick={onSendSms}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5"
          >
            <MessageSquare className="size-3.5 text-[#0F4C5C]" /> Send SMS
          </button>
          <button
            onClick={onShare}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5"
          >
            <Share2 className="size-3.5 text-[#0F4C5C]" /> Share
          </button>
          <button
            onClick={handleDownloadReceipt}
            className="px-3 py-2 bg-[#0F4C5C] text-white font-bold rounded-xl text-xs hover:bg-[#0F4C5C]/90 transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="size-3.5" /> Download
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteOrderMutation.isPending || !canDelete}
            className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs hover:bg-rose-100 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
