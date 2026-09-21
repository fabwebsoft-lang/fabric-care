import { useState, useMemo, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import { trpc, type Customer } from "@/lib/trpc";
import { normalizePhone, formatPhoneDisplay } from "@/lib/phone";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  Tag,
  Sparkles,
  X,
  Search,
  AlertTriangle,
  Phone,
  MapPin,
  FileText,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type OrderItemInput = {
  name: string;
  quantity: number;
  price: number;
};

const defaultCatalog = [
  { label: "Shirt", price: 50 },
  { label: "Pant", price: 60 },
  { label: "Vasti / Dhoti", price: 50 },
  { label: "Suit (2-pc)", price: 180 },
  { label: "Saree", price: 120 },
  { label: "Blanket", price: 200 },
  { label: "Curtain", price: 150 },
];

export default function NewBillModal({
  onClose,
  onSuccess,
  initialCustomer = null,
}: {
  onClose: () => void;
  onSuccess: () => void;
  initialCustomer?: Customer | null;
}) {
  const utils = trpc.useUtils();
  const { data: customersData = [] } = trpc.customers.list.useQuery();
  const { data: dbProducts = [] } = trpc.products.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery();

  const nextBillNumber = useMemo(() => {
    let maxNum = 0;
    for (const o of orders) {
      const match = (o.id || "").match(/^FC-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `FC-${nextNum < 10000 ? String(nextNum).padStart(4, "0") : nextNum}`;
  }, [orders]);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">(initialCustomer ? "existing" : "new");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomer?.id || null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer || null);
  const [customerSearch, setCustomerSearch] = useState(initialCustomer ? `${initialCustomer.name} (${initialCustomer.phone})` : "");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [customerName, setCustomerName] = useState(initialCustomer?.name || "");
  const [phone, setPhone] = useState(initialCustomer?.phone || "");
  const [customerId, setCustomerId] = useState(initialCustomer?.customerId || "");
  const [address, setAddress] = useState(initialCustomer?.address || "");
  const [alternatePhone, setAlternatePhone] = useState(initialCustomer?.alternatePhone || "");
  const [notes, setNotes] = useState(initialCustomer?.notes || "");
  const [showExtraDetails, setShowExtraDetails] = useState(Boolean(initialCustomer?.address || initialCustomer?.alternatePhone || initialCustomer?.notes));
  const [updateCustomerProfile, setUpdateCustomerProfile] = useState(false);

  // Duplicate Warning Modal State
  const [duplicateCustomer, setDuplicateCustomer] = useState<Customer | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Items State
  const [items, setItems] = useState<OrderItemInput[]>([
    { name: "Shirt", quantity: 2, price: 50 },
  ]);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Bill Date State
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Payment State
  const [discount, setDiscount] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [advanceOption, setAdvanceOption] = useState<"full" | "half" | "none" | "custom">("none");

  // Dynamic server-side search query with debounce
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(customerSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const { data: searchResults = [], isFetching: isSearching } = trpc.customers.search.useQuery(
    { query: debouncedSearch, limit: 15 },
    { enabled: isDropdownOpen || customerMode === "existing" }
  );

  // Combine search results with local cache for instant filtering
  const matchingCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const qDigits = normalizePhone(q);

    if (!q) {
      // Show first 10 customers from list if no search term
      return (searchResults.length > 0 ? searchResults : customersData).slice(0, 10);
    }

    // Filter server results or local fallback
    const source = searchResults.length > 0 ? searchResults : customersData;
    const seenIds = new Set<string>();
    const filtered: Customer[] = [];

    for (const c of source) {
      if (seenIds.has(c.id)) continue;
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = c.phone.toLowerCase().includes(q) || (qDigits && normalizePhone(c.phone).includes(qDigits));
      const idMatch = c.customerId ? c.customerId.toLowerCase().includes(q) : false;

      if (nameMatch || phoneMatch || idMatch) {
        seenIds.add(c.id);
        filtered.push(c);
      }
    }

    // Also check customersData to ensure no omissions
    for (const c of customersData) {
      if (seenIds.has(c.id)) continue;
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = c.phone.toLowerCase().includes(q) || (qDigits && normalizePhone(c.phone).includes(qDigits));
      const idMatch = c.customerId ? c.customerId.toLowerCase().includes(q) : false;

      if (nameMatch || phoneMatch || idMatch) {
        seenIds.add(c.id);
        filtered.push(c);
      }
    }

    return filtered.slice(0, 15);
  }, [customerSearch, searchResults, customersData]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: async (data) => {
      await utils.orders.list.invalidate();
      await utils.customers.list.invalidate();
      await utils.customers.search.invalidate();
      await utils.dashboard.stats.invalidate();
      toast.success(`Bill ${data.id} created successfully!`, {
        description: `Customer: ${data.customer} ${data.customerId ? `(ID: ${data.customerId})` : ""}`,
      });
      onSuccess();
    },
    onError: (err) => {
      // Check if duplicate customer conflict error
      const normPhone = normalizePhone(phone);
      const foundDuplicate = customersData.find((c) => normalizePhone(c.phone) === normPhone);
      if (foundDuplicate) {
        setDuplicateCustomer(foundDuplicate);
        setShowDuplicateModal(true);
      } else {
        toast.error("Could not create laundry bill", { description: err.message });
      }
    },
  });

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setPhone(c.phone);
    setCustomerId(c.customerId || "");
    setAddress(c.address || "");
    setAlternatePhone(c.alternatePhone || "");
    setNotes(c.notes || "");
    setCustomerSearch(`${c.name} (${c.phone})`);
    setIsDropdownOpen(false);
    setHighlightedIndex(0);

    if (c.address || c.alternatePhone || c.notes) {
      setShowExtraDetails(true);
    }
    toast.success(`Loaded customer: ${c.name}`, { description: `Phone: ${c.phone}${c.customerId ? ` · ID: ${c.customerId}` : ""}` });
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    setCustomerName("");
    setPhone("");
    setCustomerId("");
    setAddress("");
    setAlternatePhone("");
    setNotes("");
    setCustomerSearch("");
    setUpdateCustomerProfile(false);
    setIsDropdownOpen(false);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
  };

  const handleCreateNewFromSearch = (initialName?: string) => {
    setCustomerMode("new");
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    if (initialName && initialName.trim()) {
      // If user typed digits, set as phone; otherwise set as name
      const cleanDigits = normalizePhone(initialName);
      if (/^\d{5,}$/.test(initialName.replace(/\s+/g, ""))) {
        setPhone(initialName.trim());
        setCustomerName("");
      } else {
        setCustomerName(initialName.trim());
      }
    }
    setIsDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen || matchingCustomers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % matchingCustomers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + matchingCustomers.length) % matchingCustomers.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matchingCustomers[highlightedIndex]) {
        handleSelectCustomer(matchingCustomers[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const activeCatalog = useMemo(() => {
    const activeDbItems = dbProducts.filter((p: any) => p.status === "Active");
    if (activeDbItems.length > 0) {
      return activeDbItems.map((p: any) => ({
        label: p.name,
        price: p.price,
      }));
    }
    return defaultCatalog;
  }, [dbProducts]);

  const addItemToBill = (label: string, price: number) => {
    setItems((current: OrderItemInput[]) => {
      const existingIdx = current.findIndex((i: OrderItemInput) => i.name === label);
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
    setItems((current: OrderItemInput[]) => {
      const copy = [...current];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_: OrderItemInput, i: number) => i !== index);
      }
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    setItems((current: OrderItemInput[]) => {
      const copy = [...current];
      copy[index].price = Math.max(0, newPrice);
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setItems((current: OrderItemInput[]) => current.filter((_: OrderItemInput, i: number) => i !== index));
  };

  const subtotal = items.reduce((sum: number, item: OrderItemInput) => sum + item.quantity * item.price, 0);
  const totalGarments = items.reduce((sum: number, item: OrderItemInput) => sum + item.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const applyAdvanceQuick = (opt: "full" | "half" | "none") => {
    setAdvanceOption(opt);
    if (opt === "full") setAdvancePaid(grandTotal);
    else if (opt === "half") setAdvancePaid(Math.round(grandTotal / 2));
    else setAdvancePaid(0);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("Customer Name is required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Mobile Number is required");
      return;
    }
    if (!customerId.trim()) {
      toast.error("Customer ID is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least 1 cloth item to the bill");
      return;
    }

    const cleanCustId = customerId.trim().toLowerCase();
    // Check if Customer ID is already used by another customer (case-insensitive & trimmed)
    const duplicateIdCust = customersData.find(
      (c) => c.customerId && c.customerId.trim().toLowerCase() === cleanCustId && c.id !== selectedCustomerId
    );
    if (duplicateIdCust) {
      toast.error("This Customer ID is already used", {
        description: `Customer ID "${customerId.trim()}" is already assigned to ${duplicateIdCust.name} (${duplicateIdCust.phone}).`,
      });
      return;
    }

    const normPhone = normalizePhone(phone);

    // Front-end duplicate validation for New Customer mode by phone
    if (!selectedCustomerId && normPhone) {
      const existingMatch = customersData.find((c) => normalizePhone(c.phone) === normPhone);
      if (existingMatch) {
        setDuplicateCustomer(existingMatch);
        setShowDuplicateModal(true);
        return;
      }
    }

    const isExisting = customerMode === "existing" && Boolean(selectedCustomerId);

    createOrderMutation.mutate({
      customerRefId: isExisting ? (selectedCustomerId || undefined) : undefined,
      customerId: customerId.trim(),
      customerName: customerName.trim(),
      phone: phone.trim() || "0000000000",
      customerType: "Normal",
      address: address.trim() || undefined,
      alternatePhone: alternatePhone.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
      serviceType: "Standard Laundry",
      orderDate: billDate ? new Date(`${billDate}T12:00:00`).toISOString() : undefined,
      totalAmount: grandTotal,
      discount,
      amountPaid: Math.min(grandTotal, advancePaid),
      updateCustomerMaster: isExisting ? updateCustomerProfile : undefined,
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
              <p className="text-[10px] sm:text-[11px] text-white/80">Auto Bill #: {nextBillNumber}</p>
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#0F4C5C] flex items-center gap-1.5">
                <User className="size-3.5 sm:size-4" /> Customer Information
              </span>
              <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-[10px] sm:text-[11px] font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("new");
                    if (selectedCustomerId) handleClearCustomer();
                  }}
                  className={`rounded-md px-2.5 py-1 transition ${
                    customerMode === "new" ? "bg-[#0F4C5C] text-white shadow-xs" : "text-[#0F4C5C]"
                  }`}
                >
                  New Customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("existing");
                    setIsDropdownOpen(true);
                  }}
                  className={`rounded-md px-2.5 py-1 transition ${
                    customerMode === "existing" ? "bg-[#0F4C5C] text-white shadow-xs" : "text-[#0F4C5C]"
                  }`}
                >
                  Existing Search
                </button>
              </div>
            </div>

            {/* Existing Customer Selected Banner */}
            {selectedCustomerId && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="size-4 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-emerald-900">{customerName}</span>
                    <span className="text-emerald-700 ml-1.5">({phone || "No phone"})</span>
                    {customerId && <span className="text-emerald-800 ml-1.5 font-mono font-bold">· ID: {customerId}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="shrink-0 text-[11px] font-bold text-[#0F4C5C] hover:underline"
                >
                  Change Customer
                </button>
              </div>
            )}

            {/* Searchable Customer Autocomplete Field */}
            <div className="relative" ref={dropdownRef}>
              <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">
                Customer Name * {customerMode === "existing" && <span className="text-[10px] text-slate-500 font-normal">(Searchable)</span>}
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  required
                  placeholder={
                    customerMode === "existing"
                      ? "Search customer by name (e.g. Rahul), mobile, or Customer ID..."
                      : "Search or type customer name (e.g. Rahul Kumar)..."
                  }
                  value={customerName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setCustomerName(e.target.value);
                    setCustomerSearch(e.target.value);
                    setIsDropdownOpen(true);
                    if (selectedCustomerId) {
                      // Disconnect selected customer ID if user changes name manually without reselecting
                      setSelectedCustomerId(null);
                      setSelectedCustomer(null);
                    }
                  }}
                  onFocus={() => {
                    setCustomerSearch(customerName);
                    setIsDropdownOpen(true);
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pr-9 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                  autoComplete="off"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Search className="size-4" />
                </div>
              </div>

              {/* Autocomplete Dropdown */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-[60px] z-30 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  {isSearching && (
                    <div className="py-2.5 px-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                      <RefreshCw className="size-3.5 animate-spin text-[#0F4C5C]" /> Searching customer database...
                    </div>
                  )}

                  {!isSearching && matchingCustomers.length === 0 ? (
                    <div className="p-3 text-center space-y-2">
                      <p className="text-xs text-slate-500">No matching customer found.</p>
                      <button
                        type="button"
                        onClick={() => handleCreateNewFromSearch(customerName)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F4C5C] text-white text-[11px] font-bold hover:bg-[#0F4C5C]/90 transition"
                      >
                        <Plus className="size-3" /> Create as New Customer
                      </button>
                    </div>
                  ) : (
                    matchingCustomers.map((c, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                            isHighlighted ? "bg-slate-100 text-[#0F4C5C]" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-[#0F4C5C] truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Phone className="size-2.5 text-slate-400" />
                                <span>{formatPhoneDisplay(c.phone)}</span>
                              </span>
                              {c.customerId && (
                                <span className="font-mono font-bold text-[#0F4C5C] bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                                  ID: {c.customerId}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {selectedCustomerId === c.id && <Check className="size-3.5 text-emerald-600" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handlePhoneChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-[#0F4C5C]">Customer ID *</label>
                  {selectedCustomerId && selectedCustomer?.customerId && (
                    <span className="text-[10px] text-slate-500 font-medium">Locked (Saved)</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter unique customer ID"
                  value={customerId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomerId(e.target.value)}
                  readOnly={Boolean(selectedCustomerId && selectedCustomer?.customerId)}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] ${
                    selectedCustomerId && selectedCustomer?.customerId
                      ? "border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed select-none"
                      : "border-slate-300 bg-white text-slate-800"
                  }`}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Bill / Order Date</label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBillDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0F4C5C] focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                />
              </div>

              {selectedCustomerId && (
                <div className="flex items-center gap-2 self-end pb-2">
                  <input
                    type="checkbox"
                    id="updateMasterCheckbox"
                    checked={updateCustomerProfile}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setUpdateCustomerProfile(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-[#0F4C5C] focus:ring-[#0F4C5C]"
                  />
                  <label htmlFor="updateMasterCheckbox" className="text-[11px] text-slate-600 font-medium cursor-pointer">
                    Update customer profile for future bills
                  </label>
                </div>
              )}
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
                    <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Alternate Phone</label>
                    <input
                      type="tel"
                      placeholder="Optional second number"
                      value={alternatePhone}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setAlternatePhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 12/4, Main Road, Periyakulam"
                      value={address}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-[#0F4C5C]">Customer Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Handle silk with care, Starch collar"
                      value={notes}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cloth Items & Catalog */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#0F4C5C] flex items-center gap-1.5">
                <Tag className="size-3.5 sm:size-4" /> Quick Item Selector
              </span>
              <span className="text-[10px] text-slate-500">Tap to add to bill</span>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {activeCatalog.map((cat: { label: string; price: number }) => (
                <button
                  type="button"
                  key={cat.label}
                  onClick={() => addItemToBill(cat.label, cat.price)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#0F4C5C] hover:bg-slate-100 hover:text-[#0F4C5C] transition active:scale-95"
                >
                  <span>{cat.label}</span>
                  <span className="font-bold text-[#0F4C5C]">₹{cat.price}</span>
                  <Plus className="size-3 text-[#0F4C5C]" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="flex items-center gap-1 rounded-xl border border-dashed border-[#0F4C5C] bg-white px-2.5 py-1.5 text-xs font-bold text-[#0F4C5C] hover:bg-slate-50 transition"
              >
                <Plus className="size-3" /> Custom Item
              </button>
            </div>

            {showCustomInput && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <input
                  type="text"
                  placeholder="Custom Item (e.g. Leather Jacket)"
                  value={customItemName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomItemName(e.target.value)}
                  className="flex-1 min-w-[140px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                />
                <input
                  type="number"
                  placeholder="₹ Rate"
                  value={customItemPrice}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomItemPrice(e.target.value)}
                  className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="rounded-lg bg-[#0F4C5C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0F4C5C]/90"
                >
                  Add
                </button>
              </div>
            )}

            {/* Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                <span>Selected Items ({totalGarments} pcs)</span>
                <span>Amount</span>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  No items in this bill yet. Tap an item above to add.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {items.map((item: OrderItemInput, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 bg-white hover:bg-slate-50/50">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-slate-300 hover:text-rose-500 transition p-1"
                        >
                          <Trash2 className="size-3.5 sm:size-4" />
                        </button>
                        <div className="truncate">
                          <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400">Rate: ₹{item.price}/pc</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                        {/* Qty Stepper */}
                        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => updateItemQty(idx, -1)}
                            className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-l-lg"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-[#0F4C5C]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItemQty(idx, 1)}
                            className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-r-lg"
                          >
                            +
                          </button>
                        </div>

                        {/* Price Edit / Display */}
                        <div className="w-16 text-right">
                          <span className="font-bold text-slate-800 text-xs">
                            ₹{item.quantity * item.price}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pricing Calculation & Advance */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Subtotal ({totalGarments} garments):</span>
              <span className="font-bold text-slate-800">₹{subtotal}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Special Discount (₹):</span>
              <input
                type="number"
                min="0"
                max={subtotal}
                value={discount || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-right text-xs font-bold text-[#0F4C5C] focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
              />
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-bold">
              <span className="text-[#0F4C5C]">Grand Total:</span>
              <span className="text-base text-[#0F4C5C]">₹{grandTotal}</span>
            </div>

            {/* Advance Payment Options */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <label className="block text-[11px] font-semibold text-[#0F4C5C]">Advance Payment</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => applyAdvanceQuick("none")}
                  className={`rounded-lg py-1.5 border transition ${
                    advanceOption === "none"
                      ? "bg-[#0F4C5C] text-white border-[#0F4C5C]"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Unpaid
                </button>
                <button
                  type="button"
                  onClick={() => applyAdvanceQuick("half")}
                  className={`rounded-lg py-1.5 border transition ${
                    advanceOption === "half"
                      ? "bg-[#0F4C5C] text-white border-[#0F4C5C]"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  50% Advance (₹{Math.round(grandTotal / 2)})
                </button>
                <button
                  type="button"
                  onClick={() => applyAdvanceQuick("full")}
                  className={`rounded-lg py-1.5 border transition ${
                    advanceOption === "full"
                      ? "bg-[#0F4C5C] text-white border-[#0F4C5C]"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Full Paid (₹{grandTotal})
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">Custom Advance Amount:</span>
                <input
                  type="number"
                  min="0"
                  max={grandTotal}
                  value={advancePaid || ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const v = Number(e.target.value) || 0;
                    setAdvancePaid(v);
                    setAdvanceOption("custom");
                  }}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-right text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                />
              </div>

              <div className="flex justify-between text-xs font-bold pt-1">
                <span className="text-slate-500">Balance Due at Delivery:</span>
                <span className={grandTotal - advancePaid > 0 ? "text-amber-600" : "text-emerald-600"}>
                  ₹{Math.max(0, grandTotal - advancePaid)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-[#0F4C5C] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#0F4C5C]/90 active:scale-95 transition disabled:opacity-50"
            >
              <Check className="size-4" />
              {createOrderMutation.isPending ? "Creating Bill..." : `Save & Generate Bill (₹${grandTotal})`}
            </button>
          </div>
        </form>

        {/* Duplicate Customer Warning Modal */}
        {showDuplicateModal && duplicateCustomer && (
          <div className="fixed inset-0 z-60 bg-[#0F4C5C]/50 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-amber-100 text-amber-600 grid place-items-center shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Customer Already Exists</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    A customer with this mobile number is already registered in your directory.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#0F4C5C] text-sm">{duplicateCustomer.name}</span>
                  {duplicateCustomer.customerId && (
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                      ID: {duplicateCustomer.customerId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="size-3 text-slate-400" />
                  <span>{duplicateCustomer.phone}</span>
                </div>
                {duplicateCustomer.address && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="size-3 text-slate-400" />
                    <span className="truncate">{duplicateCustomer.address}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600">
                Please select the existing customer to link this bill instead of creating an accidental duplicate.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectCustomer(duplicateCustomer);
                    setShowDuplicateModal(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C5C] py-2.5 px-4 text-xs font-bold text-white shadow-md hover:bg-[#0F4C5C]/90 transition"
                >
                  <UserCheck className="size-4" /> Select Existing Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="w-full sm:w-auto rounded-xl border border-slate-200 py-2.5 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Change Mobile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
