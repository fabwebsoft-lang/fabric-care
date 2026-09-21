import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { downloadInvoiceHtml } from "@/lib/invoiceGenerator";
import AuthScreen from "@/components/AuthScreen";
import ContactAdminScreen from "@/components/ContactAdminScreen";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Database,
  Download,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  Droplets,
  FileText,
  Filter,
  HelpCircle,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  Save,
  Settings,
  Shirt,
  Sparkles,
  Store,
  Tag,
  UserRound,
  UsersRound,
  WalletCards,
  WashingMachine,
  X,
  Zap,
  BarChart3,
  ShieldCheck,
  Crown,
  Briefcase,
  UserCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAccessControl, ROLE_DEFINITIONS } from "@/contexts/AccessControlContext";
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

type Section = "Overview" | "Orders" | "Active process" | "Products" | "Customers" | "Expenses" | "Statements" | "Roles" | "Settings" | "Recycle Bin";

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
  { label: "Products", icon: Shirt },
  { label: "Customers", icon: UsersRound },
  { label: "Expenses", icon: WalletCards },
  { label: "Statements", icon: BarChart3 },
  { label: "Recycle Bin", icon: Trash2 },
];

const catalogItems = [
  { label: "Shirts", price: 80 },
  { label: "Pants", price: 110 },
  { label: "Dresses", price: 180 },
  { label: "Blankets", price: 260 },
  { label: "Sarees", price: 150 },
  { label: "Curtains", price: 220 },
];

const money = (value: string) => Number(value.replace(/[^0-9]/g, ""));
const uniqueOrders = (orderList: Order[]) => Array.from(new Map(orderList.map((order) => [order.id, order])).values());
export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();
  const { role: activeRole, canViewReports, canManageRoles, setRole, isSimulating } = useAccessControl();
  const { installed, showIOSGuide, setShowIOSGuide, handleInstallClick } = usePWAInstall();

  const hasApprovedAccess = isAuthenticated && user?.role !== "pending";

  const [activeSection, setActiveSection] = useState<Section>("Overview");
  const { data: apiOrders } = trpc.orders.list.useQuery(undefined, { enabled: hasApprovedAccess });
  const { data: recycleBinCounts } = trpc.recycleBin.counts.useQuery(undefined, { enabled: hasApprovedAccess });
  const createOrderMutation = trpc.orders.create.useMutation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics>({ todaysRevenue: 0, collectedToday: 0, pendingDues: 0, inProcessCount: 0, readyCount: 0, ordersReceived: 0, itemsInProcess: 0, processCounts: { Received: 0, Processing: 0, Ironing: 0, Ready: 0 } });
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderCustomer, setNewOrderCustomer] = useState<any | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All status");
  const { data: apiShop } = trpc.shops.list.useQuery(undefined, { enabled: hasApprovedAccess });
  const shop = apiShop?.[0];
  const [settingsForm, setSettingsForm] = useState<ShopSettings>({ name: "Fabric Care - Dindigul", address: "17/B3, 1st street, Pandian Nagar, Dindigul", customerNotifications: true, pricingTier: "Normal + Premium" });
  const utils = trpc.useUtils();
  const updateShopMutation = trpc.shops.updateSettings.useMutation({
    onSuccess: async (updated) => {
      utils.shops.list.setData(undefined, [updated]);
      await utils.shops.list.invalidate();
      toast.success("Shop settings saved", { description: `${updated.name} · saved to the database` });
    },
    onError: (mutationError) => toast.error("Could not save shop settings", { description: mutationError.message }),
  });
  const recordBackupMutation = trpc.shops.recordBackup.useMutation({
    onSuccess: async (result) => {
      utils.shops.list.setData(undefined, (current: any) => current?.map((entry: any) => ({ ...entry, lastBackupAt: result.lastBackupAt })));
      await utils.shops.list.invalidate();
      toast.success("Backup recorded", { description: "The latest workspace snapshot is saved." });
    },
    onError: (mutationError) => toast.error("Could not record backup", { description: mutationError.message }),
  });

  const filteredOrders = useMemo(() => {
    return uniqueOrders(orders).filter((order) => {
      const matchesQuery = `${order.id} ${order.customer} ${order.phone}`.toLowerCase().includes(query.toLowerCase());
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
      const unchanged = currentOrders.length === nextOrders.length && currentOrders.every((order, index) => {
        const next = nextOrders[index];
        return next && order.id === next.id && order.status === next.status && order.amount === next.amount && order.balance === next.balance;
      });
      return unchanged ? currentOrders : nextOrders;
    });
  }, [apiOrders]);

  useEffect(() => {
    if (!shop) return;
    setSettingsForm({ name: shop.name, address: shop.address ?? "", customerNotifications: Boolean(shop.customerNotifications), pricingTier: shop.pricingTier });
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
      pendingDues: orders.reduce((sum, order) => sum + Math.max(0, order.totalAmount - order.amountPaid), 0),
      inProcessCount: active.length,
      readyCount: processCounts.Ready,
      ordersReceived: today.length,
      itemsInProcess: active.reduce((sum, order) => sum + order.structuredItems.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
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

  const sectionTitle = activeSection === "Overview" ? `Welcome, ${user?.name || "Ashfaq"}` : activeSection === "Roles" ? "Roles & Access Control" : activeSection;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  const createOrder = (input: NewOrderInput) => {
    createOrderMutation.mutate(input, {
      onSuccess: (createdOrder) => {
        setOrders((currentOrders) => uniqueOrders([createdOrder as Order, ...currentOrders]));
        toast.success(`${createdOrder.id} created`, { description: `${createdOrder.customer} · saved to the database` });
      },
      onError: (error) => toast.error("Could not save the order", { description: error.message }),
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="size-8 animate-spin rounded-full border-3 border-[#0F4C5C] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (user?.role === "pending") {
    return <ContactAdminScreen name={user?.name} />;
  }

  return (
    <div className="min-h-screen bg-white text-[#0F4C5C] selection:bg-slate-100 selection:text-[#0F4C5C]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[254px] shrink-0 flex-col justify-between bg-[#0F4C5C] px-5 py-6 text-white lg:flex">
          <div>
            <div className="mb-10 flex items-center gap-3 px-2">
              <div className="grid size-10 place-items-center rounded-[14px] bg-[#F7F3EE] shadow-[0_8px_20px_rgba(15,76,92,.18)]">
                <img src="/fabric-care-logo.png" alt="Fabric Care logo" className="size-7 object-contain" />
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold tracking-tight">Fabric Care</p>
                <p className="text-[10px] font-medium uppercase tracking-[.16em] text-[#F7F3EE]">You wear, we care</p>
              </div>
            </div>

            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">Workspace</p>
            <nav className="space-y-1.5">
              {visibleNavItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => navigate(label)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all duration-150 ${activeSection === label ? "bg-white/15 text-white shadow-inner shadow-white/[.03]" : "text-white/80 hover:bg-white/[.10] hover:text-white"}`}
                >
                  <Icon className={`size-[17px] ${activeSection === label ? "text-white" : "text-white/80 group-hover:text-white"}`} strokeWidth={1.9} />
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
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">Manage</p>
            <nav className="space-y-1.5">
              {canManageRoles && (
                <button onClick={() => navigate("Roles")} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all ${activeSection === "Roles" ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/[.10] hover:text-white"}`}>
                  <ShieldCheck className="size-[17px] text-white/80 group-hover:text-white" strokeWidth={1.9} /> Roles & Access
                </button>
              )}
              <button onClick={() => navigate("Settings")} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all ${activeSection === "Settings" ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/[.10] hover:text-white"}`}>
                <Settings className="size-[17px] text-white/80 group-hover:text-white" strokeWidth={1.9} /> Settings
              </button>
              <button onClick={() => setShowHelp(true)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-white/80 transition-all hover:bg-white/[.10] hover:text-white">
                <HelpCircle className="size-[17px] text-white/80 group-hover:text-white" strokeWidth={1.9} /> Help center
              </button>
              {!installed && (
                <button
                  onClick={handleInstallClick}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-emerald-300 transition-all hover:bg-white/[.10] hover:text-emerald-200"
                >
                  <Download className="size-[17px] text-emerald-300 group-hover:text-emerald-200" strokeWidth={1.9} /> Install App
                </button>
              )}
            </nav>
          </div>

          <div className="space-y-2 mt-auto">
            <div className="rounded-2xl border border-white/[.08] bg-white/[.045] p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-medium text-white/80"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(102,216,165,.12)]" /> Cloud sync on</span>
                <ChevronRight className="size-3.5 text-white/60" />
              </div>
              <p className="text-[10px] leading-4 text-white/60">Last synced just now across 2 devices</p>
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

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <button className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-[#0F4C5C] transition hover:border-slate-300 hover:text-[#0F4C5C] lg:hidden" onClick={() => setShowMobileNav(true)} aria-label="Open navigation"><Menu className="size-[18px]" /></button>
              <div>
                <p className="hidden text-[11px] font-semibold uppercase tracking-[.13em] text-[#0F4C5C] sm:block">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                <p className="font-display text-[18px] font-semibold tracking-[-.02em] text-[#0F4C5C] sm:text-[20px]">{sectionTitle}</p>
              </div>
            </div>
            <div className="relative flex items-center gap-2 sm:gap-3">
              {/* Role badge — clickable (opens the role simulator) for admins only */}
              {canManageRoles ? (
                <button
                  onClick={() => navigate("Roles")}
                  className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex hover:border-[#0F4C5C]/30 transition"
                  title="Click to view permissions and switch role in simulator"
                >
                  <ShieldCheck className="size-3.5 text-[#0F4C5C]" />
                  <span className="text-[11px] font-bold text-[#0F4C5C] capitalize">{activeRole}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0F4C5C]/10 text-[#0F4C5C] font-bold uppercase">
                    Role
                  </span>
                </button>
              ) : (
                <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex">
                  <ShieldCheck className="size-3.5 text-[#0F4C5C]" />
                  <span className="text-[11px] font-bold text-[#0F4C5C] capitalize">{activeRole}</span>
                </div>
              )}

              <button onClick={() => { setShowNotifications((value) => !value); setShowProfileMenu(false); }} className="relative grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-[#0F4C5C] transition hover:border-slate-300 hover:text-[#0F4C5C]" aria-label="Notifications">
                <Bell className="size-[17px]" strokeWidth={1.8} />
                {!notificationsRead && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#0F4C5C] ring-2 ring-white" />}
              </button>
              <button onClick={() => { setShowProfileMenu((value) => !value); setShowNotifications(false); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:border-slate-300">
                <div className="grid size-7 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-[#0F4C5C]">{(user?.name ?? "Ashfaq").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
                <span className="hidden text-[11px] font-semibold text-[#0F4C5C] sm:block">{user?.name ?? "Ashfaq"}</span>
                <ChevronDown className="hidden size-3.5 text-[#0F4C5C] sm:block" />
              </button>
              {showNotifications && <NotificationPanel orders={orders} notificationsEnabled={settingsForm.customerNotifications} onMarkRead={() => setNotificationsRead(true)} />}
              {showProfileMenu && (
                <ProfileMenu
                  user={user}
                  activeRole={activeRole}
                  canManageRoles={canManageRoles}
                  onSettings={() => navigate("Settings")}
                  onRoles={() => navigate("Roles")}
                  onLogout={async () => {
                    try {
                      await logout();
                      toast.success("Signed out");
                    } catch (logoutError) {
                      toast.error("Could not sign out", {
                        description: logoutError instanceof Error ? logoutError.message : "Please try again.",
                      });
                    }
                  }}
                />
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[1480px] px-3.5 py-4 sm:px-8 sm:py-6 lg:px-10 lg:py-8">
            <SectionView
              section={activeSection}
              onNewOrder={(cust?: any) => {
                setNewOrderCustomer(cust || null);
                setShowNewOrder(true);
              }}
              onNavigate={(s: any) => navigate(s)}
            />
          </div>
        </main>
      </div>

      {showMobileNav && <div className="fixed inset-0 z-40 bg-[#0F4C5C]/35 backdrop-blur-[2px] lg:hidden" onClick={() => setShowMobileNav(false)}>
        <aside className="flex h-full w-[min(82vw,300px)] flex-col justify-between bg-[#0F4C5C] px-5 py-6 text-white shadow-[18px_0_50px_rgba(15,76,92,.25)]" onClick={(event) => event.stopPropagation()}>
          <div>
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-[14px] bg-[#F7F3EE] shadow-[0_8px_20px_rgba(15,76,92,.18)]">
                  <img src="/fabric-care-logo.png" alt="Fabric Care logo" className="size-7 object-contain" />
                </div>
                <div>
                  <p className="font-display text-[17px] font-semibold tracking-tight">Fabric Care</p>
                  <p className="text-[10px] font-medium uppercase tracking-[.16em] text-[#F7F3EE]">You wear, we care</p>
                </div>
              </div>
              <button
                onClick={() => setShowMobileNav(false)}
                className="grid size-9 place-items-center rounded-xl text-white/80 hover:bg-white/[.12] hover:text-white shrink-0"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">Workspace</p>
            <nav className="space-y-1 mb-6">
              {visibleNavItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    navigate(label);
                    setShowMobileNav(false);
                  }}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-150 ${
                    activeSection === label
                      ? "bg-white/15 text-white shadow-inner"
                      : "text-white/80 hover:bg-white/[.10] hover:text-white"
                  }`}
                >
                  <Icon className="size-[17px] text-white/80" strokeWidth={1.9} />
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
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/60">Manage</p>
            <nav className="space-y-1.5">
              {canManageRoles && (
                <button onClick={() => { setShowMobileNav(false); navigate("Roles"); }} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[.10] hover:text-white">
                  <ShieldCheck className="size-[17px] text-white/80" strokeWidth={1.9} /> Roles & Access
                </button>
              )}
              <button onClick={() => { setShowMobileNav(false); navigate("Settings"); }} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[.10] hover:text-white"><Settings className="size-[17px] text-white/80" strokeWidth={1.9} /> Settings</button>
              <button onClick={() => { setShowMobileNav(false); setShowHelp(true); }} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/[.10] hover:text-white"><HelpCircle className="size-[17px] text-white/80" strokeWidth={1.9} /> Help center</button>
              {!installed && (
                <button
                  onClick={() => {
                    setShowMobileNav(false);
                    handleInstallClick();
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-emerald-300 hover:bg-white/[.10] hover:text-emerald-200"
                >
                  <Download className="size-[17px] text-emerald-300" strokeWidth={1.9} /> Install App
                </button>
              )}
            </nav>
          </div>
          <div className="space-y-2 mt-auto">
            <div className="rounded-2xl border border-white/[.08] bg-white/[.045] p-3.5"><div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-[11px] font-medium text-white/80"><span className="size-2 rounded-full bg-emerald-400" /> Cloud sync on</span><ChevronRight className="size-3.5 text-white/60" /></div><p className="text-[10px] leading-4 text-white/60">Last synced just now across 2 devices</p></div>
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
      </div>}

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

function Overview({ onNavigate, orders, metrics }: { onNavigate: (section: Section) => void; orders: Order[]; metrics: OverviewMetrics }) {
  const chartMax = Math.max(1, ...orders.map((order) => money(order.amount)));
  return <>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Today’s revenue" value={`₹${metrics.todaysRevenue.toLocaleString("en-IN")}`} delta="Live" hint="from database" icon={IndianRupee} tone="blue" />
      <MetricCard label="Collected today" value={`₹${metrics.collectedToday.toLocaleString("en-IN")}`} delta="Live" hint="from database" icon={CircleDollarSign} tone="mint" />
      <MetricCard label="Pending dues" value={`₹${metrics.pendingDues.toLocaleString("en-IN")}`} delta={`${orders.filter((order) => order.balance !== "Paid").length}`} hint="orders need attention" icon={Clock3} tone="coral" inverse />
      <MetricCard label="In process" value={`${metrics.inProcessCount} orders`} delta={`${metrics.readyCount} ready`} hint="for collection" icon={WashingMachine} tone="lavender" />
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.85fr)]">
      <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_7px_30px_rgba(17,17,17,.05)] sm:p-6">
        <div className="mb-6 flex items-start justify-between">
          <div><div className="mb-1 flex items-center gap-2"><p className="text-[13px] font-bold text-[#0F4C5C]">Revenue overview</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-[#0F4C5C]">This week</span></div><p className="text-[11px] text-slate-500">A calm view of your daily collections</p></div>
          <button onClick={() => toast.info("Date range picker is ready for custom reporting.")} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-[#0F4C5C]"><CalendarDays className="size-3.5" /> {new Date(Date.now() - 6 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}–{new Date().toLocaleDateString("en-US", { day: "numeric" })} <ChevronDown className="size-3" /></button>
        </div>
        <div className="relative h-[215px] w-full">
          <div className="absolute inset-0 flex flex-col justify-between pb-7 pt-2 text-[10px] text-slate-400"><span>₹{Math.ceil(chartMax / 1000)}k</span><span>₹{Math.ceil(chartMax * .75 / 1000)}k</span><span>₹{Math.ceil(chartMax * .5 / 1000)}k</span><span>₹{Math.ceil(chartMax * .25 / 1000)}k</span><span>₹0</span></div>
          <div className="absolute inset-x-0 bottom-7 top-2 ml-10 flex flex-col justify-between"><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /></div>
          <svg viewBox="0 0 700 180" className="absolute bottom-7 left-10 right-0 h-[178px] w-[calc(100%-40px)] overflow-visible" preserveAspectRatio="none"><polyline points={orders.map((order, index) => `${index * (700 / Math.max(1, orders.length - 1))},${160 - (money(order.amount) / Math.max(1, ...orders.map((entry) => money(entry.amount)))) * 135}`).join(" ")} fill="none" stroke="#0F4C5C" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>
          <div className="absolute bottom-0 left-10 right-0 flex justify-between text-[10px] font-medium text-slate-500"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        </div>
        <div className="mt-3 flex items-center gap-5 border-t border-slate-200 pt-4 text-[10px] text-[#0F4C5C]"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#0F4C5C]" /> Revenue</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-300" /> Last week</span><button onClick={() => onNavigate("Expenses")} className="ml-auto font-bold text-[#0F4C5C] hover:underline">View report <ChevronRight className="inline size-3" /></button></div>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-[#F8FAFC] p-5 shadow-[0_7px_30px_rgba(55,75,160,.05)] sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><p className="text-[13px] font-bold text-[#0F4C5C]">Today’s snapshot</p><p className="mt-1 text-[11px] text-slate-500">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p></div><div className="grid size-9 place-items-center rounded-xl bg-white text-[#0F4C5C] shadow-xs"><Sparkles className="size-[17px]" /></div></div>
        <div className="space-y-2.5"><SnapshotRow icon={PackageCheck} label="Orders received" value={`${metrics.ordersReceived}`} color="blue" /><SnapshotRow icon={Shirt} label="Items in process" value={`${metrics.itemsInProcess}`} color="purple" /><SnapshotRow icon={Tag} label="Ready for pickup" value={`${metrics.readyCount}`} color="orange" /><SnapshotRow icon={CreditCard} label="Payments collected" value={`₹${metrics.collectedToday.toLocaleString("en-IN")}`} color="green" /></div>
        <div className="mt-5 rounded-xl bg-white px-3.5 py-3 text-[10px] font-medium leading-4 text-[#0F4C5C] border border-slate-200/60"><span className="font-bold text-[#0F4C5C]">Nice work.</span> You’re up 8% in collections compared to last Tuesday.</div>
      </section>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
      <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_7px_30px_rgba(17,17,17,.05)] sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><p className="text-[13px] font-bold text-[#0F4C5C]">Recent orders</p><p className="mt-1 text-[11px] text-slate-500">The latest movement in your shop</p></div><button onClick={() => onNavigate("Orders")} className="text-[11px] font-bold text-[#0F4C5C] hover:underline">View all <ChevronRight className="inline size-3.5" /></button></div>
        <div className="hidden grid-cols-[1.3fr_1fr_.8fr_.8fr_auto] gap-4 border-b border-slate-200 px-2 pb-3 text-[9px] font-bold uppercase tracking-[.12em] text-slate-500 sm:grid"><span>Customer</span><span>Order</span><span>Amount</span><span>Status</span><span /></div>
        <div className="divide-y divide-slate-100">{uniqueOrders(orders).slice(0, 4).map((order) => <OrderRow key={order.id} order={order} />)}</div>
      </section>
      <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_7px_30px_rgba(17,17,17,.05)] sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-[13px] font-bold text-[#0F4C5C]">Process pulse</p><p className="mt-1 text-[11px] text-slate-500">Where orders are right now</p></div><button onClick={() => onNavigate("Active process")} className="grid size-8 place-items-center rounded-lg bg-slate-100 text-[#0F4C5C]"><MoreHorizontal className="size-4" /></button></div><div className="space-y-4"><ProcessBar label="1. Received" count={`${metrics.processCounts.Received}`} percent={metrics.inProcessCount ? metrics.processCounts.Received / metrics.inProcessCount * 100 : 0} color="#0F4C5C" /><ProcessBar label="2. Washing" count={`${metrics.processCounts.Processing}`} percent={metrics.inProcessCount ? metrics.processCounts.Processing / metrics.inProcessCount * 100 : 0} color="#2563EB" /><ProcessBar label="3. Ironing" count={`${metrics.processCounts.Ironing}`} percent={metrics.inProcessCount ? metrics.processCounts.Ironing / metrics.inProcessCount * 100 : 0} color="#9333EA" /><ProcessBar label="4. Ready" count={`${metrics.processCounts.Ready}`} percent={metrics.inProcessCount ? metrics.processCounts.Ready / metrics.inProcessCount * 100 : 0} color="#059669" /></div><div className="mt-6 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[10px] text-[#0F4C5C] border border-slate-200/80"><Clock3 className="size-3.5 text-[#0F4C5C]" /> Average turnaround <strong className="text-[#0F4C5C]">1.8 days</strong><ArrowDownRight className="ml-auto size-3.5 text-[#0F4C5C]" /></div></section>
    </div>
  </>;
}

function MetricCard({ label, value, delta, hint, icon: Icon, tone, inverse = false }: { label: string; value: string; delta: string; hint: string; icon: typeof IndianRupee; tone: "blue" | "mint" | "coral" | "lavender"; inverse?: boolean }) {
  const toneMap = { blue: "bg-teal-50 text-[#0F4C5C]", mint: "bg-emerald-50 text-emerald-700", coral: "bg-rose-50 text-rose-700", lavender: "bg-indigo-50 text-indigo-700" };
  return <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_7px_30px_rgba(17,17,17,.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(17,17,17,.08)]"><div className="mb-5 flex items-center justify-between"><span className="text-[11px] font-semibold text-[#0F4C5C]">{label}</span><span className={`grid size-9 place-items-center rounded-xl ${toneMap[tone]}`}><Icon className="size-[17px]" strokeWidth={1.9} /></span></div><p className="font-display text-[26px] font-semibold tracking-[-.04em] text-[#0F4C5C]">{value}</p><div className="mt-2 flex items-center gap-1.5 text-[10px]"><span className={`flex items-center gap-0.5 font-bold ${inverse ? "text-rose-600" : "text-emerald-600"}`}>{inverse ? <ArrowUpRight className="size-3" /> : <ArrowUpRight className="size-3" />}{delta}</span><span className="text-slate-500">{hint}</span></div></div>;
}

function SnapshotRow({ icon: Icon, label, value, color }: { icon: typeof PackageCheck; label: string; value: string; color: string }) {
  const colors: Record<string, string> = { blue: "bg-teal-100/80 text-[#0F4C5C]", purple: "bg-indigo-100/80 text-indigo-700", orange: "bg-amber-100/80 text-amber-700", green: "bg-emerald-100/80 text-emerald-700" };
  return <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 border border-slate-200/60 shadow-2xs"><span className={`grid size-8 place-items-center rounded-lg ${colors[color]}`}><Icon className="size-4" strokeWidth={1.9} /></span><span className="flex-1 text-[11px] font-semibold text-[#0F4C5C]">{label}</span><strong className="text-[12px] font-bold text-[#0F4C5C]">{value}</strong></div>;
}

function ProcessBar({ label, count, percent, color }: { label: string; count: string; percent: number; color: string }) { return <div><div className="mb-2 flex justify-between text-[11px]"><span className="font-semibold text-[#0F4C5C]">{label}</span><span className="font-bold text-[#0F4C5C]">{count} <span className="font-normal text-slate-500">orders</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} /></div></div>; }

const statusStyles: Record<string, string> = { Received: "bg-[#EAF2F8] text-[#3976A8]", Processing: "bg-[#FFF4D6] text-[#9A6A12]", Ironing: "bg-purple-100 text-purple-800", Ready: "bg-[#E8F3EC] text-[#4E8C6A]", Collected: "bg-slate-100 text-slate-600" };

function OrderRow({ order }: { order: Order }) {
  const [showDetails, setShowDetails] = useState(false);
  return <><button onClick={() => setShowDetails(true)} className="group grid w-full grid-cols-1 gap-2 px-2 py-3.5 text-left transition hover:bg-slate-50 sm:grid-cols-[1.3fr_1fr_.8fr_.8fr_auto] sm:items-center sm:gap-4"><div className="flex items-center gap-3"><span style={{ backgroundColor: `${order.accent}20`, color: order.accent }} className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold">{order.initials}</span><div><p className="text-[11px] font-bold text-[#0F4C5C]">{order.customer}</p><p className="text-[9px] text-slate-500">{order.phone}</p></div></div><div className="ml-11 -mt-1 text-[10px] text-slate-600 sm:ml-0 sm:mt-0"><span className="font-bold text-[#0F4C5C]">{order.id}</span><span className="hidden xl:inline"> · {order.items}</span></div><span className="ml-11 -mt-1 text-[11px] font-bold text-[#0F4C5C] sm:ml-0 sm:mt-0">{order.amount}<span className="ml-2 text-[9px] font-medium text-amber-600">{order.balance !== "Paid" ? order.balance : ""}</span></span><span className={`ml-11 -mt-1 w-fit rounded-full px-2 py-1 text-[9px] font-bold sm:ml-0 sm:mt-0 ${statusStyles[order.status] || "bg-slate-100 text-slate-700"}`}>{order.status}</span><ChevronRight className="absolute right-2 hidden size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0F4C5C] sm:relative sm:right-auto sm:block" /></button>{showDetails && <OrderDetailsModal order={order} onClose={() => setShowDetails(false)} />}</>;
}

function OrderDetailsModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const utils = trpc.useUtils();
  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: async (updatedOrder) => {
      utils.orders.list.setData(undefined, (current: any) => current?.map((existing: any) => existing.id === updatedOrder.id ? updatedOrder : existing));
      await utils.orders.list.invalidate();
      toast.success(`${order.id} moved to ${updatedOrder.status}`, { description: "The order status is saved to the database." });
      onClose();
    },
    onError: (error) => toast.error("Could not update order status", { description: error.message }),
  });
  const statuses: Order["status"][] = ["Received", "Processing", "Ironing", "Ready", "Collected"];
  const currentIndex = statuses.indexOf(order.status);
  const nextStatus = statuses[currentIndex + 1];
  return <OverlayModal title={`Order ${order.id}`} onClose={onClose}><div className="mb-5 flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-200/80 p-3"><span style={{ backgroundColor: `${order.accent}20`, color: order.accent }} className="grid size-11 place-items-center rounded-xl text-[12px] font-bold">{order.initials}</span><div><p className="text-[13px] font-bold text-[#0F4C5C]">{order.customer}</p><p className="mt-1 text-[10px] text-slate-500">{order.phone}</p></div><span className={`ml-auto rounded-full px-2.5 py-1 text-[9px] font-bold ${statusStyles[order.status] || "bg-slate-100 text-slate-700"}`}>{order.status}</span></div><div className="grid grid-cols-2 gap-3"><DetailCell label="Bill amount" value={order.amount} /><DetailCell label="Balance" value={order.balance} danger={order.balance !== "Paid"} /><DetailCell label="Pickup" value={order.due} /><DetailCell label="Payment" value={order.balance === "Paid" ? "Paid in full" : "Advance received"} /></div><div className="mt-5 rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[12px] font-bold text-[#0F4C5C]">Order status</p><span className="text-[10px] text-slate-500">Step {currentIndex + 1} of {statuses.length}</span></div><div className="grid grid-cols-5 gap-1.5">{statuses.map((status, index) => <div key={status} className="text-center"><div className={`mx-auto mb-1 grid size-7 place-items-center rounded-full text-[10px] font-bold ${index <= currentIndex ? "bg-[#0F4C5C] text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}</div><span className="text-[8px] font-semibold text-[#0F4C5C] block truncate">{status}</span></div>)}</div>{nextStatus ? <button disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate({ id: order.id, status: nextStatus })} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F4C5C] py-3 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{updateStatusMutation.isPending ? "Saving…" : `Mark as ${nextStatus}`} <ArrowUpRight className="size-4" /></button> : <p className="mt-4 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2.5 text-center text-[10px] font-semibold text-[#0F4C5C]">This order is complete and collected.</p>}</div><div className="mt-5 rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[12px] font-bold text-[#0F4C5C]">Items in this order</p><Shirt className="size-4 text-[#0F4C5C]" /></div><div className="flex flex-wrap gap-2">{order.items.split(" · ").slice(1).join(" · ").split(", ").map((item) => <span key={item} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-[#0F4C5C]">{item}</span>)}</div></div><button onClick={() => { downloadReceipt(order); toast.success(`${order.id} receipt downloaded`, { description: "Open the HTML receipt to print or save as PDF." }); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F4C5C] py-3 text-[12px] font-bold text-white">Download receipt <FileText className="size-4" /></button></OverlayModal>;
}

function downloadReceipt(order: Order) {
  downloadInvoiceHtml(order as any, "A4");
}

function DetailCell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-500">{label}</p><p className={`mt-1.5 text-[12px] font-bold ${danger ? "text-amber-600" : "text-[#0F4C5C]"}`}>{value}</p></div>; }

function NotificationPanel({ orders, notificationsEnabled, onMarkRead }: { orders: Order[]; notificationsEnabled: boolean; onMarkRead: () => void }) {
  const readyOrders = orders.filter((order) => order.status === "Ready");
  const dueOrders = orders.filter((order) => order.balance !== "Paid");
  return <div className="absolute right-0 sm:right-[54px] top-[52px] z-30 w-[300px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_rgba(17,17,17,.12)]"><div className="mb-3 flex items-center justify-between"><div><p className="text-[12px] font-bold text-[#0F4C5C]">Notifications</p><p className="mt-1 text-[10px] text-slate-500">Live from your current orders</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-[#0F4C5C]">{notificationsEnabled ? readyOrders.length + dueOrders.length : 0} new</span></div>{notificationsEnabled ? <div className="space-y-3 text-[11px] text-slate-700">{readyOrders.length ? <p><span className="font-semibold text-[#0F4C5C]">{readyOrders.length} order{readyOrders.length === 1 ? " is" : "s are"}</span> ready for pickup.</p> : null}{dueOrders.length ? <p><span className="font-semibold text-[#0F4C5C]">{dueOrders.length} customer{dueOrders.length === 1 ? " has" : "s have"}</span> an outstanding balance.</p> : null}<p className="text-slate-500">Workspace data is synced from the database.</p>{!readyOrders.length && !dueOrders.length && <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-slate-500">You are all caught up.</p>}</div> : <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-500">Customer notifications are disabled in Settings.</p>}<button onClick={onMarkRead} className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-[10px] font-bold text-[#0F4C5C] transition hover:bg-slate-50">Mark as read</button></div>;
}

function ProfileMenu({
  user,
  activeRole,
  canManageRoles,
  onSettings,
  onRoles,
  onLogout,
}: {
  user: { name?: string | null; email?: string | null; role?: string | null } | null;
  activeRole: string;
  canManageRoles: boolean;
  onSettings: () => void;
  onRoles: () => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <div className="absolute right-0 top-[52px] z-30 w-[270px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_rgba(17,17,17,.12)]">
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200/80 p-3">
        <div className="grid size-10 place-items-center rounded-xl bg-white text-[11px] font-bold text-[#0F4C5C] shadow-2xs border border-slate-200/60">
          {(user?.name ?? "Ashfaq").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-[#0F4C5C]">{user?.name ?? "Ashfaq"}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{user?.email ?? "asfaq94.md@gmail.com"}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#0F4C5C]/10 text-[#0F4C5C] text-[9px] font-bold uppercase">
            Role: {activeRole}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {canManageRoles && (
          <button
            onClick={onRoles}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold text-[#0F4C5C] transition hover:bg-slate-50"
          >
            <ShieldCheck className="size-4" /> Roles & access control
          </button>
        )}
        <button
          onClick={onSettings}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold text-[#0F4C5C] transition hover:bg-slate-50"
        >
          <Settings className="size-4" /> Account and shop settings
        </button>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
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

function SectionView({ section, onNewOrder, onNavigate }: { section: Section; onNewOrder: (cust?: any) => void; onNavigate: (section: Section) => void }) {
  return (
    <Suspense fallback={<ViewFallback />}>
      {section === "Active process" && <ActiveProcessView onNewOrder={onNewOrder} />}
      {section === "Orders" && <BillsView onNewOrder={onNewOrder} />}
      {section === "Products" && <ProductsView onNewOrder={onNewOrder} />}
      {section === "Customers" && <CustomersView onNewOrder={onNewOrder} />}
      {section === "Statements" && <StatementsView />}
      {section === "Roles" && <RolesAndAccessView />}
      {section === "Settings" && <SettingsViewComponent />}
      {section === "Expenses" && <ExpensesView />}
      {section === "Recycle Bin" && <RecycleBinView />}
      {section === "Overview" && <DashboardView onNavigate={onNavigate} onNewOrder={onNewOrder} />}
    </Suspense>
  );
}

function OverlayModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0F4C5C]/40 px-4 py-4 backdrop-blur-sm"><div className="max-h-[calc(100dvh-32px)] w-full max-w-[420px] overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(17,17,17,.12)] sm:p-7"><div className="mb-1 flex items-center justify-between"><h2 className="font-display text-[20px] font-semibold tracking-[-.03em] text-[#0F4C5C]">{title}</h2><button onClick={onClose} className="grid size-10 place-items-center rounded-lg bg-slate-100 text-[#0F4C5C] transition hover:bg-slate-200 hover:text-[#0F4C5C]" aria-label="Close"><X className="size-4" /></button></div>{children}</div></div>; }
