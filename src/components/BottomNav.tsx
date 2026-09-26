import { trpc, type Order } from "@/lib/trpc";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  LayoutDashboard,
  Plus,
  WashingMachine,
  FileText,
  Menu,
} from "lucide-react";

export type NavSection =
  | "Overview"
  | "Orders"
  | "Active process"
  | "Staff Management"
  | "Products"
  | "Customers"
  | "Expenses"
  | "Statements"
  | "Roles"
  | "Settings"
  | "Recycle Bin";

export default function BottomNav({
  activeSection,
  onNavigate,
  onNewOrder,
  onOpenMenu,
}: {
  activeSection: string;
  onNavigate: (section: NavSection) => void;
  onNewOrder: () => void;
  onOpenMenu: () => void;
}) {
  const { data: orders = [] } = trpc.orders.list.useQuery();
  const { data: recycleBinCounts } = trpc.recycleBin.counts.useQuery(undefined);
  const activeCount = orders.filter((o: Order) => o.status !== "Collected").length;
  const recycleCount = recycleBinCounts?.total ?? 0;

  const isMoreActive =
    activeSection !== "Overview" &&
    activeSection !== "Active process" &&
    activeSection !== "Orders";

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
    >
      {/* 1. Home / Dashboard */}
      <button
        type="button"
        onClick={() => onNavigate("Overview")}
        className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-150 min-w-[56px] cursor-pointer active:scale-90 select-none ${
          activeSection === "Overview"
            ? "text-[#0F4C5C] font-bold"
            : "text-slate-400 hover:text-slate-700"
        }`}
        aria-label="Overview Dashboard"
      >
        <div
          className={`p-1 rounded-xl transition-colors ${
            activeSection === "Overview" ? "bg-[#0F4C5C]/10 text-[#0F4C5C]" : ""
          }`}
        >
          <LayoutDashboard className="size-5" strokeWidth={activeSection === "Overview" ? 2.3 : 1.8} />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 font-medium">Home</span>
      </button>

      {/* 2. Process (Active Workflow) */}
      <button
        type="button"
        onClick={() => onNavigate("Active process")}
        className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-150 min-w-[56px] cursor-pointer active:scale-90 select-none ${
          activeSection === "Active process"
            ? "text-[#0F4C5C] font-bold"
            : "text-slate-400 hover:text-slate-700"
        }`}
        aria-label={`Active process, ${activeCount} active orders`}
      >
        <div
          className={`relative p-1 rounded-xl transition-colors ${
            activeSection === "Active process" ? "bg-[#0F4C5C]/10 text-[#0F4C5C]" : ""
          }`}
        >
          <WashingMachine className="size-5" strokeWidth={activeSection === "Active process" ? 2.3 : 1.8} />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1.5 size-4 bg-amber-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs ring-2 ring-white animate-in zoom-in-50">
              {activeCount > 99 ? "99+" : activeCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 font-medium">Process</span>
      </button>

      {/* 3. Center Action Button: + New Bill */}
      <button
        type="button"
        onClick={onNewOrder}
        className="flex flex-col items-center justify-center text-[#0F4C5C] active:scale-90 transition-transform duration-150 -mt-5 cursor-pointer select-none group"
        aria-label="Create New Bill"
      >
        <div className="size-12 bg-gradient-to-tr from-[#0F4C5C] to-[#176a80] text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(15,76,92,0.35)] border-3 border-white group-hover:scale-105 transition-transform">
          <Plus className="size-6" strokeWidth={2.6} />
        </div>
        <span className="text-[10px] font-bold mt-0.5 text-[#0F4C5C] tracking-tight">
          New Bill
        </span>
      </button>

      {/* 4. Bills / Orders */}
      <button
        type="button"
        onClick={() => onNavigate("Orders")}
        className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-150 min-w-[56px] cursor-pointer active:scale-90 select-none ${
          activeSection === "Orders"
            ? "text-[#0F4C5C] font-bold"
            : "text-slate-400 hover:text-slate-700"
        }`}
        aria-label="Bills and Orders"
      >
        <div
          className={`p-1 rounded-xl transition-colors ${
            activeSection === "Orders" ? "bg-[#0F4C5C]/10 text-[#0F4C5C]" : ""
          }`}
        >
          <FileText className="size-5" strokeWidth={activeSection === "Orders" ? 2.3 : 1.8} />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 font-medium">Bills</span>
      </button>

      {/* 5. Menu / More Drawer */}
      <button
        type="button"
        onClick={onOpenMenu}
        className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-150 min-w-[56px] cursor-pointer active:scale-90 select-none ${
          isMoreActive
            ? "text-[#0F4C5C] font-bold"
            : "text-slate-400 hover:text-slate-700"
        }`}
        aria-label="Open More Menu"
      >
        <div
          className={`relative p-1 rounded-xl transition-colors ${
            isMoreActive ? "bg-[#0F4C5C]/10 text-[#0F4C5C]" : ""
          }`}
        >
          <Menu className="size-5" strokeWidth={isMoreActive ? 2.3 : 1.8} />
          {recycleCount > 0 && (
            <span className="absolute -top-1 -right-1 size-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 font-medium">
          {isMoreActive ? activeSection.split(" ")[0] : "Menu"}
        </span>
      </button>
    </nav>
  );
}

