import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAccessControl } from "@/contexts/AccessControlContext";
import InvoiceModal from "./InvoiceModal";
import { toast } from "sonner";
import {
  IndianRupee,
  CircleDollarSign,
  Clock,
  WashingMachine,
  Plus,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  ChevronRight,
  Eye,
  Sparkles,
  Users,
  AlertCircle,
  Truck,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function DashboardView({
  onNavigate,
  onNewOrder,
}: {
  onNavigate: (section: any) => void;
  onNewOrder: () => void;
}) {
  const { canDelete } = useAccessControl();
  const utils = trpc.useUtils();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: ironingStats } = trpc.ironing.todayStats.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery();
  const { data: statements } = trpc.reports.businessStatements.useQuery({ period: "7_days" });

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const deleteOrderMutation = trpc.orders.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.dashboard.stats.invalidate(),
        utils.recycleBin.counts.invalidate(),
        utils.recycleBin.list.invalidate(),
        utils.customers.list.invalidate(),
      ]);
      toast.success("Bill moved to Recycle Bin", {
        description: "You can restore or permanently delete it from the Recycle Bin.",
      });
      setSelectedOrder(null);
    },
    onError: (err: Error) => toast.error("Failed to move bill to Recycle Bin", { description: err.message }),
  });

  const metrics = stats || {
    todaysSales: 0,
    todaysCollected: 0,
    todaysPending: 0,
    todaysGarmentCount: 0,
  };

  const receivedCount = orders.filter((o) => o.status === "Received").length;
  const processingCount = orders.filter((o) => o.status === "Processing").length;
  const ironingCount = orders.filter((o) => o.status === "Ironing").length;
  const readyCount = orders.filter((o) => o.status === "Ready").length;
  const collectedTodayCount = orders.filter((o) => o.status === "Collected").length;
  const activeProcessCount = orders.filter((o) => o.status !== "Collected").length;
  const chartData = statements?.dailyBreakdown || [];
  const recentOrders = orders.slice(0, 5);

  // Urgent action items
  const readyToDeliverOrders = orders.filter((o) => o.status === "Ready");
  const pendingIroningOrders = orders.filter((o) => o.status === "Ironing");
  const hasUrgentAction = readyToDeliverOrders.length > 0 || pendingIroningOrders.length > 0 || metrics.todaysPending > 0;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* 1. ACTION REQUIRED BANNER (High Mobile Priority) */}
      {hasUrgentAction && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                Action Required
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              </h3>
              <p className="text-[11px] sm:text-xs text-amber-900/80 mt-0.5">
                {readyCount > 0
                  ? `${readyCount} order${readyCount > 1 ? "s are" : " is"} ready for pickup & handover`
                  : pendingIroningOrders.length > 0
                  ? `${pendingIroningOrders.length} order${pendingIroningOrders.length > 1 ? "s need" : " needs"} steam iron & pressing`
                  : `₹${metrics.todaysPending.toLocaleString("en-IN")} unpaid dues pending collection`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(readyCount > 0 || pendingIroningOrders.length > 0 ? "Active process" : "Orders")}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 shrink-0 cursor-pointer"
          >
            {readyCount > 0 ? "Open Ready Orders" : pendingIroningOrders.length > 0 ? "Open Process" : "View Unpaid Bills"}
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* 2. TODAY'S BUSINESS SUMMARY (Compact, High-Contrast Large Numbers) */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Summary</h2>
            <p className="text-sm font-bold text-[#0F4C5C]">Financial & Operations</p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Today's Sales */}
          <button
            type="button"
            onClick={() => onNavigate("Orders")}
            className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 text-left hover:border-[#0F4C5C]/40 transition active:scale-95 cursor-pointer group"
          >
            <span className="text-[11px] font-semibold text-slate-500 block truncate">Sales (Billed)</span>
            <p className="text-lg sm:text-2xl font-bold text-[#0F4C5C] tracking-tight mt-0.5">
              ₹{metrics.todaysSales.toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Total new bills</span>
          </button>

          {/* Collected Today */}
          <button
            type="button"
            onClick={() => onNavigate("Statements")}
            className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-left hover:border-emerald-400 transition active:scale-95 cursor-pointer group"
          >
            <span className="text-[11px] font-semibold text-emerald-800 block truncate">Collected Today</span>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700 tracking-tight mt-0.5">
              ₹{metrics.todaysCollected.toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-emerald-600/80 mt-0.5 block truncate">Cash & UPI in hand</span>
          </button>

          {/* Pending Due */}
          <button
            type="button"
            onClick={() => onNavigate("Orders")}
            className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/70 text-left hover:border-rose-400 transition active:scale-95 cursor-pointer group"
          >
            <span className="text-[11px] font-semibold text-rose-800 block truncate">Pending Dues</span>
            <p className="text-lg sm:text-2xl font-bold text-rose-600 tracking-tight mt-0.5">
              ₹{metrics.todaysPending.toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-rose-600/80 mt-0.5 block truncate">To be collected</span>
          </button>

          {/* Active Orders In Shop */}
          <button
            type="button"
            onClick={() => onNavigate("Active process")}
            className="p-3 rounded-xl bg-sky-50/50 border border-sky-200/70 text-left hover:border-sky-400 transition active:scale-95 cursor-pointer group"
          >
            <span className="text-[11px] font-semibold text-sky-800 block truncate">In Shop Workload</span>
            <p className="text-lg sm:text-2xl font-bold text-sky-700 tracking-tight mt-0.5">
              {activeProcessCount} <span className="text-xs font-normal text-slate-500">Orders</span>
            </p>
            <span className="text-[10px] text-sky-600/80 mt-0.5 block truncate">Active in pipeline</span>
          </button>
        </div>
      </div>

      {/* 3. QUICK ACTION BUTTONS (4 Easy 1-Tap Actions) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* + New Order (High Contrast Primary) */}
        <button
          type="button"
          onClick={onNewOrder}
          className="p-3.5 bg-gradient-to-tr from-[#0F4C5C] to-[#165a6c] text-white rounded-2xl shadow-md hover:shadow-lg transition flex items-center gap-3 active:scale-95 cursor-pointer"
        >
          <div className="size-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
            <Plus className="size-5" strokeWidth={2.5} />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-sm font-bold truncate">New Bill</p>
            <p className="text-[10px] text-white/75 truncate">+ Create order</p>
          </div>
        </button>

        {/* Process Orders */}
        <button
          type="button"
          onClick={() => onNavigate("Active process")}
          className="p-3.5 bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-xs hover:border-[#0F4C5C]/40 transition flex items-center gap-3 active:scale-95 cursor-pointer"
        >
          <div className="size-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
            <WashingMachine className="size-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-sm font-bold truncate">Process</p>
            <p className="text-[10px] text-slate-500 truncate">{activeProcessCount} orders active</p>
          </div>
        </button>

        {/* Collect Dues */}
        <button
          type="button"
          onClick={() => onNavigate("Orders")}
          className="p-3.5 bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-xs hover:border-[#0F4C5C]/40 transition flex items-center gap-3 active:scale-95 cursor-pointer"
        >
          <div className="size-10 bg-rose-50 text-rose-700 rounded-xl flex items-center justify-center shrink-0 border border-rose-100">
            <Clock className="size-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-sm font-bold truncate">Collect Dues</p>
            <p className="text-[10px] text-slate-500 truncate">₹{metrics.todaysPending}</p>
          </div>
        </button>

        {/* Customers */}
        <button
          type="button"
          onClick={() => onNavigate("Customers")}
          className="p-3.5 bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-xs hover:border-[#0F4C5C]/40 transition flex items-center gap-3 active:scale-95 cursor-pointer"
        >
          <div className="size-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
            <Users className="size-5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-sm font-bold truncate">Customers</p>
            <p className="text-[10px] text-slate-500 truncate">Directory & history</p>
          </div>
        </button>
      </div>

      {/* 4. TODAY'S WORKFLOW PIPELINE (5 Sequential Stage Buttons) */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Pipeline Stages</h3>
          <button
            onClick={() => onNavigate("Active process")}
            className="text-[11px] font-bold text-[#0F4C5C] hover:underline flex items-center gap-1"
          >
            Workflow Board <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {/* 1. Intake */}
          <button
            type="button"
            onClick={() => onNavigate("Active process")}
            className="p-2 sm:p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-center hover:bg-amber-100/50 transition active:scale-95 cursor-pointer"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase block">1. Intake</span>
            <p className="text-sm sm:text-lg font-bold text-amber-700 mt-0.5">{receivedCount}</p>
          </button>

          {/* 2. Wash */}
          <button
            type="button"
            onClick={() => onNavigate("Active process")}
            className="p-2 sm:p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-center hover:bg-blue-100/50 transition active:scale-95 cursor-pointer"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-800 uppercase block">2. Wash</span>
            <p className="text-sm sm:text-lg font-bold text-blue-700 mt-0.5">{processingCount}</p>
          </button>

          {/* 3. Iron */}
          <button
            type="button"
            onClick={() => onNavigate("Active process")}
            className="p-2 sm:p-3 rounded-xl bg-purple-50/70 border border-purple-200/80 text-center hover:bg-purple-100/50 transition active:scale-95 cursor-pointer"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-purple-800 uppercase block">3. Iron</span>
            <p className="text-sm sm:text-lg font-bold text-purple-700 mt-0.5">{ironingCount}</p>
          </button>

          {/* 4. Ready */}
          <button
            type="button"
            onClick={() => onNavigate("Active process")}
            className="p-2 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-center hover:bg-emerald-100/50 transition active:scale-95 cursor-pointer"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-800 uppercase block">4. Ready</span>
            <p className="text-sm sm:text-lg font-bold text-emerald-700 mt-0.5">{readyCount}</p>
          </button>

          {/* 5. Done */}
          <button
            type="button"
            onClick={() => onNavigate("Orders")}
            className="p-2 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 text-center hover:bg-slate-100 transition active:scale-95 cursor-pointer"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 uppercase block">5. Done</span>
            <p className="text-sm sm:text-lg font-bold text-slate-700 mt-0.5">{collectedTodayCount}</p>
          </button>
        </div>
      </div>

      {/* 5. RECENT ORDERS (Clean Mobile Cards) */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Recent Orders</h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400">Latest active shop bills</p>
          </div>
          <button
            onClick={() => onNavigate("Orders")}
            className="text-xs font-bold text-[#0F4C5C] hover:underline flex items-center gap-1"
          >
            View All ({orders.length}) <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-xs text-slate-400">No orders recorded today yet.</p>
              <button
                onClick={onNewOrder}
                className="px-4 py-1.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl active:scale-95 shadow-xs"
              >
                + Create First Order
              </button>
            </div>
          ) : (
            recentOrders.map((order) => {
              const dueAmount = order.totalAmount - order.amountPaid;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="py-3 px-2 -mx-2 rounded-xl flex items-center justify-between text-xs gap-3 cursor-pointer hover:bg-slate-50 transition active:scale-98 group"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0F4C5C] text-xs">{order.id}</span>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                          order.status === "Ready"
                            ? "bg-emerald-100 text-emerald-800"
                            : order.status === "Processing"
                            ? "bg-blue-100 text-blue-800"
                            : order.status === "Ironing"
                            ? "bg-purple-100 text-purple-800"
                            : order.status === "Collected"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800 truncate text-xs">{order.customer}</p>
                    <p className="text-slate-400 text-[11px] truncate">{order.items}</p>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">₹{order.totalAmount}</span>
                      <span
                        className={`text-[10px] font-bold block ${
                          dueAmount > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {dueAmount > 0 ? `₹${dueAmount} due` : "Paid in Full"}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-[#0F4C5C] group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. WEEKLY SALES TREND (Tucked Lower on Mobile) */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#0F4C5C]">7-Day Revenue Trend</h3>
            <p className="text-[10px] sm:text-xs text-slate-400">Daily shop sales collection</p>
          </div>
          <button
            onClick={() => onNavigate("Statements")}
            className="text-xs font-bold text-[#0F4C5C] hover:underline flex items-center gap-1"
          >
            Full Statements <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="h-48 sm:h-64 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F4C5C" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0F4C5C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#64748b" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#64748b" }} />
              <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px" }} />
              <Area type="monotone" dataKey="collected" name="Collections (₹)" stroke="#0F4C5C" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {selectedOrder && (
        <InvoiceModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDelete={() => {
            if (!canDelete) {
              toast.error("Permission Denied", {
                description: "Staff role is restricted from deleting bills. Contact an Admin or Manager.",
              });
              return;
            }
            if (confirm(`Move Bill ${selectedOrder.id} to Recycle Bin?\n\nThis item will be moved to the Recycle Bin and can be restored later.`)) {
              deleteOrderMutation.mutate({ id: selectedOrder.id });
            }
          }}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

