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
  const outstandingProcessesCount = receivedCount + processingCount + ironingCount;
  const needToDeliverCount = orders.filter((o) => o.status === "Ready").length;
  const activeProcessCount = orders.filter((o) => o.status !== "Collected").length;
  const chartData = statements?.dailyBreakdown || [];
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Quick Actions Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#0F4C5C]">Shop Overview & Dashboard</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">Live operational command center</p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <button
            onClick={onNewOrder}
            className="flex-1 sm:flex-none px-4 py-2 sm:py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap"
          >
            <Plus className="size-4" /> New Order Bill
          </button>
          <button
            onClick={() => onNavigate("Active process")}
            className="flex-1 sm:flex-none px-4 py-2 sm:py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap"
          >
            <WashingMachine className="size-4" /> Process Board
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid: 2x3 on mobile, 3x2 on tablet, 6x1 on desktop */}
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {/* Today's Sales */}
        <div
          onClick={() => onNavigate("Orders")}
          className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-[#0F4C5C]/30 transition hover:shadow-sm"
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate">Today's Sales</span>
            <div className="p-1.5 sm:p-2 bg-[#0F4C5C]/10 text-[#0F4C5C] rounded-lg sm:rounded-xl shrink-0">
              <IndianRupee className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-[#0F4C5C] tracking-tight">
              ₹{metrics.todaysSales.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Total new bills today</p>
          </div>
        </div>

        {/* Collected Today */}
        <div
          onClick={() => onNavigate("Statements")}
          className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-emerald-300 transition hover:shadow-sm"
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate">Collected Today</span>
            <div className="p-1.5 sm:p-2 bg-emerald-100 text-emerald-700 rounded-lg sm:rounded-xl shrink-0">
              <CircleDollarSign className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-emerald-600 tracking-tight">
              ₹{metrics.todaysCollected.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Cash/UPI received</p>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div
          onClick={() => onNavigate("Orders")}
          className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-rose-300 transition hover:shadow-sm"
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate">Outstanding Dues</span>
            <div className="p-1.5 sm:p-2 bg-rose-100 text-rose-700 rounded-lg sm:rounded-xl shrink-0">
              <Clock className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-rose-600 tracking-tight">
              ₹{metrics.todaysPending.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Uncollected balances</p>
          </div>
        </div>

        {/* Outstanding Processes (KPI) */}
        <div
          onClick={() => onNavigate("Active process")}
          className="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-200/90 bg-amber-50/20 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-amber-400 transition hover:shadow-sm"
        >
          <div className="flex justify-between items-center text-slate-600 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate">Outstanding Processes</span>
            <div className="p-1.5 sm:p-2 bg-amber-100 text-amber-700 rounded-lg sm:rounded-xl shrink-0">
              <WashingMachine className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-amber-600 tracking-tight">
              {outstandingProcessesCount} {outstandingProcessesCount === 1 ? "Order" : "Orders"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
              {receivedCount} intake · {processingCount} wash · {ironingCount} iron
            </p>
          </div>
        </div>

        {/* Need to Deliver (KPI) */}
        <div
          onClick={() => onNavigate("Active process")}
          className="bg-white p-3.5 sm:p-4 rounded-2xl border border-indigo-200/90 bg-indigo-50/20 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-indigo-400 transition hover:shadow-sm"
        >
          <div className="flex justify-between items-center text-slate-600 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate">Need to Deliver</span>
            <div className="p-1.5 sm:p-2 bg-indigo-100 text-indigo-700 rounded-lg sm:rounded-xl shrink-0">
              <PackageCheck className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-indigo-600 tracking-tight">
              {needToDeliverCount} {needToDeliverCount === 1 ? "Order" : "Orders"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
              Ready for pickup/delivery
            </p>
          </div>
        </div>

        {/* Total In Shop */}
        <div
          onClick={() => onNavigate("Active process")}
          className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-slate-300 transition hover:shadow-sm"
        >
          <div className="flex justify-between items-center text-slate-500 text-[11px] sm:text-xs font-semibold gap-1">
            <span className="truncate">Total in Shop</span>
            <div className="p-1.5 sm:p-2 bg-sky-100 text-sky-700 rounded-lg sm:rounded-xl shrink-0">
              <TrendingUp className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {activeProcessCount} {activeProcessCount === 1 ? "Order" : "Orders"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Active total workload</p>
          </div>
        </div>
      </div>

      {/* Ironing Labour & Staff Today (Subtle operational card) */}
      <div
        onClick={() => onNavigate("Staff Management")}
        className="bg-gradient-to-r from-purple-50/70 via-white to-slate-50 p-4 sm:p-5 rounded-2xl border border-purple-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:border-purple-300 transition group hover:shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl group-hover:scale-105 transition shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Ironing Staff Today</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800">
                IST Live
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Staff labour tracking & automated internal expense calculation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-purple-100 text-xs">
          <div>
            <span className="text-[10px] font-medium text-slate-500 block">Ironed Pieces</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{ironingStats?.todayPieces ?? 0} pcs</span>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 block">Labour Cost</span>
            <span className="text-sm font-bold text-purple-700 font-mono">₹{ironingStats?.todayLabourCost ?? 0}</span>
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-500 block">Active Ironing Staff</span>
            <span className="text-sm font-bold text-slate-800 font-mono">
              {ironingStats?.activeIroningStaffToday ?? 0} staff
            </span>
          </div>
          <ChevronRight className="size-4 text-slate-400 group-hover:text-purple-700 group-hover:translate-x-0.5 transition hidden sm:block" />
        </div>
      </div>

      {/* 7-Day Revenue Trend Chart */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#0F4C5C]">7-Day Sales & Collections Trend</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">Daily shop performance</p>
          </div>
          <button
            onClick={() => onNavigate("Statements")}
            className="text-xs font-bold text-[#0F4C5C] hover:underline flex items-center gap-1"
          >
            Full Report <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="h-60 sm:h-68 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F4C5C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0F4C5C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
              <Area type="monotone" dataKey="collected" name="Collections (₹)" stroke="#0F4C5C" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-800 text-sm">Recent Shop Orders</h3>
          <button
            onClick={() => onNavigate("Orders")}
            className="text-xs font-bold text-[#0F4C5C] hover:underline flex items-center gap-1"
          >
            View All Bills <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentOrders.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              No orders yet. Click "New Order Bill" to create your first order!
            </div>
          ) : (
            recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="py-3 px-2 -mx-2 rounded-xl flex items-center justify-between text-xs gap-2 cursor-pointer hover:bg-slate-50 transition group"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-mono font-bold text-[#0F4C5C] block text-xs">{order.id}</span>
                  <span className="font-semibold text-slate-800 block truncate">{order.customer}</span>
                  <span className="text-slate-400 text-[11px] block truncate">{order.items}</span>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">₹{order.totalAmount}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 mt-0.5 inline-block">
                      {order.status}
                    </span>
                  </div>
                  <ChevronRight className="size-4 text-slate-300 group-hover:text-[#0F4C5C] group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))
          )}
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
