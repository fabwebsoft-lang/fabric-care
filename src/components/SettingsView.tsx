import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useAccessControl } from "@/contexts/AccessControlContext";
import RolesAndAccessView from "./RolesAndAccessView";
import { useInvoiceSettings, InvoiceSettings } from "@/lib/invoiceSettings";
import {
  Settings,
  Store,
  ShieldCheck,
  Smartphone,
  Cloud,
  LogOut,
  Save,
  CheckCircle2,
  FileText,
  QrCode,
  RotateCcw,
  Receipt,
  Percent,
  Download,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePWAInstall, IOSInstallGuideModal } from "./InstallModal";
import HelpCenterModal from "./HelpCenterModal";

export default function SettingsView({
  initialTab = "general",
}: {
  initialTab?: "general" | "invoice" | "roles" | "devices" | "account";
}) {
  const { user, logout } = useAuth();
  const { canManageSettings, canManageRoles, role } = useAccessControl();
  const utils = trpc.useUtils();
  const { installed, showIOSGuide, setShowIOSGuide, handleInstallClick } = usePWAInstall();
  const [showHelp, setShowHelp] = useState(false);

  const [activeTab, setActiveTab] = useState<"general" | "invoice" | "roles" | "devices" | "account">(initialTab);

  const { data: shops = [] } = trpc.shops.list.useQuery();
  const shop = shops[0];
  const { data: devices = [] } = trpc.devices.list.useQuery();

  const [shopName, setShopName] = useState(shop?.name || "Fabric Care");
  const [shopAddress, setShopAddress] = useState(shop?.address || "17/B3, 1st street, Pandian Nagar, Dindigul");

  // Invoice Settings Hook & Local Form State
  const [invoiceSettings, setInvoiceSettings] = useInvoiceSettings();
  const [invForm, setInvForm] = useState<InvoiceSettings>(invoiceSettings);

  useEffect(() => {
    setInvForm(invoiceSettings);
  }, [invoiceSettings]);

  useEffect(() => {
    if (shop) {
      setShopName(shop.name);
      setShopAddress(shop.address || "");
    }
  }, [shop]);

  const updateShopMutation = trpc.shops.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.shops.list.invalidate();
      toast.success("Shop settings updated");
    },
    onError: (err) => toast.error("Failed to update shop", { description: err.message }),
  });

  const registerDeviceMutation = trpc.devices.register.useMutation({
    onSuccess: async () => {
      await utils.devices.list.invalidate();
      toast.success("Device registered successfully");
    },
    onError: (err) => toast.error("Could not register device", { description: err.message }),
  });

  const handleRegisterCurrentDevice = () => {
    const userAgent = navigator.userAgent;
    let deviceLabel = "Web Browser Counter";
    if (userAgent.includes("Mobile")) deviceLabel = "Mobile Counter App";
    else if (userAgent.includes("Chrome")) deviceLabel = "Chrome Counter";

    registerDeviceMutation.mutate({
      deviceLabel,
      userAgent,
    });
  };

  const handleSaveInvoiceSettings = () => {
    setInvoiceSettings(invForm);
    // Also sync shop name/address with database if admin
    if (canManageSettings && (invForm.shopName !== shop?.name || invForm.address !== shop?.address)) {
      updateShopMutation.mutate({
        name: invForm.shopName || "Fabric Care",
        address: invForm.address || "",
        customerNotifications: true,
        pricingTier: "Normal + Premium",
      });
    }
    toast.success("Invoice settings saved", {
      description: "Updated invoice headers, terms, UPI details, and tax configuration.",
    });
  };

  const handleResetDefaultTerms = () => {
    setInvForm((prev) => ({
      ...prev,
      terms:
        "1. Please collect your clothes within 30 days of ready date.\n2. Please check your items and count at the time of pickup.\n3. Bring this bill or receipt SMS when collecting your clothes.",
    }));
    toast.info("Default terms restored in form");
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
              <Settings className="size-5 sm:size-6 text-[#0F4C5C]" />
              Shop Settings & Operations
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Manage business profile, professional invoice design, team roles, devices, and cloud sync
            </p>
          </div>

          {/* Tab buttons */}
          <div className="w-full lg:w-auto overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold w-max">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`shrink-0 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === "general"
                    ? "bg-white text-[#0F4C5C] shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Store className="size-3.5 shrink-0" /> Shop Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("invoice")}
                className={`shrink-0 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === "invoice"
                    ? "bg-white text-[#0F4C5C] shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="size-3.5 shrink-0" /> Invoice & Print
              </button>
              {canManageRoles && (
                <button
                  type="button"
                  onClick={() => setActiveTab("roles")}
                  className={`shrink-0 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === "roles"
                      ? "bg-white text-[#0F4C5C] shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ShieldCheck className="size-3.5 shrink-0" /> Roles & Access
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("devices")}
                className={`shrink-0 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === "devices"
                    ? "bg-white text-[#0F4C5C] shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Smartphone className="size-3.5 shrink-0" /> Devices
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("account")}
                className={`shrink-0 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === "account"
                    ? "bg-white text-[#0F4C5C] shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Cloud className="size-3.5 shrink-0" /> Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Render selected tab content */}
      {activeTab === "roles" && canManageRoles && <RolesAndAccessView />}

      {/* Invoice Settings Tab */}
      {activeTab === "invoice" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
            {/* Header & Contact Information */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                <Store className="size-4 text-[#0F4C5C]" /> Header & Shop Details
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Shop Name (on Bill / Invoice)</label>
                  <input
                    type="text"
                    value={invForm.shopName}
                    onChange={(e) => setInvForm({ ...invForm, shopName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs font-semibold text-slate-800"
                    placeholder="Fabric Care"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tagline</label>
                  <input
                    type="text"
                    value={invForm.tagline}
                    onChange={(e) => setInvForm({ ...invForm, tagline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs"
                    placeholder="Associated with Dindigul Express - dindigulexpress.in"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Primary Shop Address</label>
                  <input
                    type="text"
                    value={invForm.address}
                    onChange={(e) => setInvForm({ ...invForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs"
                    placeholder="17/B3, 1st street, Pandian Nagar, Dindigul"
                  />
                </div>

                {/* Branch Network Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <span className="text-[11px] font-bold text-[#0F4C5C] uppercase tracking-wider block">
                    Active Shop Branches (Auto-selectable on billing)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                      <p className="font-bold text-slate-800">Branch 1: Pandian Nagar</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">17/B3, 1st street, Pandian Nagar, Dindigul</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                      <p className="font-bold text-slate-800">Branch 2: SKT Dindigul</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">SKT Dindigul</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={invForm.phone}
                      onChange={(e) => setInvForm({ ...invForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={invForm.email}
                      onChange={(e) => setInvForm({ ...invForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs"
                      placeholder="care@dindigulexpress.in"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    GSTIN / Tax ID <span className="text-slate-400 font-normal">(Optional — shown on bill if filled)</span>
                  </label>
                  <input
                    type="text"
                    value={invForm.gstin}
                    onChange={(e) => setInvForm({ ...invForm, gstin: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs font-mono"
                    placeholder="29ABCDE1234F1Z5"
                  />
                </div>
              </div>
            </div>

            {/* Payment QR, Tax & Print Options */}
            <div className="space-y-4">
              {/* UPI & Tax Settings */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <QrCode className="size-4 text-[#0F4C5C]" /> UPI QR Code & Tax Calculation
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      UPI ID for "Scan to Pay" QR code <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={invForm.upiId}
                      onChange={(e) => setInvForm({ ...invForm, upiId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs font-mono"
                      placeholder="fabriccare@okaxis"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      When filled, a dynamic UPI QR code with the balance amount is generated on the A4 invoice.
                    </p>
                  </div>

                  {/* Tax / GST Toggle */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">Enable Tax / GST on Invoices</span>
                        <span className="text-[10px] text-slate-500">Adds GST calculation row in the totals box</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={invForm.enableTax}
                          onChange={(e) => setInvForm({ ...invForm, enableTax: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F4C5C]"></div>
                      </label>
                    </div>

                    {invForm.enableTax && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-slate-600 font-semibold">GST Rate (%):</span>
                        <div className="flex items-center gap-1.5 w-24">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={invForm.taxRate}
                            onChange={(e) => setInvForm({ ...invForm, taxRate: Number(e.target.value) || 0 })}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold"
                          />
                          <span className="text-slate-500 font-bold">%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Default Format */}
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Default Print / View Format</label>
                    <select
                      value={invForm.defaultPaperSize}
                      onChange={(e) => setInvForm({ ...invForm, defaultPaperSize: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs font-semibold"
                    >
                      <option value="A4">A4 Full Page Invoice</option>
                      <option value="Thermal80">80mm Thermal Receipt</option>
                      <option value="Thermal58">58mm Thermal Receipt</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions Section */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Receipt className="size-4 text-[#0F4C5C]" /> Terms & Conditions / Pickup Notes
              </h3>
              <button
                type="button"
                onClick={handleResetDefaultTerms}
                className="text-[11px] font-semibold text-[#0F4C5C] hover:underline flex items-center gap-1"
              >
                <RotateCcw className="size-3" /> Reset Defaults
              </button>
            </div>

            <div>
              <textarea
                rows={3}
                value={invForm.terms}
                onChange={(e) => setInvForm({ ...invForm, terms: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] text-xs text-slate-700 leading-relaxed font-sans"
                placeholder="Enter shop terms (one per line)..."
              />
              <p className="text-[10px] text-slate-400 mt-1">
                These terms will be displayed cleanly at the bottom of printed invoices and receipts.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveInvoiceSettings}
                className="px-5 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center gap-2 active:scale-95"
              >
                <Save className="size-3.5" /> Save All Invoice Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          {/* Business Profile */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="size-4 text-[#0F4C5C]" /> Shop Profile & Details
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Shop Name</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] disabled:opacity-60 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Address / Location</label>
                <input
                  type="text"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] disabled:opacity-60 text-xs"
                />
              </div>

              <button
                onClick={() =>
                  updateShopMutation.mutate({
                    name: shopName,
                    address: shopAddress,
                    customerNotifications: true,
                    pricingTier: "Normal + Premium",
                  })
                }
                disabled={updateShopMutation.isPending || !canManageSettings}
                className="w-full py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="size-3.5" /> Save Shop Profile
              </button>
              {!canManageSettings && (
                <p className="text-[10px] text-amber-600 font-medium text-center">
                  Editing shop profile requires Admin privileges.
                </p>
              )}
            </div>
          </div>

          {/* Invoice Settings Quick Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="size-4 text-[#0F4C5C]" /> Professional Invoice & Thermal Receipt
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Configure your A4 invoice layout, 80mm/58mm thermal receipts, GSTIN, UPI payment QR code, and shop terms.
            </p>

            <button
              onClick={() => setActiveTab("invoice")}
              className="w-full py-2.5 bg-slate-50 border border-slate-200 text-[#0F4C5C] text-xs font-bold rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <FileText className="size-4" /> Open Invoice Settings
            </button>
          </div>
        </div>
      )}

      {activeTab === "devices" && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Smartphone className="size-4 text-[#0F4C5C]" /> Connected Counter Devices ({devices.length} / 5)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Authorize up to 5 shop phones/tablets for synchronized billing
              </p>
            </div>
            <button
              onClick={handleRegisterCurrentDevice}
              disabled={registerDeviceMutation.isPending || devices.length >= 5}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 text-[#0F4C5C] text-xs font-semibold rounded-xl hover:bg-slate-200 transition disabled:opacity-50 active:scale-95 text-center"
            >
              Register This Device
            </button>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {devices.map((d: any) => (
              <div key={d.id} className="border border-slate-200 p-3.5 rounded-xl text-xs space-y-1 bg-slate-50/50">
                <p className="font-bold text-slate-800">{d.deviceLabel}</p>
                <p className="text-slate-400 font-mono text-[10px] truncate">{d.deviceCode || "Active"}</p>
                <span className="text-emerald-600 font-bold text-[10px] inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Connected
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "account" && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Cloud className="size-4 text-[#0F4C5C]" /> Account & Cloud Sync
            </h3>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="size-11 bg-[#0F4C5C] text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {user?.name?.slice(0, 2).toUpperCase() || "FC"}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{user?.name || "Shop Owner"}</p>
                  <p className="text-[#0F4C5C] font-mono text-[11px] truncate">
                    {user?.email || "Google Account Connected"}
                  </p>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Active Role: {role}</span>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full mt-2 py-2 border border-slate-200 text-rose-600 text-xs font-semibold rounded-lg hover:bg-rose-50 transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <LogOut className="size-3.5" /> Sign Out
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cloud className="size-5 text-emerald-600" />
                <div>
                  <p className="font-bold text-emerald-900">Cloud Sync Active</p>
                  <p className="text-[11px] text-emerald-700">Database connected & synced</p>
                </div>
              </div>
              <span className="size-2.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Install PWA section if not already installed */}
          {!installed && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                <Download className="size-4 text-[#0F4C5C]" /> Install Fabric Care App
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Install Fabric Care as a standalone web app on your phone, tablet, or desktop for instant launching and offline resilience.
              </p>
              <button
                onClick={handleInstallClick}
                className="px-4 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center gap-2 active:scale-95"
              >
                <Download className="size-3.5" /> Install App to Home Screen
              </button>
            </div>
          )}

          {/* Help & Support Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <HelpCircle className="size-4 text-[#0F4C5C]" /> Help Center & Support
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Need help with the app or custom business features? Contact our team.
                </p>
              </div>
              <button
                onClick={() => setShowHelp(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-[#0F4C5C] text-xs font-bold rounded-xl transition active:scale-95"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && <HelpCenterModal onClose={() => setShowHelp(false)} />}
      {showIOSGuide && <IOSInstallGuideModal onClose={() => setShowIOSGuide(false)} />}
    </div>
  );
}
