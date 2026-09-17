import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, Trash2, Check, ChevronDown, ChevronUp, User, Tag, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

type OrderItemInput = {
  name: string;
  quantity: number;
  price: number;
};

const catalogTiers: Record<string, { label: string; normalPrice: number; premiumPrice: number }[]> = {
  default: [
    { label: "Shirt", normalPrice: 50, premiumPrice: 80 },
    { label: "Pant", normalPrice: 60, premiumPrice: 90 },
    { label: "Vasti / Dhoti", normalPrice: 50, premiumPrice: 75 },
    { label: "Suit (2-pc)", normalPrice: 180, premiumPrice: 250 },
    { label: "Saree", normalPrice: 120, premiumPrice: 180 },
    { label: "Blanket", normalPrice: 200, premiumPrice: 280 },
    { label: "Curtain", normalPrice: 150, premiumPrice: 220 },
  ],
};

export default function NewBillModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const utils = trpc.useUtils();
  const { data: customersData } = trpc.customers.list.useQuery();

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"Normal" | "Premium">("Normal");
  const [clothesCode, setClothesCode] = useState("");
  const [address, setAddress] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [notes, setNotes] = useState("");
  const [showExtraDetails, setShowExtraDetails] = useState(false);

  const [items, setItems] = useState<OrderItemInput[]>([
    { name: "Shirt", quantity: 2, price: 50 },
  ]);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [discount, setDiscount] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [advanceOption, setAdvanceOption] = useState<"full" | "half" | "none" | "custom">("none");

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: async (data) => {
      await utils.orders.list.invalidate();
      await utils.customers.list.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(`Bill ${data.id} created successfully!`, {
        description: `Customer: ${data.customer} · Clothes Tags generated`,
      });
      onSuccess();
    },
    onError: (err) => {
      toast.error("Could not create laundry bill", { description: err.message });
    },
  });

  const filteredCustomers = (customersData || []).filter((c) =>
    `${c.name} ${c.phone} ${c.storedClothesCode}`.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const handleSelectExistingCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setPhone(c.phone);
    setCustomerType(c.customerType || "Normal");
    setClothesCode(c.storedClothesCode);
    setAddress(c.address || "");
    setAlternatePhone(c.alternatePhone || "");
    setNotes(c.notes || "");
    setCustomerSearch(`${c.name} (${c.phone})`);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (!clothesCode || clothesCode.startsWith("C-")) {
      const cleanDigits = val.replace(/\D/g, "");
      setClothesCode(`C-${cleanDigits.slice(-4) || "0000"}`);
    }
  };

  const activeCatalog = catalogTiers.default.map((c) => ({
    label: c.label,
    price: customerType === "Premium" ? c.premiumPrice : c.normalPrice,
  }));

  const addItemToBill = (label: string, price: number) => {
    setItems((current) => {
      const existingIdx = current.findIndex((i) => i.name === label);
      if (existingIdx >= 0) {
        const copy = [...current];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [...current, { name: label, quantity: 1, price }];
    });
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;
    const priceNum = Number(customItemPrice) || 50;
    addItemToBill(customItemName.trim(), priceNum);
    setCustomItemName("");
    setCustomItemPrice("");
    setShowCustomInput(false);
  };

  const updateItemQty = (index: number, delta: number) => {
    setItems((current) => {
      const copy = [...current];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    setItems((current) => {
      const copy = [...current];
      copy[index].price = Math.max(0, newPrice);
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const totalGarments = items.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const applyAdvanceQuick = (opt: "full" | "half" | "none") => {
    setAdvanceOption(opt);
    if (opt === "full") setAdvancePaid(grandTotal);
    else if (opt === "half") setAdvancePaid(Math.round(grandTotal / 2));
    else setAdvancePaid(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("Customer Name is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least 1 cloth item to the bill");
      return;
    }

    createOrderMutation.mutate({
      customerName: customerName.trim(),
      phone: phone.trim() || "0000000000",
      customerType,
      address: address.trim() || undefined,
      alternatePhone: alternatePhone.trim() || undefined,
      notes: notes.trim() || undefined,
      storedClothesCode: clothesCode.trim() || `C-${phone.slice(-4) || "0000"}`,
      items,
      serviceType: customerType === "Premium" ? "Premium Dry Clean" : "Standard Laundry",
      totalAmount: grandTotal,
      discount,
      amountPaid: Math.min(grandTotal, advancePaid),
      advanceOption,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F4C5C]/50 backdrop-blur-sm p-2 sm:p-4 md:p-6 flex justify-center items-center min-h-screen">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#0F4C5C]/20 bg-[#0F4C5C] px-4 py-3.5 sm:px-5 sm:py-4 text-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 sm:size-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20 transition text-white"
              aria-label="Back"
            >
              <ArrowLeft className="size-4 sm:size-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold">New Laundry Bill</h2>
                <span className="rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-[#9A6A12]">
                  PENDING
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-white/80">Auto Bill #: WP-NEXT-FC01</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="size-4 sm:size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Customer Information */}
          <div className="rounded-xl border border-slate-200 bg-[#F7F3EE]/40 p-3.5 sm:p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#0F4C5C] flex items-center gap-1.5">
                <User className="size-3.5 sm:size-4" /> Customer Information
              </span>
              <div className="flex rounded-lg bg-[#F7F3EE] p-0.5 text-[10px] sm:text-[11px] font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCustomerMode("new")}
                  className={`rounded-md px-2.5 py-1 transition ${
                    customerMode === "new" ? "bg-[#0F4C5C] text-white shadow-xs" : "text-[#0F4C5C]"
                  }`}
                >
                  New Customer
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("existing")}
                  className={`rounded-md px-2.5 py-1 transition ${
                    customerMode === "existing" ? "bg-[#0F4C5C] text-white shadow-xs" : "text-[#0F4C5C]"
                  }`}
                >
                  Existing Search
                </button>
              </div>
            </div>

            {customerMode === "existing" ? (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customer by name, phone or code…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                />
                {customerSearch && filteredCustomers.length > 0 && !selectedCustomerId && (
                  <div className="absolute left-0 right-0 top-11 z-20 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {filteredCustomers.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleSelectExistingCustomer(c)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[#F7F3EE]"
                      >
                        <div>
                          <p className="font-bold text-[#0F4C5C]">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.phone} · Code: {c.storedClothesCode}</p>
                        </div>
                        <span className="rounded-md bg-[#F7F3EE] px-2 py-0.5 text-[10px] font-semibold text-[#0F4C5C]">
                          {c.customerType}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anish Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Phone Number</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Pricing Tier</label>
                <div className="flex rounded-xl border border-slate-300 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setCustomerType("Normal")}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                      customerType === "Normal" ? "bg-[#0F4C5C] text-white" : "text-[#0F4C5C]"
                    }`}
                  >
                    Normal Tier
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerType("Premium")}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                      customerType === "Premium" ? "bg-[#0F4C5C] text-white" : "text-[#0F4C5C]"
                    }`}
                  >
                    Premium Tier
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Clothes Tag Code</label>
                <input
                  type="text"
                  value={clothesCode}
                  onChange={(e) => setClothesCode(e.target.value)}
                  placeholder="e.g. C-4891"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono font-bold text-[#0F4C5C] focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                />
              </div>
            </div>

            {/* Collapsible Details */}
            <div>
              <button
                type="button"
                onClick={() => setShowExtraDetails(!showExtraDetails)}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0F4C5C] hover:underline"
              >
                {showExtraDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {showExtraDetails ? "Hide Address & Notes" : "+ Add Address, Alternate Phone & Notes"}
              </button>

              {showExtraDetails && (
                <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2 pt-2 border-t border-slate-200">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Address</label>
                    <input
                      type="text"
                      placeholder="Flat, building, area"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Alternate Phone</label>
                    <input
                      type="tel"
                      placeholder="Secondary contact"
                      value={alternatePhone}
                      onChange={(e) => setAlternatePhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Special Notes / Instructions</label>
                    <input
                      type="text"
                      placeholder="e.g. Heavy stain treatment on cuff, starch saree"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Add Catalog Chips - Wrapped & Touch Friendly */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#0F4C5C]">
                Select Clothes ({customerType} Rate)
              </span>
              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="text-[11px] font-bold text-[#0F4C5C] hover:underline"
              >
                + Custom Item
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 pb-1">
              {activeCatalog.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => addItemToBill(cat.label, cat.price)}
                  className="flex items-center gap-1.5 rounded-xl border border-[#0F4C5C]/15 bg-[#F7F3EE] px-3 py-2 text-[11px] sm:text-xs font-bold text-[#0F4C5C] transition hover:bg-[#0F4C5C] hover:text-white active:scale-95 shadow-2xs"
                >
                  <Plus className="size-3.5" /> + {cat.label} ₹{cat.price}
                </button>
              ))}
            </div>

            {showCustomInput && (
              <div className="mt-2 flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-slate-300 bg-[#F7F3EE]/40 p-2">
                <input
                  type="text"
                  placeholder="Item Name (e.g. Jacket)"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="flex-1 min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Rate ₹"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="rounded-lg bg-[#0F4C5C] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0F4C5C]/90"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Bill Items Line Table - Mobile Responsive Cards / Table */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F4C5C]">
                Bill Items ({totalGarments} pcs)
              </span>
              <span className="text-xs font-bold text-[#0F4C5C]">
                Subtotal: ₹{subtotal}
              </span>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No clothes added yet. Tap quick chips above to add items.
                </div>
              ) : (
                items.map((item, idx) => {
                  const lineTotal = item.quantity * item.price;
                  return (
                    <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 p-3 hover:bg-slate-50/60 transition">
                      <div className="min-w-[120px] flex-1">
                        <p className="text-xs font-bold text-[#0F4C5C]">{item.name}</p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Tag className="size-3 text-[#0F4C5C]" />
                          Cloth Tag: Auto-assigned on save
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-4 w-full sm:w-auto">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItemPrice(idx, Number(e.target.value))}
                            className="w-14 rounded-md border border-slate-300 px-1.5 py-1 text-center font-bold text-[#0F4C5C] focus:outline-none text-xs"
                          />
                        </div>

                        <div className="flex items-center rounded-lg border border-slate-300 bg-[#F7F3EE] p-0.5">
                          <button
                            type="button"
                            onClick={() => updateItemQty(idx, -1)}
                            className="grid size-6 sm:size-7 place-items-center rounded-md bg-white font-bold text-[#0F4C5C] hover:bg-slate-100 active:scale-95 shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-[#0F4C5C]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItemQty(idx, 1)}
                            className="grid size-6 sm:size-7 place-items-center rounded-md bg-white font-bold text-[#0F4C5C] hover:bg-slate-100 active:scale-95 shadow-2xs"
                          >
                            +
                          </button>
                        </div>

                        <span className="w-14 text-right text-xs font-bold text-[#0F4C5C]">
                          ₹{lineTotal}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Payment & Settlement - Responsive Grid */}
          <div className="rounded-xl border border-slate-200 bg-[#F7F3EE]/40 p-3.5 sm:p-4 space-y-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0F4C5C]">
              Payment & Settlement
            </span>

            <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3 text-xs">
              <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-semibold text-slate-500">Subtotal</p>
                <p className="font-display text-base font-bold text-[#0F4C5C]">₹{subtotal}</p>
              </div>

              <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-semibold text-slate-500">Discount (₹)</p>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-base font-bold text-[#0F4C5C] focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-[#0F4C5C]/10 p-3 border border-[#0F4C5C]/20 shadow-2xs">
                <p className="text-[10px] font-semibold text-[#0F4C5C]">Grand Total</p>
                <p className="font-display text-base font-bold text-[#0F4C5C]">₹{grandTotal}</p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between text-[11px] gap-1">
                <label className="font-bold text-[#0F4C5C]">Advance Paid (₹)</label>
                <span className="text-slate-500">
                  Balance due: <strong className="text-rose-600">₹{Math.max(0, grandTotal - advancePaid)}</strong>
                </span>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="number"
                  min="0"
                  max={grandTotal}
                  value={advancePaid}
                  onChange={(e) => {
                    setAdvancePaid(Number(e.target.value));
                    setAdvanceOption("custom");
                  }}
                  className="w-full sm:w-auto flex-1 min-w-[110px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#0F4C5C] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => applyAdvanceQuick("full")}
                  className={`flex-1 sm:flex-none rounded-xl px-3 py-2 text-[11px] font-bold transition border ${
                    advanceOption === "full"
                      ? "bg-[#0F4C5C] text-white border-[#0F4C5C]"
                      : "bg-white text-[#0F4C5C] border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Full Advance
                </button>
                <button
                  type="button"
                  onClick={() => applyAdvanceQuick("half")}
                  className={`flex-1 sm:flex-none rounded-xl px-3 py-2 text-[11px] font-bold transition border ${
                    advanceOption === "half"
                      ? "bg-[#0F4C5C] text-white border-[#0F4C5C]"
                      : "bg-white text-[#0F4C5C] border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  50% Advance
                </button>
                <button
                  type="button"
                  onClick={() => applyAdvanceQuick("none")}
                  className={`flex-1 sm:flex-none rounded-xl px-3 py-2 text-[11px] font-bold transition border ${
                    advanceOption === "none"
                      ? "bg-[#0F4C5C] text-white border-[#0F4C5C]"
                      : "bg-white text-[#0F4C5C] border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  ₹0 (At Pickup)
                </button>
              </div>
            </div>
          </div>

          {/* Action Footer - Responsive Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-[#0F4C5C] hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#0F4C5C] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-[#0F4C5C]/90 active:scale-95 disabled:opacity-50"
            >
              {createOrderMutation.isPending ? (
                "Generating Bill…"
              ) : (
                <>
                  <Check className="size-4" strokeWidth={2.5} /> Save & Generate Bill
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
