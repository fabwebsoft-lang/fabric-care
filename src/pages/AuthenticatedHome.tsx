import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { downloadInvoiceHtml } from "@/lib/invoiceGenerator";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Download,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  FileText,
  HelpCircle,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Settings,
  Shirt,
  Sparkles,
  Tag,
  UsersRound,
  WalletCards,
  WashingMachine,
  X,
  BarChart3,
  ShieldCheck,
  UserCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAccessControl } from "@/contexts/AccessControlContext";
import HelpCenterModal from "@/components/HelpCenterModal";
import { usePWAInstall, IOSInstallGuideModal } from "@/components/InstallModal";

const NewBillModal = lazy(() => import("@/components/NewBillModal"));
const ActiveProcessView = lazy(() => import("@/components/ActiveProcessView"));
const BillsView = lazy(() => import("@/components/BillsView"));
const CustomersView = lazy(() => import("@/components/CustomersView"));
const StatementsView = lazy(() => import("@/components/StatementsView"));
const SettingsViewComponent = lazy(() => import("@/components/SettingsView"));
const RolesAndAccessView = lazy(() => import("@/components/RolesAndAccessView"));
const DashboardView = lazy(() => import("@/components/DashboardView"));
const ExpensesView = lazy(() => import("@/components/ExpensesView"));
const ProductsView = lazy(() => import("@/components/ProductsView"));
const RecycleBinView = lazy(() => import("@/components/RecycleBinView"));
const StaffManagementView = lazy(() => import("@/components/StaffManagementView"));

type Section =
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

type Order = {
  id: string;
  customer: string;
  phone: string;
  items: string;
  amount: string;
  balance: string;
  status: "Received" | "Processing" | "Ironing" | "Ready" | "Collected";
  due: string;
  initials: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  amountPaid: number;
  structuredItems: { name: string; quantity: number; price: number }[];
};

type OverviewMetrics = {
  todaysRevenue: number;
  collectedToday: number;
  pendingDues: number;
  inProcessCount: number;
  readyCount: number;
  ordersReceived: number;
  itemsInProcess: number;
  processCounts: { Received: number; Processing: number; Ironing: number; Ready: number };
};

type ShopSettings = {
  name: string;
  address: string;
  customerNotifications: boolean;
  pricingTier: string;
};

type NewOrderInput = {
  customerName: string;
  phone: string;
  items: { name: string; quantity: number; price: number }[];
  serviceType: string;
  totalAmount: number;
  amountPaid: number;
};

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Orders", icon: ClipboardList },
  { label: "Active process", icon: WashingMachine },
  { label: "Staff Management", icon: UsersRound },
  { label: "Products", icon: Shirt },
  { label: "Customers", icon: UserCheck },
  { label: "Expenses", icon: WalletCards },
  { label: "Statements", icon: BarChart3 },
  { label: "Recycle Bin", icon: Trash2 },
];

const money = (value: string) => Number(value.replace(/[^0-9]/g, ""));
const uniqueOrders = (orderList: Order[]) =>
  Array.from(new Map(orderList.map((order) => [order.id, order])).values());

export default function AuthenticatedHome({
  user,
  logout,
}: {
  user: any;
  logout: () => Promise<void> | void;
}) {
  const { role: activeRole, canViewReports, canManageRoles } = useAccessControl();
  const { installed, showIOSGuide, setShowIOSGuide, handleInstallClick } = usePWAInstall();

  const [activeSection, setActiveSection] = useState<Section>("Overview");
  const { data: apiOrders } = trpc.orders.list.useQuery(undefined);
  const { data: recycleBinCounts } = trpc.recycleBin.counts.useQuery(undefined);
  const createOrderMutation = trpc.orders.create.useMutation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics>({
    todaysRevenue: 0,
    collectedToday: 0,
    pendingDues: 0,
    inProcessCount: 0,
    readyCount: 0,
    ordersReceived: 0,
    itemsInProcess: 0,
    processCounts: { Received: 0, Processing: 0, Ironing: 0, Ready: 0 },
  });
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderCustomer, setNewOrderCustomer] = useState<any | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All status");
  const { data: apiShop } = trpc.shops.list.useQuery(undefined);
  const shop = apiShop?.[0];
  const [settingsForm, setSettingsForm] = useState<ShopSettings>({
    name: "Fabric Care - Dindigul",
    address: "17/B3, 1st street, Pandian Nagar, Dindigul",
    customerNotifications: true,
    pricingTier: "Normal + Premium",
  });
  const utils = trpc.useUtils();

  const filteredOrders = useMemo(() => {
    return uniqueOrders(orders).filter((order) => {
      const matchesQuery = `${order.id} ${order.customer} ${order.phone}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "All status" || order.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [orders, query, statusFilter]);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.label === "Statements" && !canViewReports) return false;
      return true;
    });
  }, [canViewReports]);

  useEffect(() => {
    if (!apiOrders) return;
    const nextOrders = uniqueOrders(apiOrders as Order[]);
    setOrders((currentOrders) => {
      const unchanged =
        currentOrders.length === nextOrders.length &&
        currentOrders.every((order, index) => {
          const next = nextOrders[index];
          return (
            next &&
            order.id === next.id &&
            order.status === next.status &&
            order.amount === next.amount &&
            order.balance === next.balance
          );
        });
      return unchanged ? currentOrders : nextOrders;
    });
  }, [apiOrders]);

  useEffect(() => {
    if (!shop) return;
    setSettingsForm({
      name: shop.name,
      address: shop.address ?? "",
      customerNotifications: Boolean(shop.customerNotifications),
      pricingTier: shop.pricingTier,
    });
  }, [shop]);

  useEffect(() => {
    const isToday = (dateStr?: string | Date | null) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };
    const active = orders.filter((order) => order.status !== "Collected");
    const today = orders.filter((order) => isToday(order.createdAt));
    const processCounts = {
      Received: active.filter((order) => order.status === "Received").length,
      Processing: active.filter((order) => order.status === "Processing").length,
      Ironing: active.filter((order) => order.status === "Ironing").length,
      Ready: active.filter((order) => order.status === "Ready").length,
    };
    setOverviewMetrics({
      todaysRevenue: today.reduce((sum, order) => sum + money(order.amount), 0),
      collectedToday: today.reduce((sum, order) => sum + order.amountPaid, 0),
      pendingDues: orders.reduce(
        (sum, order) => sum + Math.max(0, order.totalAmount - order.amountPaid),
        0
      ),
      inProcessCount: active.length,
      readyCount: processCounts.Ready,
      ordersReceived: today.length,
      itemsInProcess: active.reduce(
        (sum, order) =>
          sum + order.structuredItems.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      ),
      processCounts,
    });
  }, [orders]);

  const navigate = (section: Section) => {
    setActiveSection(section);
    setStatusFilter("All status");
    setShowNotifications(false);
    setShowProfileMenu(false);
    setShowHelp(false);
    setShowMobileNav(false);
  };

  const sectionTitle =
    activeSection === "Overview"
      ? `Welcome, ${user?.name || "Ashfaq"}`
      : activeSection === "Roles"
      ? "Roles & Access Control"
      : activeSection;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  // Lock background scroll and handle Escape when mobile nav is open
  useEffect(() => {
    if (showMobileNav) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setShowMobileNav(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showMobileNav]);

  const createOrder = (input: NewOrderInput) => {
    createOrderMutation.mutate(input, {
      onSuccess: (createdOrder) => {
        setOrders((currentOrders) => uniqueOrders([createdOrder as Order, ...currentOrders]));
        toast.success(`${createdOrder.id} created`, {
          description: `${createdOrder.customer} · saved to the database`,
        });
      },
      onError: (error) => toast.error("Could not save the order", { description: error.message }),
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#0F4C5C] selection:bg-slate-100 selection:text-[#0F4C5C] w-full max-w-full overflow-x-hidden">
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
        <aside className="hidden w-[254px] shrink-0 flex-col justify-between bg-[#0F4C5C] px-5 py-6 text-white lg:flex">
          <div>
            <div className="mb-10 flex items-center gap-3 px-2">
              <div className="grid size-10 place-items-center rounded-[14px] bg-[#F7F3EE] shadow-[0_8px_20px_rgba(15,76,92,.18)]">
                <img
                  src="/fabric-care-logo.png"
                  alt="Fabric Care logo"
                  width="28"
                  height="28"
                  className="size-7 object-contain"
                />
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold tracking-tight">Fabric Care</p>
                <p className="text-[10px] font-medium uppercase tracking-[.16em] text-[#F7F3EE]">
                  You wear, we care
                </p>
              </div>
            </div>

            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">
              Workspace
            </p>
            <nav className="space-y-1.5">
              {visibleNavItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => navigate(label)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all duration-150 ${
                    activeSection === label
                      ? "bg-white/15 text-white shadow-inner shadow-white/[.03]"
                      : "text-white/80 hover:bg-white/[.10] hover:text-white"
                  }`}
                >
                  <Icon
                    className={`size-[17px] ${
                      activeSection === label ? "text-white" : "text-white/80 group-hover:text-white"
                    }`}
                    strokeWidth={1.9}
                  />
                  <span className="flex-1">{label}</span>
                  {label === "Active process" && overviewMetrics.inProcessCount > 0 && (
                    <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {overviewMetrics.inProcessCount}
                    </span>
                  )}
                  {label === "Recycle Bin" && (recycleBinCounts?.total ?? 0) > 0 && (
                    <span className="rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                      {recycleBinCounts?.total}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="my-8 h-px bg-white/[.09]" />
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">
              Manage
            </p>
            <nav className="space-y-1.5">
              {canManageRoles && (
                <button
                  onClick={() => navigate("Roles")}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all ${
                    activeSection === "Roles"
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/[.10] hover:text-white"
                  }`}
                >
                  <ShieldCheck
                    className="size-[17px] text-white/80 group-hover:text-white"
                    strokeWidth={1.9}
                  />{" "}
                  Roles & Access
                </button>
              )}
              <button
                onClick={() => navigate("Settings")}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all ${
                  activeSection === "Settings"
                    ? "bg-white/15 text-white"
                    : "text-white/80 hover:bg-white/[.10] hover:text-white"
                }`}
              >
                <Settings
                  className="size-[17px] text-white/80 group-hover:text-white"
                  strokeWidth={1.9}
                />{" "}
                Settings
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-white/80 transition-all hover:bg-white/[.10] hover:text-white"
              >
                <HelpCircle
                  className="size-[17px] text-white/80 group-hover:text-white"
                  strokeWidth={1.9}
                />{" "}
                Help center
              </button>
              {!installed && (
                <button
                  onClick={handleInstallClick}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-emerald-300 transition-all hover:bg-white/[.10] hover:text-emerald-200"
                >
                  <Download
                    className="size-[17px] text-emerald-300 group-hover:text-emerald-200"
                    strokeWidth={1.9}
                  />{" "}
                  Install App
                </button>
              )}
            </nav>
          </div>

          <div className="space-y-2 mt-auto">
            <div className="rounded-2xl border border-white/[.08] bg-white/[.045] p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-medium text-white/80">
                  <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(102,216,165,.12)]" />{" "}
                  Cloud sync on
                </span>
                <ChevronRight className="size-3.5 text-white/60" />
              </div>
              <p className="text-[10px] leading-4 text-white/60">
                Last synced just now across 2 devices
              </p>
            </div>

            <div className="pt-2 pb-1 text-center">
              <a
                href="https://mallist.online"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-col items-center group transition py-0.5"
              >
                <span className="text-[10px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                  Powered by Mallist
                </span>
                <span className="text-[9px] text-white/35 group-hover:text-white/60 transition-colors">
                  mallist.online
                </span>
              </a>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0 w-full max-w-full overflow-x-hidden">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-3.5 sm:px-8 lg:px-10 backdrop-blur-xl w-full max-w-full">
            <div className="flex items-center gap-3">
              <button
                className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-slate-200 bg-white text-[#0F4C5C] transition hover:border-slate-300 hover:text-[#0F4C5C] focus-visible:ring-2 focus-visible:ring-[#0F4C5C] lg:hidden shrink-0 cursor-pointer"
                onClick={() => setShowMobileNav(true)}
                aria-label="Open navigation menu"
                aria-expanded={showMobileNav}
              >
                <Menu className="size-[20px]" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="hidden text-[11px] font-semibold uppercase tracking-[.13em] text-[#0F4C5C] sm:block">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <h1 className="font-display text-[18px] font-semibold tracking-[-.02em] text-[#0F4C5C] sm:text-[20px] truncate">
                  {sectionTitle}
                </h1>
              </div>
            </div>
            <div className="relative flex items-center gap-2 sm:gap-3 shrink-0">
              {canManageRoles ? (
                <button
                  type="button"
                  onClick={() => navigate("Roles")}
                  className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex hover:border-[#0F4C5C]/30 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] transition cursor-pointer"
                  title="Click to view permissions and switch role in simulator"
                  aria-label={`Role simulator, current role: ${activeRole}`}
                >
                  <ShieldCheck className="size-3.5 text-[#0F4C5C]" aria-hidden="true" />
                  <span className="text-[11px] font-bold text-[#0F4C5C] capitalize">
                    {activeRole}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0F4C5C]/10 text-[#0F4C5C] font-bold uppercase">
                    Role
                  </span>
                </button>
              ) : (
                <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex">
                  <ShieldCheck className="size-3.5 text-[#0F4C5C]" aria-hidden="true" />
                  <span className="text-[11px] font-bold text-[#0F4C5C] capitalize">
                    {activeRole}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowNotifications((value) => !value);
                  setShowProfileMenu(false);
                }}
                className="relative grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-slate-200 bg-white text-[#0F4C5C] transition hover:border-slate-300 hover:text-[#0F4C5C] focus-visible:ring-2 focus-visible:ring-[#0F4C5C] cursor-pointer"
                aria-label="Notifications"
                aria-expanded={showNotifications}
              >
                <Bell className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                {!notificationsRead && (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-[#0F4C5C] ring-2 ring-white" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu((value) => !value);
                  setShowNotifications(false);
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] cursor-pointer"
                aria-label={`User menu for ${user?.name ?? "Ashfaq"}`}
                aria-expanded={showProfileMenu}
              >
                <div className="grid size-7 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-[#0F4C5C]">
                  {(user?.name ?? "Ashfaq")
                    .split(" ")
                    .map((part: string) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span className="hidden text-[11px] font-semibold text-[#0F4C5C] sm:block">
                  {user?.name ?? "Ashfaq"}
                </span>
                <ChevronDown className="hidden size-3.5 text-[#0F4C5C] sm:block" aria-hidden="true" />
              </button>
              {showNotifications && (
                <NotificationPanel
                  orders={orders}
                  notificationsEnabled={settingsForm.customerNotifications}
                  onMarkRead={() => setNotificationsRead(true)}
                  onClose={() => setShowNotifications(false)}
                />
              )}
              {showProfileMenu && (
                <ProfileMenu
                  user={user}
                  activeRole={activeRole}
                  canManageRoles={canManageRoles}
                  onSettings={() => navigate("Settings")}
                  onRoles={() => navigate("Roles")}
                  onClose={() => setShowProfileMenu(false)}
                  onLogout={async () => {
                    try {
                      await logout();
                      toast.success("Signed out");
                    } catch (logoutError) {
                      toast.error("Could not sign out", {
                        description:
                          logoutError instanceof Error
                            ? logoutError.message
                            : "Please try again.",
                      });
                    }
                  }}
                />
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[1480px] px-3 py-4 sm:px-8 sm:py-6 lg:px-10 lg:py-8 w-full max-w-full overflow-x-hidden">
            <SectionView
              section={activeSection}
              onNewOrder={(cust?: any) => {
                if (
                  cust &&
                  typeof cust === "object" &&
                  typeof cust.name === "string" &&
                  cust.name.trim() !== "" &&
                  cust.name.toLowerCase() !== "undefined"
                ) {
                  setNewOrderCustomer(cust);
                } else {
                  setNewOrderCustomer(null);
                }
                setShowNewOrder(true);
              }}
              onNavigate={(s: any) => navigate(s)}
            />
          </div>
        </main>
      </div>

      {showMobileNav && (
        <div
          className="fixed inset-0 z-40 bg-[#0F4C5C]/40 backdrop-blur-xs lg:hidden"
          onClick={() => setShowMobileNav(false)}
          aria-hidden="true"
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Main Navigation Menu"
            className="flex h-full w-[min(82vw,300px)] flex-col justify-between bg-[#0F4C5C] px-5 py-6 text-white shadow-[18px_0_50px_rgba(15,76,92,.25)] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-[14px] bg-[#F7F3EE] shadow-[0_8px_20px_rgba(15,76,92,.18)]">
                    <img
                      src="/fabric-care-logo.png"
                      alt="Fabric Care logo"
                      width="28"
                      height="28"
                      className="size-7 object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-display text-[17px] font-semibold tracking-tight">
                      Fabric Care
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-[.16em] text-[#F7F3EE]">
                      You wear, we care
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileNav(false)}
                  className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl text-white/80 hover:bg-white/[.12] hover:text-white shrink-0 focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                  aria-label="Close navigation"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">
                Workspace
              </p>
              <nav className="space-y-1 mb-6" aria-label="Workspace navigation">
                {visibleNavItems.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      navigate(label);
                      setShowMobileNav(false);
                    }}
                    className={`group flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-white cursor-pointer ${
                      activeSection === label
                        ? "bg-white/15 text-white shadow-inner"
                        : "text-white/80 hover:bg-white/[.10] hover:text-white"
                    }`}
                  >
                    <Icon className="size-[18px] text-white/80" strokeWidth={1.9} aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {label === "Active process" && overviewMetrics.inProcessCount > 0 && (
                      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {overviewMetrics.inProcessCount}
                      </span>
                    )}
                    {label === "Recycle Bin" && (recycleBinCounts?.total ?? 0) > 0 && (
                      <span className="rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                        {recycleBinCounts?.total}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="my-5 h-px bg-white/[.09]" />
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">
                Manage
              </p>
              <nav className="space-y-1.5" aria-label="Management navigation">
                {canManageRoles && (
                  <button
                    onClick={() => {
                      setShowMobileNav(false);
                      navigate("Roles");
                    }}
                    className="group flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[.10] hover:text-white focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                  >
                    <ShieldCheck className="size-[18px] text-white/80" strokeWidth={1.9} aria-hidden="true" /> Roles &
                    Access
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMobileNav(false);
                    navigate("Settings");
                  }}
                  className="group flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[.10] hover:text-white focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                >
                  <Settings className="size-[18px] text-white/80" strokeWidth={1.9} aria-hidden="true" /> Settings
                </button>
                <button
                  onClick={() => {
                    setShowMobileNav(false);
                    setShowHelp(true);
                  }}
                  className="group flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[.10] hover:text-white focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                >
                  <HelpCircle className="size-[18px] text-white/80" strokeWidth={1.9} aria-hidden="true" /> Help
                  center
                </button>
                {!installed && (
                  <button
                    onClick={() => {
                      setShowMobileNav(false);
                      handleInstallClick();
                    }}
                    className="group flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-emerald-300 hover:bg-white/[.10] hover:text-emerald-200 focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                  >
                    <Download className="size-[18px] text-emerald-300" strokeWidth={1.9} aria-hidden="true" /> Install
                    App
                  </button>
                )}
              </nav>
            </div>
            <div className="space-y-2 mt-auto">
              <div className="rounded-2xl border border-white/[.08] bg-white/[.045] p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[11px] font-medium text-white/80">
                    <span className="size-2 rounded-full bg-emerald-400" /> Cloud sync on
                  </span>
                  <ChevronRight className="size-3.5 text-white/60" />
                </div>
                <p className="text-[10px] leading-4 text-white/60">
                  Last synced just now across 2 devices
                </p>
              </div>
              <div className="pt-2 pb-1 text-center">
                <a
                  href="https://mallist.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-col items-center group transition py-0.5"
                >
                  <span className="text-[10px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                    Powered by Mallist
                  </span>
                  <span className="text-[9px] text-white/35 group-hover:text-white/60 transition-colors">
                    mallist.online
                  </span>
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) */}
      {!showNewOrder && (
        <button
          onClick={() => {
            if (activeSection === "Customers") {
              window.dispatchEvent(new CustomEvent("open-add-customer"));
            } else {
              setNewOrderCustomer(null);
              setShowNewOrder(true);
            }
          }}
          aria-label={activeSection === "Customers" ? "Add Customer" : "New Bill"}
          title={activeSection === "Customers" ? "Add Customer" : "New Bill"}
          className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-30 flex size-14 items-center justify-center rounded-full bg-[#0F4C5C] text-white shadow-[0_8px_25px_rgba(15,76,92,0.38)] transition-all hover:scale-105 active:scale-95 lg:hidden border-2 border-white/25 focus:outline-none focus:ring-4 focus:ring-[#0F4C5C]/30 cursor-pointer"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </button>
      )}

      {showNewOrder && (
        <Suspense fallback={null}>
          <NewBillModal
            initialCustomer={newOrderCustomer}
            onClose={() => {
              setShowNewOrder(false);
              setNewOrderCustomer(null);
            }}
            onSuccess={() => {
              setShowNewOrder(false);
              setNewOrderCustomer(null);
            }}
          />
        </Suspense>
      )}
      {showHelp && <HelpCenterModal onClose={() => setShowHelp(false)} />}
      {showIOSGuide && <IOSInstallGuideModal onClose={() => setShowIOSGuide(false)} />}
    </div>
  );
}

function NotificationPanel({
  orders,
  notificationsEnabled,
  onMarkRead,
  onClose,
}: {
  orders: Order[];
  notificationsEnabled: boolean;
  onMarkRead: () => void;
  onClose: () => void;
}) {
  const readyOrders = orders.filter((order) => order.status === "Ready");
  const dueOrders = orders.filter((order) => order.balance !== "Paid");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="absolute right-0 sm:right-[54px] top-[52px] z-30 w-[300px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_rgba(17,17,17,.12)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-[#0F4C5C]">Notifications</p>
            <p className="mt-1 text-[10px] text-slate-600">Live from your current orders</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-[#0F4C5C]">
            {notificationsEnabled ? readyOrders.length + dueOrders.length : 0} new
          </span>
        </div>
        {notificationsEnabled ? (
          <div className="space-y-3 text-[11px] text-slate-700">
            {readyOrders.length ? (
              <p>
                <span className="font-semibold text-[#0F4C5C]">
                  {readyOrders.length} order{readyOrders.length === 1 ? " is" : "s are"}
                </span>{" "}
                ready for pickup.
              </p>
            ) : null}
            {dueOrders.length ? (
              <p>
                <span className="font-semibold text-[#0F4C5C]">
                  {dueOrders.length} customer{dueOrders.length === 1 ? " has" : "s have"}
                </span>{" "}
                an outstanding balance.
              </p>
            ) : null}
            <p className="text-slate-600">Workspace data is synced from the database.</p>
            {!readyOrders.length && !dueOrders.length && (
              <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-slate-600">
                You are all caught up.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-600">
            Customer notifications are disabled in Settings.
          </p>
        )}
        <button
          type="button"
          onClick={onMarkRead}
          className="mt-4 w-full min-h-[44px] rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-[#0F4C5C] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] transition cursor-pointer"
        >
          Mark as read
        </button>
      </div>
    </>
  );
}

function ProfileMenu({
  user,
  activeRole,
  canManageRoles,
  onSettings,
  onRoles,
  onClose,
  onLogout,
}: {
  user: { name?: string | null; email?: string | null; role?: string | null } | null;
  activeRole: string;
  canManageRoles: boolean;
  onSettings: () => void;
  onRoles: () => void;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="User profile menu"
        className="absolute right-0 top-[52px] z-30 w-[270px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_rgba(17,17,17,.12)]"
      >
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200/80 p-3">
          <div className="grid size-10 place-items-center rounded-xl bg-white text-[11px] font-bold text-[#0F4C5C] shadow-2xs border border-slate-200/60">
            {(user?.name ?? "Ashfaq")
              .split(" ")
              .map((part: string) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-[#0F4C5C]">{user?.name ?? "Ashfaq"}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-600">
              {user?.email ?? "asfaq94.md@gmail.com"}
            </p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#0F4C5C]/10 text-[#0F4C5C] text-[9px] font-bold uppercase">
              Role: {activeRole}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          {canManageRoles && (
            <button
              type="button"
              onClick={onRoles}
              className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#0F4C5C] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] transition cursor-pointer"
            >
              <ShieldCheck className="size-4" aria-hidden="true" /> Roles & access control
            </button>
          )}
          <button
            type="button"
            onClick={onSettings}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#0F4C5C] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] transition cursor-pointer"
          >
            <Settings className="size-4" aria-hidden="true" /> Account and shop settings
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-600 transition cursor-pointer"
          >
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>
    </>
  );
}

function ViewFallback() {
  return (
    <div className="space-y-4 py-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-[#0F4C5C]/10" />
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="h-28 rounded-2xl bg-white/70 shadow-sm" />
        <div className="h-28 rounded-2xl bg-white/70 shadow-sm" />
        <div className="h-28 rounded-2xl bg-white/70 shadow-sm" />
        <div className="h-28 rounded-2xl bg-white/70 shadow-sm" />
      </div>
      <div className="h-64 rounded-2xl bg-white/70 shadow-sm" />
    </div>
  );
}

function SectionView({
  section,
  onNewOrder,
  onNavigate,
}: {
  section: Section;
  onNewOrder: (cust?: any) => void;
  onNavigate: (section: Section) => void;
}) {
  return (
    <Suspense fallback={<ViewFallback />}>
      {section === "Active process" && (
        <ActiveProcessView
          onNewOrder={onNewOrder}
          onNavigateToOrders={() => onNavigate("Orders")}
          onNavigateToProducts={() => onNavigate("Products")}
        />
      )}
      {section === "Orders" && <BillsView onNewOrder={onNewOrder} />}
      {section === "Staff Management" && <StaffManagementView />}
      {section === "Products" && <ProductsView onNewOrder={onNewOrder} />}
      {section === "Customers" && <CustomersView onNewOrder={onNewOrder} />}
      {section === "Statements" && <StatementsView />}
      {section === "Roles" && <RolesAndAccessView />}
      {section === "Settings" && <SettingsViewComponent />}
      {section === "Expenses" && <ExpensesView />}
      {section === "Recycle Bin" && <RecycleBinView />}
      {section === "Overview" && (
        <DashboardView onNavigate={onNavigate} onNewOrder={onNewOrder} />
      )}
    </Suspense>
  );
}
