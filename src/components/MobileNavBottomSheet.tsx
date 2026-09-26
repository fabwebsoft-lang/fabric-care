import { useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  WashingMachine,
  UsersRound,
  Shirt,
  UserCheck,
  WalletCards,
  BarChart3,
  Trash2,
  ShieldCheck,
  Settings,
  HelpCircle,
  Download,
  X,
  type LucideIcon,
} from "lucide-react";
import type { NavSection } from "./BottomNav";

export type SheetSection = NavSection;

interface MobileNavBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string;
  onNavigate: (section: SheetSection) => void;
  inProcessCount?: number;
  recycleCount?: number;
  canViewReports?: boolean;
  canManageRoles?: boolean;
  onOpenHelp: () => void;
  onInstallApp?: () => void;
  isInstalled?: boolean;
}

interface TileItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  badge?: number;
  badgeVariant?: "amber" | "rose";
  onClick: () => void;
}

export default function MobileNavBottomSheet({
  isOpen,
  onClose,
  activeSection,
  onNavigate,
  inProcessCount = 0,
  recycleCount = 0,
  canViewReports = true,
  canManageRoles = false,
  onOpenHelp,
  onInstallApp,
  isInstalled = false,
}: MobileNavBottomSheetProps) {
  // Lock background scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 1. Workspace items (Overview, Orders, Active process, Staff Management, Products, Customers, Expenses, Statements, Recycle Bin)
  const workspaceItems: TileItem[] = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      isActive: activeSection === "Overview",
      onClick: () => onNavigate("Overview"),
    },
    {
      id: "orders",
      label: "Orders",
      icon: ClipboardList,
      isActive: activeSection === "Orders",
      onClick: () => onNavigate("Orders"),
    },
    {
      id: "active-process",
      label: "Active process",
      icon: WashingMachine,
      isActive: activeSection === "Active process",
      badge: inProcessCount,
      badgeVariant: "amber",
      onClick: () => onNavigate("Active process"),
    },
    {
      id: "staff-management",
      label: "Staff",
      icon: UsersRound,
      isActive: activeSection === "Staff Management",
      onClick: () => onNavigate("Staff Management"),
    },
    {
      id: "products",
      label: "Products",
      icon: Shirt,
      isActive: activeSection === "Products",
      onClick: () => onNavigate("Products"),
    },
    {
      id: "customers",
      label: "Customers",
      icon: UserCheck,
      isActive: activeSection === "Customers",
      onClick: () => onNavigate("Customers"),
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: WalletCards,
      isActive: activeSection === "Expenses",
      onClick: () => onNavigate("Expenses"),
    },
    ...(canViewReports
      ? [
          {
            id: "statements",
            label: "Statements",
            icon: BarChart3,
            isActive: activeSection === "Statements",
            onClick: () => onNavigate("Statements"),
          },
        ]
      : []),
    {
      id: "recycle-bin",
      label: "Recycle Bin",
      icon: Trash2,
      isActive: activeSection === "Recycle Bin",
      badge: recycleCount,
      badgeVariant: "rose" as const,
      onClick: () => onNavigate("Recycle Bin"),
    },
  ];

  // 2. Manage items (Roles & Access, Settings, Help center, Install App)
  const manageItems: TileItem[] = [
    ...(canManageRoles
      ? [
          {
            id: "roles",
            label: "Roles & Access",
            icon: ShieldCheck,
            isActive: activeSection === "Roles",
            onClick: () => onNavigate("Roles"),
          },
        ]
      : []),
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      isActive: activeSection === "Settings",
      onClick: () => onNavigate("Settings"),
    },
    {
      id: "help",
      label: "Help Center",
      icon: HelpCircle,
      isActive: false,
      onClick: () => onOpenHelp(),
    },
    ...(!isInstalled && onInstallApp
      ? [
          {
            id: "install-app",
            label: "Install App",
            icon: Download,
            isActive: false,
            onClick: () => onInstallApp(),
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-40 lg:hidden flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Dimmed backdrop - NO blur filter so content behind & bottom nav is not blurred */}
      <div
        className="fixed inset-0 bg-slate-900/60 transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Sheet Panel */}
      <div
        className="relative z-10 w-full max-h-[85vh] bg-white rounded-t-[28px] shadow-[0_-12px_45px_rgba(0,0,0,0.22)] flex flex-col border-t border-slate-200/90 animate-in slide-in-from-bottom duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Top Header with title and Close (X) button */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#0F4C5C]/10 text-[#0F4C5C]">
              <img
                src="/fabric-care-logo.png"
                alt="Fabric Care logo"
                className="size-5 object-contain"
              />
            </div>
            <div>
              <h2 className="font-display text-[16px] font-bold tracking-tight text-[#0F4C5C]">
                Navigation Menu
              </h2>
              <p className="text-[10px] text-slate-500 font-medium">
                Tap any tile to navigate
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-10 min-h-[44px] min-w-[44px] place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors active:scale-90 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable grid sections */}
        <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] space-y-5">
          {/* Workspace Section */}
          <section aria-labelledby="workspace-section-title">
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <span
                id="workspace-section-title"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"
              >
                Workspace
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {workspaceItems.map((item) => (
                <TileButton key={item.id} item={item} onClose={onClose} />
              ))}
            </div>
          </section>

          {/* Manage Section */}
          <section aria-labelledby="manage-section-title">
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <span
                id="manage-section-title"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"
              >
                Manage
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {manageItems.map((item) => (
                <TileButton key={item.id} item={item} onClose={onClose} />
              ))}
            </div>
          </section>

          {/* Footer info: Sync & attribution */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-1.5 font-medium text-emerald-600">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud sync active</span>
            </div>
            <a
              href="https://mallist.online"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-400 hover:text-slate-600 font-medium transition-colors"
            >
              Powered by Mallist
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function TileButton({
  item,
  onClose,
}: {
  item: TileItem;
  onClose: () => void;
}) {
  const Icon = item.icon;
  const isActive = Boolean(item.isActive);

  return (
    <button
      type="button"
      onClick={() => {
        item.onClick();
        onClose();
      }}
      className={`group relative flex flex-col items-center justify-center p-3 sm:py-3.5 rounded-2xl border text-center transition-all duration-150 active:scale-95 cursor-pointer select-none min-h-[86px] ${
        isActive
          ? "bg-[#0F4C5C]/10 border-[#0F4C5C]/35 text-[#0F4C5C] shadow-xs ring-1 ring-[#0F4C5C]/20"
          : "bg-slate-50/90 hover:bg-slate-100 border-slate-200/80 text-slate-700 hover:text-slate-900"
      }`}
      aria-label={item.label}
    >
      <div
        className={`relative grid size-10 place-items-center rounded-xl transition-all duration-150 ${
          isActive
            ? "bg-[#0F4C5C] text-white shadow-xs"
            : "bg-white text-[#0F4C5C] border border-slate-200/70 shadow-2xs group-hover:scale-105"
        }`}
      >
        <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.9} aria-hidden="true" />
        {item.badge !== undefined && item.badge > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs ring-2 ring-white animate-in zoom-in-50 ${
              item.badgeVariant === "rose"
                ? "bg-rose-500 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </div>
      <span
        className={`text-[11.5px] tracking-tight leading-tight mt-1.5 max-w-full truncate px-0.5 ${
          isActive ? "font-bold text-[#0F4C5C]" : "font-medium text-slate-700"
        }`}
      >
        {item.label}
      </span>
    </button>
  );
}
