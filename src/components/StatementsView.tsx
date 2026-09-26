import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  BarChart3,
  Download,
  EyeOff,
  ShieldAlert,
  Lock,
  Crown,
  Calendar,
  IndianRupee,
  CircleDollarSign,
  TrendingUp,
  WalletCards,
  Clock,
  PackageCheck,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

type PeriodType = "Today" | "Month" | "Financial Year" | "Custom";

export default function StatementsView() {
  const { canViewReports, role, setRole } = useAccessControl();

  const [timeRange, setTimeRange] = useState<PeriodType>("Month");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const periodParam =
    timeRange === "Today"
      ? "today"
      : timeRange === "Month"
      ? "month"
      : timeRange === "Financial Year"
      ? "financial_year"
      : "custom";

  const { data: statements, isLoading, isFetching } = trpc.reports.businessStatements.useQuery(
    {
      period: periodParam,
      startDate: timeRange === "Custom" ? customStartDate : undefined,
      endDate: timeRange === "Custom" ? customEndDate : undefined,
    },
    { enabled: canViewReports }
  );

  if (!canViewReports) {
    return (
      <div className="max-w-2xl mx-auto my-6 sm:my-12 bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-xs text-center space-y-4 sm:space-y-5">
        <div className="size-14 sm:size-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <EyeOff className="size-7 sm:size-8" />
        </div>

        <div>
          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full uppercase">
            Access Restricted · {role.toUpperCase()} Role
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-2.5">
            Financial Reports & Statements are Hidden
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md mx-auto">
            According to FabricCare access rules, detailed revenue statements, net profit breakdown, and financial reports are only accessible by <strong>Admin (Shop Owner)</strong>.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs text-slate-600 text-left space-y-2 max-w-md mx-auto">
          <p className="font-bold text-slate-800 flex items-center gap-1.5">
            <Lock className="size-3.5 text-slate-500" /> Current Permissions for {role}:
          </p>
          <ul className="space-y-1 list-disc list-inside text-[11px] text-slate-500">
            <li>Customer orders & billing intake: <strong>Allowed</strong></li>
            <li>Active laundry workflow management: <strong>Allowed</strong></li>
            <li>Financial reports & net revenue statements: <strong className="text-rose-600">Hidden & Blocked</strong></li>
          </ul>
        </div>

        <div className="pt-2 flex justify-center">
          <button
            onClick={() => {
              setRole("admin");
              toast.success("Switched to Admin Role in Simulator");
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-2 active:scale-95"
          >
            <Crown className="size-4" /> Switch to Admin in Simulator
          </button>
        </div>
      </div>
    );
  }

  const {
    totalRevenue = 0,
    totalCollected = 0,
    totalPending = 0,
    totalLabourCost = 0,
    totalOtherExpenses = 0,
    totalExpenses = 0,
    netProfit = 0,
    orderCount = 0,
    avgOrderValue = 0,
    dailyBreakdown = [],
  } = (statements as any) || {};

  const handleExportStatement = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Period/Date,Total Billed (₹),Collected (₹),Labour Cost (₹),General Expenses (₹),Total Expenses (₹),Net Profit (₹),Orders Count"]
        .concat(
          dailyBreakdown.map(
            (d: any) =>
              `"${d.label || d.date}",${d.sales || 0},${d.collected || 0},${d.labour || 0},${(d.expenses || 0) - (d.labour || 0)},${d.expenses || 0},${d.net || 0},${d.orders || 0}`
          )
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial-statement-${timeRange.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Statement CSV exported!");
  };

  const periodTitles: Record<PeriodType, string> = {
    Today: "Today's Operational & Financial Report",
    Month: "Current Month Financial Overview",
    "Financial Year": "Financial Year (FY) Statement & Performance",
    Custom: `Custom Range Statement (${customStartDate} to ${customEndDate})`,
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header & Filter Row */}
      <div className="flex flex-col gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
              <BarChart3 className="size-5 sm:size-6 text-[#0F4C5C]" />
              {periodTitles[timeRange]}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Financial statement and profit performance summary
            </p>
          </div>

          <button
            onClick={handleExportStatement}
            className="px-3.5 py-2 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center gap-1.5 active:scale-95 ml-auto sm:ml-0"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        </div>

        {/* Period Selector Tabs & Custom Range Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold w-max gap-1">
              {(["Today", "Month", "Financial Year", "Custom"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                    timeRange === r
                      ? "bg-white text-[#0F4C5C] shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {timeRange === "Custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-1">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-[#0F4C5C] focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-1">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-[#0F4C5C] focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {/* Total Billed Revenue */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">Total Revenue</span>
          <p className="text-lg sm:text-xl font-bold text-[#0F4C5C] tracking-tight">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">Gross sum of bills</span>
        </div>

        {/* Staff Labour Costs */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-purple-200 bg-purple-50/20 shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-purple-800 block truncate">Staff Labour</span>
          <p className="text-lg sm:text-xl font-bold text-purple-700 tracking-tight">
            ₹{totalLabourCost.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] sm:text-[11px] text-purple-500 block truncate">Ironing & Wash labour</span>
        </div>

        {/* General Other Expenses */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-amber-800 block truncate">Other Expenses</span>
          <p className="text-lg sm:text-xl font-bold text-amber-700 tracking-tight">
            ₹{totalOtherExpenses.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] sm:text-[11px] text-amber-500 block truncate">Rent, supplies & utility</span>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">Total Expenses</span>
          <p className="text-lg sm:text-xl font-bold text-rose-600 tracking-tight">
            ₹{totalExpenses.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">Labour + Overhead</span>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-emerald-800 block truncate">Net Profit</span>
          <p
            className={`text-lg sm:text-xl font-bold tracking-tight ${
              netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            ₹{netProfit.toLocaleString("en-IN")}
          </p>
          <span className="text-[10px] sm:text-[11px] text-emerald-600 block truncate">Revenue − Expenses</span>
        </div>

        {/* Total Orders & Avg Value */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">Total Orders</span>
          <p className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">{orderCount} Orders</p>
          <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">
            Avg: ₹{avgOrderValue.toLocaleString("en-IN")} / bill
          </span>
        </div>
      </div>

      {/* Recharts Multi-Period Bar & Trend Chart */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#0F4C5C]">
              {timeRange === "Financial Year"
                ? "Monthly Revenue & Collections Trend (FY)"
                : timeRange === "Today"
                ? "Today's Transaction & Collection Flow"
                : "Periodic Sales, Collections vs Expenses Trend"}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {timeRange === "Financial Year"
                ? "Full financial year grouped by month (April to March)"
                : "Timeline breakdown showing performance across the selected interval"}
            </p>
          </div>
        </div>

        <div className="h-72 sm:h-80 w-full pt-2">
          {isLoading || isFetching ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Loading financial statement data...
            </div>
          ) : !dailyBreakdown || dailyBreakdown.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-4 text-center">
              <BarChart3 className="size-8 text-slate-300" />
              <span>No transactions recorded for this period.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBreakdown} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                  }}
                  formatter={(value: any) => [`₹${Number(value || 0).toLocaleString("en-IN")}`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="sales" name="Billed Sales (₹)" fill="#0F4C5C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected (₹)" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses (₹)" fill="#E11D48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Period Statement Breakdown Table */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-800 text-sm">
            {timeRange === "Financial Year" ? "Monthly Statement Summary" : "Periodic Statement Summary"}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            {dailyBreakdown.length} breakdown records
          </span>
        </div>

        {/* Mobile View (< sm): Cards */}
        <div className="grid gap-2.5 grid-cols-1 sm:hidden">
          {dailyBreakdown.map((row: any, idx: number) => (
            <div
              key={idx}
              className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-3 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="font-bold text-[#0F4C5C] text-xs sm:text-sm">
                  {row.label || row.date}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {row.orders || 0} {row.orders === 1 ? "order" : "orders"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Billed</span>
                  <span className="font-bold text-slate-800">
                    ₹{(row.sales || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Collected</span>
                  <span className="font-bold text-emerald-600">
                    ₹{(row.collected || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Expenses</span>
                  <span className="font-bold text-rose-600">
                    ₹{(row.expenses || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Net Profit</span>
                  <span
                    className={`font-bold ${
                      (row.net || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    ₹{(row.net || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View (>= sm): Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Period / Date</th>
                <th className="py-2.5 px-3 text-right">Orders</th>
                <th className="py-2.5 px-3 text-right">Billed (₹)</th>
                <th className="py-2.5 px-3 text-right">Collected (₹)</th>
                <th className="py-2.5 px-3 text-right">Expenses (₹)</th>
                <th className="py-2.5 px-3 text-right">Net Profit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyBreakdown.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3 font-semibold text-[#0F4C5C]">{row.label || row.date}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{row.orders || 0}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                    ₹{(row.sales || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                    ₹{(row.collected || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                    ₹{(row.expenses || 0).toLocaleString("en-IN")}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      (row.net || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    ₹{(row.net || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
