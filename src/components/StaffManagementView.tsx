import { useState, useMemo } from "react";
import { trpc, type StaffPerformanceItem, type IroningTaskItem } from "@/lib/trpc";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  Users,
  UserCheck,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Shirt,
  IndianRupee,
  History,
  AlertTriangle,
  X,
  Droplets,
  Layers,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export type PeriodOption = "today" | "yesterday" | "this_week" | "this_month" | "custom";
export type ServiceOption = "all" | "ironing" | "washing";

export default function StaffManagementView() {
  const { canManageRoles } = useAccessControl();
  const utils = trpc.useUtils();

  const [serviceFilter, setServiceFilter] = useState<ServiceOption>("all");
  const [period, setPeriod] = useState<PeriodOption>("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffPerformanceItem | null>(null);

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [staffToToggle, setStaffToToggle] = useState<any | null>(null);

  // Queries
  const { data: staffList = [], isLoading: isLoadingStaff } = trpc.workers.staffList.useQuery();
  const { data: reportData, isLoading: isLoadingReport } = trpc.ironing.reports.useQuery({
    period,
    fromDate: customFromDate || undefined,
    toDate: customToDate || undefined,
    service: serviceFilter,
  });
  const { data: todayStats } = trpc.ironing.todayStats.useQuery();

  // Mutations
  const toggleActiveMutation = trpc.workers.toggleActive.useMutation({
    onSuccess: async (data) => {
      await utils.workers.staffList.invalidate();
      await utils.workers.activeStaffList.invalidate();
      await utils.ironing.todayStats.invalidate();
      toast.success(data.message || "Status updated");
      setStaffToToggle(null);
    },
    onError: (err) => {
      toast.error("Failed to update status", { description: err.message });
    },
  });

  const updateStaffMutation = trpc.workers.update.useMutation({
    onSuccess: async () => {
      await utils.workers.staffList.invalidate();
      await utils.workers.activeStaffList.invalidate();
      toast.success("Staff details updated");
      setEditingStaff(null);
    },
    onError: (err) => {
      toast.error("Failed to update staff", { description: err.message });
    },
  });

  const createStaffMutation = trpc.workers.create.useMutation({
    onSuccess: async (data) => {
      await utils.workers.staffList.invalidate();
      await utils.workers.activeStaffList.invalidate();
      toast.success(`Staff member "${data.name}" added successfully`);
      setShowAddStaffModal(false);
    },
    onError: (err) => {
      toast.error("Failed to add staff", { description: err.message });
    },
  });

  // Filter staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) =>
      `${s.name} ${s.role} ${s.email || ""}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staffList, searchQuery]);

  const activeStaffCount = staffList.filter((s) => s.active).length;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <Users className="size-5 sm:size-6 text-[#0F4C5C]" />
            Staff & Labour Management
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Track staff performance, daily washed & ironed pieces, labour earnings, and automatic expenses
          </p>
        </div>

        {canManageRoles && (
          <button
            type="button"
            onClick={() => setShowAddStaffModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#0F4C5C] hover:bg-[#0F4C5C]/90 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 min-h-[42px]"
          >
            <Plus className="size-4" /> Add Staff Member
          </button>
        )}
      </div>

      {/* Service Filter Tabs (All / Ironing / Washing) */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-100 rounded-xl sm:rounded-2xl w-full sm:w-fit border border-slate-200/70">
        <button
          type="button"
          onClick={() => setServiceFilter("all")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-semibold sm:font-bold whitespace-nowrap transition ${
            serviceFilter === "all"
              ? "bg-[#0F4C5C] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Layers className="size-3 sm:size-3.5 shrink-0" />
          <span>All Services</span>
        </button>

        <button
          type="button"
          onClick={() => setServiceFilter("ironing")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-semibold sm:font-bold whitespace-nowrap transition ${
            serviceFilter === "ironing"
              ? "bg-[#0F4C5C] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Sparkles className="size-3 sm:size-3.5 text-amber-300 shrink-0" />
          <span>Ironing Labour</span>
        </button>

        <button
          type="button"
          onClick={() => setServiceFilter("washing")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-semibold sm:font-bold whitespace-nowrap transition ${
            serviceFilter === "washing"
              ? "bg-[#0F4C5C] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Droplets className="size-3 sm:size-3.5 text-blue-300 shrink-0" />
          <span>Washing Labour</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid gap-2 sm:gap-3.5 xl:gap-4 grid-cols-3 xl:grid-cols-6">
        {/* Ironed Today */}
        <div className="bg-white p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span className="truncate">Ironed Today</span>
            <span className="size-5 sm:size-7 rounded-lg bg-teal-50 text-[#0F4C5C] flex items-center justify-center shrink-0">
              <Shirt className="size-3 sm:size-3.5" />
            </span>
          </div>
          <p className="font-display text-base sm:text-xl md:text-2xl font-bold text-[#0F4C5C] mt-1 sm:mt-2 truncate">
            {todayStats?.todayPieces ?? 0} <span className="text-[9px] sm:text-xs font-normal text-slate-400">pcs</span>
          </p>
          <p className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5 sm:mt-1 truncate hidden sm:block">
            Ironing completed
          </p>
        </div>

        {/* Washed Today */}
        <div className="bg-white p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-blue-100 bg-blue-50/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-blue-700 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span className="truncate">Washed Today</span>
            <span className="size-5 sm:size-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Droplets className="size-3 sm:size-3.5" />
            </span>
          </div>
          <p className="font-display text-base sm:text-xl md:text-2xl font-bold text-blue-800 mt-1 sm:mt-2 truncate">
            {todayStats?.todayWashedPieces ?? 0} <span className="text-[9px] sm:text-xs font-normal text-slate-400">pcs</span>
          </p>
          <p className="text-[8px] sm:text-[10px] text-blue-600 mt-0.5 sm:mt-1 truncate hidden sm:block">
            Wash cycles completed
          </p>
        </div>

        {/* Total Labour Today */}
        <div className="bg-white p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-emerald-100 bg-emerald-50/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-emerald-700 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span className="truncate">Labour Today</span>
            <span className="size-5 sm:size-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <IndianRupee className="size-3 sm:size-3.5" />
            </span>
          </div>
          <p className="font-display text-base sm:text-xl md:text-2xl font-bold text-emerald-800 mt-1 sm:mt-2 truncate">
            ₹{((todayStats?.totalLabourCostToday ?? ((todayStats?.todayLabourCost ?? 0) + (todayStats?.todayWashingLabourCost ?? 0)))).toLocaleString("en-IN")}
          </p>
          <p className="text-[8px] sm:text-[10px] text-emerald-600 mt-0.5 sm:mt-1 truncate hidden sm:block">
            Iron & wash expense
          </p>
        </div>

        {/* Active Staff */}
        <div className="bg-white p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-indigo-100 bg-indigo-50/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-indigo-700 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span className="truncate">Active Staff</span>
            <span className="size-5 sm:size-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <UserCheck className="size-3 sm:size-3.5" />
            </span>
          </div>
          <p className="font-display text-base sm:text-xl md:text-2xl font-bold text-indigo-800 mt-1 sm:mt-2 truncate">
            {activeStaffCount} <span className="text-[9px] sm:text-xs font-normal text-slate-400">/ {staffList.length}</span>
          </p>
          <p className="text-[8px] sm:text-[10px] text-indigo-600 mt-0.5 sm:mt-1 truncate hidden sm:block">
            Active in tasks today
          </p>
        </div>

        {/* Ironing in Progress */}
        <div className="bg-white p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-purple-100 bg-purple-50/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-purple-700 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span className="truncate">Ironing Active</span>
            <span className="size-5 sm:size-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Sparkles className="size-3 sm:size-3.5" />
            </span>
          </div>
          <p className="font-display text-base sm:text-xl md:text-2xl font-bold text-purple-800 mt-1 sm:mt-2 truncate">
            {todayStats?.inProgressCount ?? 0} <span className="text-[9px] sm:text-xs font-normal text-slate-400">orders</span>
          </p>
          <p className="text-[8px] sm:text-[10px] text-purple-600 mt-0.5 sm:mt-1 truncate hidden sm:block">
            Ironing in progress
          </p>
        </div>

        {/* Washing in Progress */}
        <div className="bg-white p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl border border-sky-100 bg-sky-50/30 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-sky-700 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            <span className="truncate">Washing Active</span>
            <span className="size-5 sm:size-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <Droplets className="size-3 sm:size-3.5" />
            </span>
          </div>
          <p className="font-display text-base sm:text-xl md:text-2xl font-bold text-sky-800 mt-1 sm:mt-2 truncate">
            {todayStats?.inProgressWashingCount ?? 0} <span className="text-[9px] sm:text-xs font-normal text-slate-400">orders</span>
          </p>
          <p className="text-[8px] sm:text-[10px] text-sky-600 mt-0.5 sm:mt-1 truncate hidden sm:block">
            Wash cycle running
          </p>
        </div>
      </div>

      {/* SECTION 1: Staff Performance & Earnings Report */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#0F4C5C] flex items-center gap-2">
              <TrendingUp className="size-4 text-[#0F4C5C]" />
              Staff Labour & Earnings Breakdown
            </h3>
            <p className="text-[11px] text-slate-500">
              Calculated dynamically from completed {serviceFilter === "all" ? "washing & ironing" : serviceFilter} tasks in IST timezone
            </p>
          </div>

          {/* Period Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "today" as PeriodOption, label: "Today" },
              { id: "yesterday" as PeriodOption, label: "Yesterday" },
              { id: "this_week" as PeriodOption, label: "This Week" },
              { id: "this_month" as PeriodOption, label: "This Month" },
              { id: "custom" as PeriodOption, label: "Custom Range" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  period === p.id
                    ? "bg-[#0F4C5C] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Range Picker Inputs */}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">From:</span>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">To:</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>
        )}

        {/* Total Summary Row for the Selected Period */}
        <div className="p-3 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Period Pieces:</span>
              <strong className="text-base text-slate-800 font-bold">
                {reportData?.totalPieces ?? 0} pcs
              </strong>
              {serviceFilter === "all" && reportData && (
                <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                  {reportData.totalIroningPieces ?? 0} iron · {reportData.totalWashingPieces ?? 0} wash
                </span>
              )}
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Staff Earnings:</span>
              <strong className="text-base text-emerald-700 font-bold">
                ₹{(reportData?.totalEarnings ?? 0).toLocaleString("en-IN")}
              </strong>
              {serviceFilter === "all" && reportData && (
                <span className="block text-[10px] text-emerald-600 font-medium mt-0.5">
                  ₹{(reportData.totalIroningEarnings ?? 0).toLocaleString("en-IN")} iron · ₹{(reportData.totalWashingEarnings ?? 0).toLocaleString("en-IN")} wash
                </span>
              )}
            </div>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            {reportData?.totalTasksCount ?? 0} tasks completed in this period
          </span>
        </div>

        {/* Staff Breakdown Table */}
        {/* Staff Breakdown: Mobile Cards (<sm) + Desktop Table (>=sm) */}
        {isLoadingReport ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading labour report...</div>
        ) : !reportData || reportData.staffBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No {serviceFilter === "all" ? "labour" : serviceFilter} tasks completed for the selected period.
          </div>
        ) : (
          <>
            {/* Mobile View: Clean Staff Cards */}
            <div className="space-y-3 sm:hidden">
              {reportData.staffBreakdown.map((item) => (
                <div
                  key={item.staffId}
                  onClick={() => setSelectedStaffDetail(item)}
                  className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-[#0F4C5C]/30 transition space-y-2.5 active:scale-98 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-[#0F4C5C]/10 text-[#0F4C5C] font-bold flex items-center justify-center text-xs">
                        {item.staffName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">{item.staffName}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.completedTasksCount} tasks completed
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Earnings</span>
                      <span className="text-xs font-bold text-emerald-700">
                        ₹{item.totalEarnings.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Total Pieces</span>
                      <span className="font-bold text-slate-800">{item.totalPieces} pcs</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Breakdown</span>
                      <span className="font-medium text-slate-700">
                        {item.ironingPieces ?? 0} iron · {item.washingPieces ?? 0} wash
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStaffDetail(item);
                    }}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0F4C5C] text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 active:scale-95"
                  >
                    <History className="size-3" /> View Tasks & History
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/70">
                    <th className="py-3 px-3">Staff Member</th>
                    <th className="py-3 px-3 text-center">Tasks Completed</th>
                    <th className="py-3 px-3 text-center">Total Pieces</th>
                    {serviceFilter === "all" && (
                      <>
                        <th className="py-3 px-3 text-right">Ironing</th>
                        <th className="py-3 px-3 text-right">Washing</th>
                      </>
                    )}
                    <th className="py-3 px-3 text-right">Labour Earnings</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.staffBreakdown.map((item) => (
                    <tr
                      key={item.staffId}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setSelectedStaffDetail(item)}
                    >
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-[#0F4C5C]/10 text-[#0F4C5C] font-bold flex items-center justify-center text-xs">
                            {item.staffName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">{item.staffName}</span>
                            {serviceFilter === "all" && (
                              <span className="text-[10px] text-slate-400">
                                {item.ironingPieces ?? 0} iron · {item.washingPieces ?? 0} wash
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                        {item.completedTasksCount}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                        {item.totalPieces} pcs
                      </td>
                      {serviceFilter === "all" && (
                        <>
                          <td className="py-3.5 px-3 text-right font-medium text-slate-600">
                            ₹{(item.ironingEarnings ?? 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3.5 px-3 text-right font-medium text-blue-700">
                            ₹{(item.washingEarnings ?? 0).toLocaleString("en-IN")}
                          </td>
                        </>
                      )}
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-700 text-sm">
                        ₹{item.totalEarnings.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedStaffDetail(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[#0F4C5C] text-[11px] font-bold rounded-lg transition inline-flex items-center gap-1"
                        >
                          <History className="size-3" /> View History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>


      {/* SECTION 2: Staff Member Directory & Status Management */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#0F4C5C] flex items-center gap-2">
              <Users className="size-4 text-[#0F4C5C]" />
              Staff Directory & Status
            </h3>
            <p className="text-[11px] text-slate-500">
              Active staff receive new washing and ironing assignments; inactive staff remain in all historical logs
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20"
            />
          </div>
        </div>

        {isLoadingStaff ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading staff list...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl">
            No staff members found matching "{searchQuery}".
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredStaff.map((staff) => (
              <div
                key={staff.id}
                className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:shadow-sm transition space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-full bg-slate-100 text-[#0F4C5C] font-bold flex items-center justify-center text-xs border border-slate-200/60">
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{staff.name}</h4>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Role: {staff.role}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        staff.active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {staff.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1 text-xs text-slate-600">
                    {staff.email && (
                      <p className="text-[11px] text-slate-500 truncate">Email: {staff.email}</p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      Joined: {new Date(staff.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {canManageRoles && (
                  <div className="pt-2 border-t border-slate-100 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingStaff(staff)}
                      className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Pencil className="size-3" /> Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffToToggle(staff)}
                      disabled={toggleActiveMutation.isPending}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-1 active:scale-95 ${
                        staff.active
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {staff.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL: Detailed History per Staff Member */}
      {selectedStaffDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-[#0F4C5C] text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {selectedStaffDetail.staffName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {selectedStaffDetail.staffName} — Labour History
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedStaffDetail.completedTasksCount} tasks ({selectedStaffDetail.ironingPieces ?? 0} iron · {selectedStaffDetail.washingPieces ?? 0} wash) · ₹{selectedStaffDetail.totalEarnings} total earning
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="size-8 rounded-lg hover:bg-slate-200/70 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {selectedStaffDetail.tasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No tasks logged in this period.</div>
              ) : (
                <div className="space-y-3">
                  {selectedStaffDetail.tasks.map((task) => {
                    const isWashing = task.taskType === "washing";

                    return (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                                  isWashing
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-teal-50 text-[#0F4C5C] border-teal-200"
                                }`}
                              >
                                {isWashing ? <Droplets className="size-3" /> : <Sparkles className="size-3" />}
                                {isWashing ? "Washing" : "Ironing"}
                              </span>
                              <span className="font-mono font-bold text-slate-800 text-xs">
                                Order #{task.orderId}
                              </span>
                            </div>
                            <span className="text-slate-500 text-[11px] block mt-1">
                              Customer: <strong>{task.customer}</strong>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-700 text-sm">
                              ₹{task.totalEarning}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {new Date(task.completedAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Items breakdown */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 divide-y divide-slate-100 text-[11px]">
                          {task.items.map((item, idx) => (
                            <div key={idx} className="py-1 flex justify-between items-center text-slate-600">
                              <span>
                                {item.quantity}x {item.name} @ ₹{item.staffRate}/pc ({isWashing ? "wash" : "iron"})
                              </span>
                              <strong className="text-slate-800">₹{item.staffEarning}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="px-4 py-2 bg-[#0F4C5C] text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Toggle Active Warning / Confirm */}
      {staffToToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {staffToToggle.active ? "Deactivate Staff Member?" : "Activate Staff Member?"}
                </h3>
                <p className="text-xs text-slate-500">
                  {staffToToggle.active
                    ? "Inactive staff cannot receive new washing or ironing assignments but stay in all reports."
                    : "Active staff will be available in the Washing & Ironing staff dropdowns."}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700">
              Staff Member: <span className="text-[#0F4C5C] font-bold">{staffToToggle.name}</span>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStaffToToggle(null)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => toggleActiveMutation.mutate({ workerId: staffToToggle.id })}
                disabled={toggleActiveMutation.isPending}
                className="flex-1 py-2.5 bg-[#0F4C5C] hover:bg-[#0F4C5C]/90 text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                {toggleActiveMutation.isPending ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Staff Member */}
      {showAddStaffModal && (
        <AddStaffModal
          onClose={() => setShowAddStaffModal(false)}
          onSubmit={(input) => createStaffMutation.mutate(input)}
          isSubmitting={createStaffMutation.isPending}
        />
      )}

      {/* MODAL: Edit Staff Member */}
      {editingStaff && (
        <EditStaffModal
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSubmit={(input) => updateStaffMutation.mutate(input)}
          isSubmitting={updateStaffMutation.isPending}
        />
      )}
    </div>
  );
}

function AddStaffModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (input: { name: string; role: "admin" | "manager" | "staff"; pin?: string }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "staff">("staff");
  const [pin, setPin] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Staff name is required");
    if ((role === "admin" || role === "manager") && pin.length !== 4) {
      return toast.error("4-digit security PIN is required for Admin / Manager roles");
    }
    onSubmit({ name: name.trim(), role, pin: pin || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-[#0F4C5C] flex items-center gap-2">
            <Plus className="size-4" /> Add Staff Member
          </h3>
          <button onClick={onClose} className="size-7 grid place-items-center text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ashwin, Rahul, Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-[#0F4C5C] outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-[#0F4C5C] outline-none"
            >
              <option value="staff">Staff (Washing / Ironing / Counter)</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin / Owner</option>
            </select>
          </div>

          {(role === "admin" || role === "manager") && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">4-Digit Security PIN *</label>
              <input
                type="password"
                maxLength={4}
                required
                placeholder="4 digits"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-[#0F4C5C] outline-none tracking-widest text-center font-mono font-bold"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#0F4C5C] hover:bg-[#0F4C5C]/90 text-white font-bold rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStaffModal({
  staff,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  staff: any;
  onClose: () => void;
  onSubmit: (input: { workerId: string; name: string; role: "admin" | "manager" | "staff" }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState<"admin" | "manager" | "staff">(staff.role || "staff");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Staff name is required");
    onSubmit({ workerId: staff.id, name: name.trim(), role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F4C5C]/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-[#0F4C5C]">Edit Staff Member</h3>
          <button onClick={onClose} className="size-7 grid place-items-center text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-[#0F4C5C] outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-[#0F4C5C] outline-none"
            >
              <option value="staff">Staff (Washing / Ironing / Counter)</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin / Owner</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#0F4C5C] hover:bg-[#0F4C5C]/90 text-white font-bold rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
