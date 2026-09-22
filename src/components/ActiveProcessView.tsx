import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  WashingMachine,
  CheckCircle2,
  Clock,
  PackageCheck,
  Search,
  ArrowRight,
  CreditCard,
  ChevronRight,
  Flame,
  Sparkles,
  ShoppingBag,
  Truck,
  RotateCcw,
  Check,
  Receipt,
  Phone,
  Tag,
  X,
  User,
  AlertCircle,
  IndianRupee,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderStatus } from "@/types";
import { OrderProcessTimeline } from "./OrderProcessTimeline";

const statusStyles: Record<string, string> = {
  Received: "bg-amber-100 text-amber-800 border-amber-200",
  Processing: "bg-blue-100 text-blue-800 border-blue-200",
  Ironing: "bg-purple-100 text-purple-800 border-purple-200",
  Ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Collected: "bg-slate-100 text-slate-700 border-slate-200",
};

const WORKFLOW_STEPS = [
  {
    step: 1,
    status: "Received" as OrderStatus,
    shortName: "Collect",
    title: "Collect from Customer",
    subtitle: "Garments tagged & queued",
    icon: Clock,
    color: "amber",
    badgeBg: "bg-amber-500",
    lightBg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  {
    step: 2,
    status: "Processing" as OrderStatus,
    shortName: "Wash / Dry Clean",
    title: "Start Wash / Dry Clean",
    subtitle: "Washing / Dry clean in progress",
    icon: WashingMachine,
    color: "blue",
    badgeBg: "bg-blue-500",
    lightBg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  {
    step: 3,
    status: "Ironing" as OrderStatus,
    shortName: "Ironing",
    title: "Ironing & Pressing",
    subtitle: "Steam iron & garment finishing",
    icon: Flame,
    color: "purple",
    badgeBg: "bg-purple-500",
    lightBg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
  },
  {
    step: 4,
    status: "Ready" as OrderStatus,
    shortName: "Collection / Delivery",
    title: "Shop Collection / Delivery",
    subtitle: "Ready for customer handover",
    icon: ShoppingBag,
    color: "emerald",
    badgeBg: "bg-emerald-500",
    lightBg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  {
    step: 5,
    status: "Collected" as OrderStatus,
    shortName: "Payment Settled",
    title: "Payment Settled & Delivered",
    subtitle: "Handed over & payment collected",
    icon: Truck,
    color: "slate",
    badgeBg: "bg-slate-500",
    lightBg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
  },
];

type TabType = "All" | OrderStatus;

export default function ActiveProcessView({
  onNewOrder,
  onNavigateToOrders,
  onNavigateToProducts,
}: {
  onNewOrder?: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToProducts?: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery();

  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderForPickup, setSelectedOrderForPickup] = useState<Order | null>(null);
  const [startIroningOrder, setStartIroningOrder] = useState<Order | null>(null);
  const [completeIroningOrder, setCompleteIroningOrder] = useState<Order | null>(null);

  const startIroningMutation = trpc.ironing.startIroning.useMutation({
    onSuccess: async (data) => {
      await utils.orders.list.invalidate();
      await utils.ironing.todayStats.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(data.message || "Ironing started", {
        description: `Assigned to ${data.task?.staffName} · No expense created until completion.`,
      });
      setStartIroningOrder(null);
    },
    onError: (err) => {
      toast.error("Could not start ironing", { description: err.message });
    },
  });

  const completeIroningMutation = trpc.ironing.completeIroning.useMutation({
    onSuccess: async (data) => {
      await utils.orders.list.invalidate();
      await utils.ironing.getActiveTask.invalidate();
      await utils.ironing.reports.invalidate();
      await utils.ironing.todayStats.invalidate();
      await utils.expenses.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success("Ironing Completed & Labour Expense Created", {
        description: `${data.message}`,
      });
      setCompleteIroningOrder(null);
    },
    onError: (err) => {
      toast.error("Cannot complete ironing", { description: err.message });
    },
  });

  const voidTaskMutation = trpc.ironing.voidTask.useMutation({
    onSuccess: async () => {
      await utils.ironing.todayStats.invalidate();
      await utils.orders.list.invalidate();
    },
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: async (data) => {
      await utils.orders.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(`Order ${data.id} moved to ${data.status}`);
      setSelectedOrderForPickup(null);
    },
    onError: (err) => {
      toast.error("Failed to update status", { description: err.message });
    },
  });

  const settlePaymentMutation = trpc.orders.settlePayment.useMutation({
    onSuccess: async (data) => {
      await utils.orders.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(`Payment settled for Order ${data.id}`, {
        description: `Collected remaining balance · Order completed`,
      });
      setSelectedOrderForPickup(null);
    },
    onError: (err) => {
      toast.error("Failed to settle payment", { description: err.message });
    },
  });

  // Filter orders
  const activeOrders = orders.filter((o) => o.status !== "Collected");
  const filteredOrders = orders.filter((order) => {
    // Stage Filter
    if (activeTab === "All") {
      if (order.status === "Collected") return false;
    } else {
      if (order.status !== activeTab) return false;
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.id.toLowerCase().includes(q) ||
      order.customer.toLowerCase().includes(q) ||
      order.phone.toLowerCase().includes(q) ||
      (order.customerId && order.customerId.toLowerCase().includes(q))
    );
  });

  const counts = {
    All: activeOrders.length,
    Received: orders.filter((o) => o.status === "Received").length,
    Processing: orders.filter((o) => o.status === "Processing").length,
    Ironing: orders.filter((o) => o.status === "Ironing").length,
    Ready: orders.filter((o) => o.status === "Ready").length,
    Collected: orders.filter((o) => o.status === "Collected").length,
  };

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case "Received":
        return 0;
      case "Processing":
        return 1;
      case "Ironing":
        return 2;
      case "Ready":
        return 3;
      case "Collected":
        return 4;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <WashingMachine className="size-5 sm:size-6 text-[#0F4C5C]" />
            Active Laundry Workflow
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            5-Stage Sequential Pipeline: Collect ➔ Wash / Dry Clean ➔ Ironing ➔ Shop Collection / Delivery ➔ Payment
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order # or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>
          <button
            onClick={onNewOrder}
            className="px-4 py-2 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            + New Order
          </button>
        </div>
      </div>

      {/* KPI Metric Cards: 5-Stage Sequential Flow Overview */}
      <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {/* STEP 1: Collect from Customer */}
        <div
          onClick={() => setActiveTab(activeTab === "Received" ? "All" : "Received")}
          className={`bg-white p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition ${
            activeTab === "Received"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20"
              : "border-slate-200/90 hover:border-amber-300"
          }`}
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate font-bold text-amber-800">STEP 1</span>
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
              <Clock className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-amber-700 tracking-tight">
              {counts.Received} <span className="text-xs font-normal text-slate-500">Orders</span>
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 mt-0.5 truncate">
              Collect from Customer
            </p>
            <p className="text-[9px] text-slate-400 truncate">Intake & Tagged</p>
          </div>
        </div>

        {/* STEP 2: Start Wash / Dry Clean */}
        <div
          onClick={() => setActiveTab(activeTab === "Processing" ? "All" : "Processing")}
          className={`bg-white p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition ${
            activeTab === "Processing"
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20"
              : "border-slate-200/90 hover:border-blue-300"
          }`}
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate font-bold text-blue-800">STEP 2</span>
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <WashingMachine className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-blue-700 tracking-tight">
              {counts.Processing} <span className="text-xs font-normal text-slate-500">Orders</span>
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 mt-0.5 truncate">
              Start Wash / Dry Clean
            </p>
            <p className="text-[9px] text-slate-400 truncate">In Wash & Dry Cycle</p>
          </div>
        </div>

        {/* STEP 3: Ironing */}
        <div
          onClick={() => setActiveTab(activeTab === "Ironing" ? "All" : "Ironing")}
          className={`bg-white p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition ${
            activeTab === "Ironing"
              ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20"
              : "border-slate-200/90 hover:border-purple-300"
          }`}
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate font-bold text-purple-800">STEP 3</span>
            <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
              <Sparkles className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-purple-700 tracking-tight">
              {counts.Ironing} <span className="text-xs font-normal text-slate-500">Orders</span>
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 mt-0.5 truncate">
              Ironing & Pressing
            </p>
            <p className="text-[9px] text-slate-400 truncate">Steam Press & Fold</p>
          </div>
        </div>

        {/* STEP 4: Shop Collection / Delivery */}
        <div
          onClick={() => setActiveTab(activeTab === "Ready" ? "All" : "Ready")}
          className={`bg-white p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition ${
            activeTab === "Ready"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
              : "border-slate-200/90 hover:border-emerald-300"
          }`}
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate font-bold text-emerald-800">STEP 4</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
              <PackageCheck className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700 tracking-tight">
              {counts.Ready} <span className="text-xs font-normal text-slate-500">Orders</span>
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 mt-0.5 truncate">
              Shop Collection / Delivery
            </p>
            <p className="text-[9px] text-slate-400 truncate">Ready for handover</p>
          </div>
        </div>

        {/* STEP 5: Payment Collection */}
        <div
          onClick={() => setActiveTab(activeTab === "Collected" ? "All" : "Collected")}
          className={`bg-white p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition col-span-2 sm:col-span-1 ${
            activeTab === "Collected"
              ? "border-[#0F4C5C] ring-2 ring-[#0F4C5C]/20 bg-[#0F4C5C]/5"
              : "border-slate-200/90 hover:border-[#0F4C5C]/30"
          }`}
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate font-bold text-[#0F4C5C]">STEP 5</span>
            <div className="p-1.5 bg-[#0F4C5C]/10 text-[#0F4C5C] rounded-lg shrink-0">
              <CreditCard className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-[#0F4C5C] tracking-tight">
              {counts.Collected} <span className="text-xs font-normal text-slate-500">Orders</span>
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 mt-0.5 truncate">
              Payment Collection
            </p>
            <p className="text-[9px] text-slate-400 truncate">Settled & Completed</p>
          </div>
        </div>
      </div>

      {/* Tabs - Horizontally scrollable independently with no-page-overflow containment */}
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain py-1 no-scrollbar">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap min-w-max pb-0.5">
          {[
            { key: "All" as TabType, label: "All Active", shortLabel: "All Active", count: counts.All },
            { key: "Received" as TabType, label: "1. Collect from Customer", shortLabel: "1. Collect", count: counts.Received },
            { key: "Processing" as TabType, label: "2. Wash / Dry Clean", shortLabel: "2. Wash", count: counts.Processing },
            { key: "Ironing" as TabType, label: "3. Ironing", shortLabel: "3. Iron", count: counts.Ironing },
            { key: "Ready" as TabType, label: "4. Collection / Delivery", shortLabel: "4. Delivery", count: counts.Ready },
            { key: "Collected" as TabType, label: "5. Payment Settled", shortLabel: "5. Settled", count: counts.Collected },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap active:scale-95 ${
                activeTab === tab.key
                  ? "bg-[#0F4C5C] text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
              }`}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading process board...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-3 shadow-xs">
          <div className="size-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <PackageCheck className="size-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No orders in this stage</p>
          <p className="text-xs text-slate-500">All caught up! Create a new order to start processing.</p>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => {
            const dueAmount = order.totalAmount - order.amountPaid;
            const currentStepIdx = getStepIndex(order.status);

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition space-y-3.5 sm:space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#0F4C5C]">
                          {order.id}
                        </span>
                        {order.deliveryType && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {order.deliveryType === "Home Delivery" ? (
                              <Truck className="size-2.5 text-[#0F4C5C]" />
                            ) : (
                              <ShoppingBag className="size-2.5 text-[#0F4C5C]" />
                            )}
                            {order.deliveryType}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">
                        {order.customer}
                      </p>
                      <a
                        href={`tel:${order.phone}`}
                        className="text-[11px] text-[#0F4C5C] hover:underline flex items-center gap-1 mt-0.5"
                        title="Tap to call customer"
                      >
                        <Phone className="size-2.5" />
                        {order.phone}
                      </a>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full border shrink-0 ${
                        statusStyles[order.status] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-2.5 text-xs">
                    {/* Garments / Items */}
                    <div className="bg-slate-50 p-2.5 rounded-xl text-slate-700 font-medium">
                      <span className="text-[10px] text-slate-500 block mb-0.5 font-semibold">Garments / Items:</span>
                      <p className="line-clamp-2">{order.items}</p>
                    </div>

                    {/* Visual Process Timeline between Garments and Billing */}
                    <OrderProcessTimeline
                      status={order.status}
                      createdAt={order.createdAt}
                      updatedAt={order.updatedAt}
                    />

                    {/* Billing Section */}
                    <div className="space-y-1 pt-0.5">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Total Bill:</span>
                        <span className="font-bold text-slate-800">₹{order.totalAmount}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-600">
                        <span>Balance Due:</span>
                        <span
                          className={`font-bold ${
                            dueAmount > 0 ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {dueAmount > 0 ? `₹${dueAmount}` : "Paid in Full"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions: Strictly Sequential Workflow Buttons */}
                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  {/* STEP 1 -> STEP 2 */}
                  {order.status === "Received" && (
                    <button
                      disabled={updateStatusMutation.isPending}
                      onClick={() =>
                        updateStatusMutation.mutate({ id: order.id, status: "Processing" })
                      }
                      className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                    >
                      <WashingMachine className="size-3.5" />
                      Step 2: Start Wash / Dry Clean <ArrowRight className="size-3.5" />
                    </button>
                  )}

                  {/* STEP 2 -> STEP 3 */}
                  {order.status === "Processing" && (
                    <div className="space-y-1">
                      <button
                        onClick={() => setStartIroningOrder(order)}
                        className="w-full py-2.5 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                      >
                        <Sparkles className="size-3.5" />
                        Step 3: Start Ironing & Assign Staff <ArrowRight className="size-3.5" />
                      </button>
                      <button
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({ id: order.id, status: "Received" })
                        }
                        className="w-full py-1 text-[10px] text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition"
                      >
                        <RotateCcw className="size-2.5" /> Move back to Step 1 (Intake)
                      </button>
                    </div>
                  )}

                  {/* STEP 3 -> STEP 4 */}
                  {order.status === "Ironing" && (
                    <div className="space-y-1">
                      <IroningStaffBadge orderId={order.id} />
                      <button
                        onClick={() => setCompleteIroningOrder(order)}
                        className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                      >
                        <PackageCheck className="size-3.5" />
                        Step 4: Complete Ironing & Record Labour <ArrowRight className="size-3.5" />
                      </button>
                      <button
                        disabled={updateStatusMutation.isPending || voidTaskMutation.isPending}
                        onClick={async () => {
                          await voidTaskMutation.mutateAsync({ orderId: order.id });
                          updateStatusMutation.mutate({ id: order.id, status: "Processing" });
                        }}
                        className="w-full py-1 text-[10px] text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition"
                      >
                        <RotateCcw className="size-2.5" /> Move back to Step 2 (Wash)
                      </button>
                    </div>
                  )}

                  {/* STEP 4 -> STEP 5 */}
                  {order.status === "Ready" && (
                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedOrderForPickup(order)}
                        className="w-full py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition flex items-center justify-center gap-2 shadow-xs active:scale-95"
                      >
                        <CreditCard className="size-4" />
                        Step 5: Shop Collection / Delivery & Payment
                      </button>
                      <button
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({ id: order.id, status: "Ironing" })
                        }
                        className="w-full py-1 text-[10px] text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition"
                      >
                        <RotateCcw className="size-2.5" /> Move back to Step 3 (Ironing)
                      </button>
                    </div>
                  )}

                  {/* STEP 5: COMPLETED */}
                  {order.status === "Collected" && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        Step 5: Handover & Payment Settled
                      </span>
                      <button
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({ id: order.id, status: "Ready" })
                        }
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-0.5"
                        title="Reopen order to Ready for Delivery"
                      >
                        <RotateCcw className="size-2.5" /> Reopen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Start Ironing - Assign Staff Modal */}
      {startIroningOrder && (
        <StartIroningModal
          order={startIroningOrder}
          onClose={() => setStartIroningOrder(null)}
          onStart={(orderId, staffId) =>
            startIroningMutation.mutate({ orderId, staffId })
          }
          isPending={startIroningMutation.isPending}
        />
      )}

      {/* Complete Ironing & Record Labour Modal */}
      {completeIroningOrder && (
        <CompleteIroningModal
          order={completeIroningOrder}
          onClose={() => setCompleteIroningOrder(null)}
          onComplete={(orderId, staffId, ratesOverride) =>
            completeIroningMutation.mutate({ orderId, staffId, ratesOverride })
          }
          onNavigateToProducts={onNavigateToProducts}
          isPending={completeIroningMutation.isPending}
        />
      )}

      {/* Shop Collection & Payment Collection Modal */}
      {selectedOrderForPickup && (
        <PickupModal
          order={selectedOrderForPickup}
          onClose={() => setSelectedOrderForPickup(null)}
          onSettle={(id, amountPaid, deliveryType) =>
            settlePaymentMutation.mutate({ id, amount: amountPaid, deliveryType, markCollected: true })
          }
          onCompleteWithoutPayment={(id, deliveryType) =>
            updateStatusMutation.mutate({ id, status: "Collected", deliveryType }, {
              onSuccess: () => setSelectedOrderForPickup(null),
            })
          }
          isPending={settlePaymentMutation.isPending || updateStatusMutation.isPending}
        />
      )}
    </div>
  );
}

function IroningStaffBadge({ orderId }: { orderId: string }) {
  const { data: task } = trpc.ironing.getActiveTask.useQuery(
    { orderId },
    { staleTime: 5000 }
  );

  if (!task || task.status !== "In Progress") {
    return (
      <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
        <AlertCircle className="size-3 text-amber-600 shrink-0" />
        <span>Staff assignment required on completion</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl">
      <div className="flex items-center gap-1.5 truncate">
        <User className="size-3 text-purple-600 shrink-0" />
        <span className="truncate">
          Ironing by: <strong className="font-bold">{task.staffName}</strong>
        </span>
      </div>
      <span className="text-[9px] uppercase px-1.5 py-0.2 bg-purple-200/70 text-purple-800 font-bold rounded">
        In Progress
      </span>
    </div>
  );
}

function StartIroningModal({
  order,
  onClose,
  onStart,
  isPending,
}: {
  order: Order;
  onClose: () => void;
  onStart: (orderId: string, staffId: string) => void;
  isPending: boolean;
}) {
  const { data: staffList = [], isLoading } = trpc.workers.activeStaffList.useQuery();
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      toast.error("Please select a staff member to start ironing");
      return;
    }
    onStart(order.id, selectedStaffId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-600 text-white">
                STEP 3 OF 5
              </span>
              <span className="text-[10px] font-semibold text-purple-700">IRONING STAGE</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="size-5 text-purple-600" />
              Who is doing this ironing?
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Assign an active staff member to track their ironing labour
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Order Preview */}
        <div className="bg-slate-50 p-3.5 rounded-2xl space-y-2 text-xs border border-slate-100">
          <div className="flex justify-between">
            <span className="text-slate-500">Order ID:</span>
            <span className="font-mono font-bold text-purple-800">{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-bold text-slate-800">{order.customer} ({order.phone})</span>
          </div>
          <div className="pt-1 border-t border-slate-200/70">
            <span className="text-slate-500 block mb-0.5 font-medium">Garments to Iron:</span>
            <p className="font-medium text-slate-800">{order.items}</p>
          </div>
        </div>

        {/* Staff Selection Dropdown */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Active Staff Member <span className="text-rose-500">*</span>
            </label>
            {isLoading ? (
              <div className="py-2 text-xs text-slate-400">Loading active staff...</div>
            ) : staffList.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                No active staff found. Please add or activate staff in <strong>Staff Management</strong> tab.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                  required
                >
                  <option value="">-- Choose Active Staff --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role}) {(s as any).phone ? `· ${(s as any).phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200/70 rounded-xl text-[11px] text-purple-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-purple-600 shrink-0" />
              Starting Ironing creates NO expense.
            </p>
            <p className="text-purple-700 text-[10px]">
              Labour earning and linked internal expense are calculated and recorded only upon completing ironing.
            </p>
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto flex-1 py-2.5 sm:py-3 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedStaffId}
              className="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="size-4" />
              {isPending ? "Starting..." : "Start Ironing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteIroningModal({
  order,
  onClose,
  onComplete,
  onNavigateToProducts,
  isPending,
}: {
  order: Order;
  onClose: () => void;
  onComplete: (orderId: string, staffId?: string, ratesOverride?: Record<string, number>) => void;
  onNavigateToProducts?: () => void;
  isPending: boolean;
}) {
  const { data: activeTask } = trpc.ironing.getActiveTask.useQuery({
    orderId: order.id,
  });
  const { data: staffList = [] } = trpc.workers.activeStaffList.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: shops = [] } = trpc.shops.list.useQuery();

  const shopFallbackRate = shops[0]?.defaultStaffIroningRate ?? 10;

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [customRates, setCustomRates] = useState<Record<string, number>>({});

  // Product ID & Name to staffIroningRate mappings
  const { productIdRateMap, productNameRateMap } = useMemo(() => {
    const idMap = new Map<string, number>();
    const nameMap = new Map<string, number>();
    for (const p of products) {
      idMap.set(p.id, p.staffIroningRate !== undefined ? p.staffIroningRate : 10);
      nameMap.set(p.name.toLowerCase().trim(), p.staffIroningRate !== undefined ? p.staffIroningRate : 10);
    }
    return { productIdRateMap: idMap, productNameRateMap: nameMap };
  }, [products]);

  // Robust parsing with full string & prefix sanitization
  const parsedGarmentItems = useMemo(() => {
    const sanitizeItem = (rawName: string, rawQty?: number, productId?: string | null, staffRate?: number) => {
      const trimmed = (rawName || "").trim();
      // Check for prefix "1 items · Standard Laundry" or "3 pcs · Shirt"
      const prefixMatch = trimmed.match(/^(\d+)\s*(?:items|pcs|pieces)?\s*[·\-\:]\s*(.+)$/i);
      if (prefixMatch) {
        return {
          productId: productId || null,
          name: prefixMatch[2].trim(),
          quantity: rawQty && rawQty > 1 ? rawQty : (Number(prefixMatch[1]) || 1),
          staffIroningRate: staffRate,
        };
      }
      // Check for "2 x Shirt" or "Shirt x 2"
      const xMatch = trimmed.match(/^(\d+)\s*x\s*(.+)$/i) || trimmed.match(/^(.+)\s*x\s*(\d+)$/i);
      if (xMatch) {
        const qty = Number(xMatch[1]) || Number(xMatch[2]) || 1;
        const name = (isNaN(Number(xMatch[1])) ? xMatch[1] : xMatch[2]).trim();
        return {
          productId: productId || null,
          name,
          quantity: rawQty && rawQty > 1 ? rawQty : qty,
          staffIroningRate: staffRate,
        };
      }
      return {
        productId: productId || null,
        name: trimmed || "Standard Laundry",
        quantity: rawQty || 1,
        staffIroningRate: staffRate,
      };
    };

    if (order.structuredItems && order.structuredItems.length > 0) {
      return order.structuredItems.map((i) =>
        sanitizeItem(i.name, i.quantity, i.productId, i.staffIroningRate)
      );
    }
    if (Array.isArray(order.items)) {
      return (order.items as any[]).map((i: any) => {
        if (typeof i === "string") return sanitizeItem(i);
        return sanitizeItem(i.name, i.quantity, i.productId, i.staffIroningRate);
      });
    }
    if (typeof order.items === "string" && order.items.trim()) {
      const str = order.items.trim();
      const parts = str.split(",");
      return parts.map((s) => sanitizeItem(s));
    }
    return [sanitizeItem(order.items || "Standard Laundry", 1)];
  }, [order]);

  const getItemRateAndSource = (item: { productId?: string | null; name: string; staffIroningRate?: number }): { rate: number; source: "product" | "order_snapshot" | "shop_default" | "missing" } => {
    // 1. Check stable Product ID match
    if (item.productId && productIdRateMap.has(item.productId)) {
      const r = productIdRateMap.get(item.productId)!;
      if (r > 0) return { rate: r, source: "product" };
    }
    // 2. Check snapshot rate saved on order item
    if (item.staffIroningRate !== undefined && item.staffIroningRate > 0) {
      return { rate: item.staffIroningRate, source: "order_snapshot" };
    }
    // 3. Exact name match against products catalog
    const cleanName = item.name.toLowerCase().trim();
    if (productNameRateMap.has(cleanName)) {
      const r = productNameRateMap.get(cleanName)!;
      if (r > 0) return { rate: r, source: "product" };
    }
    // 4. Fuzzy name match fallback
    let fuzzyMatch = 0;
    productNameRateMap.forEach((pRate, pName) => {
      if (fuzzyMatch === 0 && pRate > 0 && (cleanName.includes(pName) || pName.includes(cleanName))) {
        fuzzyMatch = pRate;
      }
    });
    if (fuzzyMatch > 0) return { rate: fuzzyMatch, source: "product" };

    // 5. Standard configured fallback for standard laundry/general ironing
    if (productNameRateMap.has("standard laundry") && productNameRateMap.get("standard laundry")! > 0) {
      return { rate: productNameRateMap.get("standard laundry")!, source: "product" };
    }

    // 6. Settings default fallback
    if (shopFallbackRate > 0) {
      return { rate: shopFallbackRate, source: "shop_default" };
    }

    // 7. No rate configured anywhere
    return { rate: 0, source: "missing" };
  };

  const calculatedItems = parsedGarmentItems.map((item) => {
    if (customRates[item.name] !== undefined) {
      const customVal = customRates[item.name];
      return {
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        staffRate: customVal,
        staffEarning: item.quantity * customVal,
        source: "custom" as const,
        isUsingDefaultRate: false,
        isMissingRate: customVal === 0,
      };
    }
    const { rate, source } = getItemRateAndSource(item);
    return {
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      staffRate: rate,
      staffEarning: item.quantity * rate,
      source,
      isUsingDefaultRate: source === "shop_default",
      isMissingRate: rate === 0,
    };
  });

  const unconfiguredItems = calculatedItems.filter((i) => i.isMissingRate);
  const totalPieces = calculatedItems.reduce((acc: number, i) => acc + i.quantity, 0);
  const totalEarnings = calculatedItems.reduce((acc: number, i) => acc + i.staffEarning, 0);

  const effectiveStaffId = activeTask?.staffId || selectedStaffId;
  const effectiveStaffName =
    activeTask?.staffName || staffList.find((s) => s.id === selectedStaffId)?.name;

  const handleRateChange = (itemName: string, val: string) => {
    const num = Math.max(0, Number(val) || 0);
    setCustomRates((prev) => ({
      ...prev,
      [itemName]: num,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveStaffId) {
      toast.error("Please select the staff member who did the ironing");
      return;
    }

    if (unconfiguredItems.length > 0) {
      toast.error("Missing Staff Ironing Rate", {
        description: `Please configure a rate for "${unconfiguredItems[0].name}" or set a default in Settings.`,
      });
      return;
    }

    const ratesOverride: Record<string, number> = {};
    calculatedItems.forEach((i) => {
      ratesOverride[i.name] = i.staffRate;
      if (i.productId) {
        ratesOverride[i.productId] = i.staffRate;
      }
    });

    onComplete(order.id, activeTask ? undefined : effectiveStaffId, ratesOverride);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white">
                STEP 3 ➔ 4
              </span>
              <span className="text-[10px] font-semibold text-emerald-700">COMPLETING IRONING</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="size-5 text-emerald-600" />
              Complete Ironing & Record Labour
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Calculate staff labour earning and create automatic internal expense
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Hard-block warning banner if rate is 0 and no fallback */}
        {unconfiguredItems.length > 0 && (
          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">
                  {unconfiguredItems.length === 1
                    ? `Missing Staff Rate for "${unconfiguredItems[0].name}" (₹0)`
                    : `Missing Staff Rates for ${unconfiguredItems.length} items (₹0)`}
                </p>
                <p className="text-[11px] text-rose-800 mt-0.5">
                  Enter rate below or configure permanently in Items / Services to complete this order.
                </p>
              </div>
            </div>
            {onNavigateToProducts && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToProducts();
                }}
                className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1 shadow-xs"
              >
                Go to Items / Services
                <ChevronRight className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Staff details or fallback prompt */}
        {activeTask ? (
          <div className="bg-purple-50/70 border border-purple-200/80 p-3.5 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                {activeTask.staffName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] text-purple-700 font-semibold uppercase">Assigned Staff</p>
                <p className="font-bold text-purple-950 text-sm">{activeTask.staffName}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-800">
              Ironing In Progress
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Who completed this ironing? <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              required
            >
              <option value="">-- Choose Staff Member --</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Rate Breakdown Table */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span>Garment Labour Breakdown</span>
            <span className="text-[11px] font-normal text-slate-500">Edit rate/pc if needed</span>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <div className="grid grid-cols-12 bg-slate-100/80 px-3 py-2 font-bold text-slate-600 text-[11px] border-b border-slate-200">
              <div className="col-span-5">Garment</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Rate/pc</div>
              <div className="col-span-3 text-right">Labour Earning</div>
            </div>

            <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
              {calculatedItems.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  {order.items || "Standard Laundry items"}
                </div>
              ) : (
                calculatedItems.map((item, idx) => (
                  <div key={idx} className={`grid grid-cols-12 px-3 py-2 items-center text-slate-700 gap-1 ${item.isMissingRate ? "bg-rose-50/40" : item.isUsingDefaultRate ? "bg-amber-50/40" : ""}`}>
                    <div className="col-span-5 truncate" title={item.name}>
                      <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                      {item.isUsingDefaultRate && (
                        <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded mt-0.5">
                          ⚠️ Using default rate (₹{item.staffRate})
                        </span>
                      )}
                      {item.isMissingRate && (
                        <span className="inline-block text-[9px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded mt-0.5">
                          ❌ Rate missing (₹0)
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-center font-mono font-bold">
                      {item.quantity}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <div className="relative w-16">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={item.staffRate}
                          onChange={(e) => handleRateChange(item.name, e.target.value)}
                          className={`w-full pl-4 pr-1 py-1 text-xs text-right font-mono font-bold rounded-lg focus:outline-none focus:ring-1 ${
                            item.isMissingRate
                              ? "bg-rose-50 border border-rose-300 focus:ring-rose-500 text-rose-900"
                              : item.isUsingDefaultRate
                              ? "bg-amber-50 border border-amber-300 focus:ring-amber-500 text-amber-900"
                              : "bg-slate-50 border border-slate-200 focus:ring-emerald-500 text-slate-800"
                          }`}
                        />
                      </div>
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold text-emerald-700">
                      ₹{item.staffEarning}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-12 bg-slate-50 px-3 py-2.5 font-bold text-slate-800 border-t border-slate-200">
              <div className="col-span-5">Total Pieces & Labour:</div>
              <div className="col-span-2 text-center text-slate-900">{totalPieces} pcs</div>
              <div className="col-span-2 text-right text-slate-400">-</div>
              <div className="col-span-3 text-right text-emerald-700 text-sm font-bold">
                ₹{totalEarnings}
              </div>
            </div>
          </div>
        </div>

        {/* Accounting & Financial Clarification Notice */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5 text-slate-600">
          <div className="flex justify-between items-center text-[11px]">
            <span>Customer Bill Amount (Unchanged):</span>
            <span className="font-bold text-slate-800">₹{order.totalAmount}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-emerald-700 font-semibold border-t border-slate-200/60 pt-1">
            <span>Automatic Internal Expense:</span>
            <span>
              {totalEarnings > 0
                ? `₹${totalEarnings} under "Staff / Ironing Labour"`
                : `₹0 (No internal expense)`}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="pt-1 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex-1 py-2.5 sm:py-3 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !effectiveStaffId || unconfiguredItems.length > 0}
            className="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Check className="size-4" />
            {isPending
              ? "Recording..."
              : totalEarnings > 0
              ? `Complete & Credit ₹${totalEarnings}`
              : "Complete Ironing (₹0 Labour)"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PickupModal({
  order,
  onClose,
  onSettle,
  onCompleteWithoutPayment,
  isPending,
}: {
  order: Order;
  onClose: () => void;
  onSettle: (id: string, amountPaid: number, deliveryType: "Shop Collection" | "Home Delivery") => void;
  onCompleteWithoutPayment: (id: string, deliveryType: "Shop Collection" | "Home Delivery") => void;
  isPending: boolean;
}) {
  const dueAmount = Math.max(0, order.totalAmount - order.amountPaid);
  const [collectionAmount, setCollectionAmount] = useState<number>(dueAmount);
  const [deliveryType, setDeliveryType] = useState<"Shop Collection" | "Home Delivery">(
    (order.deliveryType as any) || "Shop Collection"
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("UPI");

  const handleSubmit = () => {
    if (dueAmount > 0 && collectionAmount > 0) {
      onSettle(order.id, collectionAmount, deliveryType);
    } else {
      onCompleteWithoutPayment(order.id, deliveryType);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#0F4C5C] text-white">
                STEP 4 ➔ 5
              </span>
              <span className="text-[10px] font-semibold text-slate-500">COLLECTION & PAYMENT</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#0F4C5C]">
              Shop Collection / Delivery & Payment
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Collect payment & handover garments to move to Step 5 (Payment Settled)
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Bill Number:</span>
            <span className="font-mono font-bold text-slate-800">{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-bold text-slate-800">{order.customer} ({order.phone})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Bill Amount:</span>
            <span className="font-bold text-slate-800">₹{order.totalAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Previously Paid:</span>
            <span className="font-bold text-emerald-600">₹{order.amountPaid}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-xs sm:text-sm">
            <span className="font-bold text-slate-700">Remaining Balance Due:</span>
            <span className={`font-bold ${dueAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              ₹{dueAmount}
            </span>
          </div>
        </div>

        {/* Handover / Delivery Method Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Handover Method
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryType("Shop Collection")}
              className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                deliveryType === "Shop Collection"
                  ? "bg-[#0F4C5C] text-white border-[#0F4C5C] shadow-2xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <ShoppingBag className="size-3.5" />
              Shop Collection
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType("Home Delivery")}
              className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                deliveryType === "Home Delivery"
                  ? "bg-[#0F4C5C] text-white border-[#0F4C5C] shadow-2xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Truck className="size-3.5" />
              Home Delivery
            </button>
          </div>
        </div>

        {dueAmount > 0 ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Collecting Amount Now (₹)
              </label>
              <input
                type="number"
                min="0"
                max={dueAmount}
                value={collectionAmount}
                onChange={(e) => setCollectionAmount(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["UPI", "Cash", "Card"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      paymentMethod === m
                        ? "bg-[#0F4C5C] text-white border-[#0F4C5C] shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>This order is already paid in full. Hand over garments to complete.</span>
          </div>
        )}

        <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex-1 py-2.5 sm:py-3 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
            className="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition shadow-xs disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <Check className="size-4" />
            {isPending ? "Processing..." : "Complete Delivery & Settle"}
          </button>
        </div>
      </div>
    </div>
  );
}
