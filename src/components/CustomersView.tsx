import { useState, useEffect } from "react";
import { trpc, type Customer } from "@/lib/trpc";
import { normalizePhone } from "@/lib/phone";
import InvoiceModal from "./InvoiceModal";
import { Users, Search, Phone, History, X, FileText, Pencil, Plus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAccessControl } from "@/contexts/AccessControlContext";

export default function CustomersView({ onNewOrder }: { onNewOrder?: (customer?: any) => void }) {
  const { canDelete } = useAccessControl();
  const utils = trpc.useUtils();
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<any | null>(null);

  const deleteCustomerMutation = trpc.customers.delete.useMutation({
    onSuccess: async () => {
      await utils.customers.list.invalidate();
      await utils.customers.search.invalidate();
      await utils.recycleBin.counts.invalidate();
      await utils.recycleBin.list.invalidate();
      toast.success("Customer moved to Recycle Bin", {
        description: "You can restore or permanently delete it from the Recycle Bin.",
      });
    },
    onError: (err: any) => toast.error("Failed to delete customer", { description: err.message }),
  });

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
      setSelectedInvoiceOrder(null);
    },
    onError: (err: Error) => toast.error("Failed to move bill to Recycle Bin", { description: err.message }),
  });

  // Listen for mobile floating "+" button trigger on Customers page
  useEffect(() => {
    const handleOpenAdd = () => {
      setEditingCustomer(null);
      setShowAddCustomer(true);
    };
    window.addEventListener("open-add-customer", handleOpenAdd);
    return () => window.removeEventListener("open-add-customer", handleOpenAdd);
  }, []);

  const customerStats = customers.map((c) => {
    const customerOrders = orders.filter((o) => o.phone === c.phone || o.customer === c.name);
    const totalBilled = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPaid = customerOrders.reduce((sum, o) => sum + o.amountPaid, 0);
    const runningBalance = Math.max(0, totalBilled - totalPaid);

    return {
      ...c,
      orderCount: customerOrders.length,
      totalBilled,
      runningBalance,
      customerOrders,
    };
  });

  const filteredCustomers = customerStats.filter((c) =>
    `${c.name} ${c.phone} ${c.customerId || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <Users className="size-5 sm:size-6 text-[#0F4C5C]" />
            Customer Directory
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Manage customer accounts, Customer IDs, and running balances
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>

          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowAddCustomer(true);
            }}
            className="px-4 py-2 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 min-h-[40px]"
          >
            <Plus className="size-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading directory...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center text-slate-500 text-xs shadow-xs">
          No customers found matching your search.
        </div>
      ) : (
        <div className="grid gap-3.5 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredCustomers.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition space-y-3.5 sm:space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-sm">{c.name}</h3>
                      {c.customerId ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[#0F4C5C]/10 text-[#0F4C5C]">
                          ID: {c.customerId}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          No ID
                        </span>
                      )}
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      className="text-xs text-[#0F4C5C] hover:underline flex items-center gap-1 mt-1"
                      title="Tap to call"
                    >
                      <Phone className="size-3" /> {c.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingCustomer(c)}
                      className="p-1.5 text-slate-400 hover:text-[#0F4C5C] hover:bg-slate-100 rounded-lg transition"
                      title="Edit Customer"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Move customer "${c.name}" to Recycle Bin?\n\nThis customer account will be moved to the Recycle Bin and can be restored later.`
                            )
                          ) {
                            deleteCustomerMutation.mutate({ id: c.id });
                          }
                        }}
                        disabled={deleteCustomerMutation.isPending}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Move to Recycle Bin"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Total Orders:</span>
                    <span className="font-bold text-slate-800">
                      {c.orderCount} {c.orderCount === 1 ? "order" : "orders"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>Running Balance:</span>
                    <span
                      className={`font-bold ${
                        c.runningBalance > 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {c.runningBalance > 0 ? `₹${c.runningBalance} Due` : "Clear"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setSelectedCustomer(c)}
                  className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-1 active:scale-95"
                >
                  <History className="size-3.5" /> History
                </button>
                {onNewOrder && (
                  <button
                    onClick={() => onNewOrder(c)}
                    className="flex-1 py-2 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition flex items-center justify-center gap-1 active:scale-95 shadow-xs"
                  >
                    + New Bill
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Detail / History Modal */}
      {selectedCustomer && (
        <CustomerHistoryModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onSelectOrder={(o) => {
            setSelectedCustomer(null);
            setSelectedInvoiceOrder(o);
          }}
        />
      )}

      {/* Add or Edit Customer Modal */}
      {(showAddCustomer || editingCustomer) && (
        <CustomerFormModal
          customer={editingCustomer}
          existingCustomers={customers}
          onClose={() => {
            setShowAddCustomer(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Invoice Modal for selected order */}
      {selectedInvoiceOrder && (
        <InvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
          onDelete={() => {
            if (!canDelete) {
              toast.error("Permission Denied", {
                description: "Staff role is restricted from deleting bills. Contact an Admin or Manager.",
              });
              return;
            }
            if (confirm(`Move Bill ${selectedInvoiceOrder.id} to Recycle Bin?\n\nThis item will be moved to the Recycle Bin and can be restored later.`)) {
              deleteOrderMutation.mutate({ id: selectedInvoiceOrder.id });
            }
          }}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

function CustomerFormModal({
  customer,
  existingCustomers,
  onClose,
}: {
  customer?: Customer | null;
  existingCustomers: Customer[];
  onClose: () => void;
}) {
  const isEditing = Boolean(customer);
  const { canDelete } = useAccessControl();
  const utils = trpc.useUtils();
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [customerId, setCustomerId] = useState(customer?.customerId || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [alternatePhone, setAlternatePhone] = useState(customer?.alternatePhone || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: async () => {
      await utils.customers.list.invalidate();
      await utils.customers.search.invalidate();
      toast.success("Customer added successfully");
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create customer");
    },
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: async () => {
      await utils.customers.list.invalidate();
      await utils.customers.search.invalidate();
      await utils.orders.list.invalidate();
      toast.success("Customer details updated successfully");
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update customer");
    },
  });

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: async () => {
      await utils.customers.list.invalidate();
      await utils.customers.search.invalidate();
      await utils.recycleBin.counts.invalidate();
      await utils.recycleBin.list.invalidate();
      toast.success("Customer moved to Recycle Bin", {
        description: "You can restore or permanently delete it from the Recycle Bin.",
      });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to delete customer");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedCustomerId = customerId.trim();
    const normPhone = normalizePhone(trimmedPhone);

    if (!trimmedName) {
      setError("Customer name is required");
      return;
    }
    if (!trimmedPhone) {
      setError("Mobile number is required");
      return;
    }
    if (normPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!trimmedCustomerId) {
      setError("Customer ID is required");
      return;
    }

    // 1. Check duplicate Customer ID (case-insensitive)
    const duplicateId = existingCustomers.find((c) => {
      if (isEditing && c.id === customer?.id) return false;
      return (
        c.customerId &&
        c.customerId.trim().toLowerCase() === trimmedCustomerId.toLowerCase()
      );
    });
    if (duplicateId) {
      setError("This Customer ID is already used");
      return;
    }

    // 2. Check duplicate Mobile Number
    const duplicatePhone = existingCustomers.find((c) => {
      if (isEditing && c.id === customer?.id) return false;
      const cNorm = normalizePhone(c.phone || "");
      return cNorm === normPhone || c.phone.trim() === trimmedPhone;
    });
    if (duplicatePhone) {
      setError("A customer with this mobile number already exists");
      return;
    }

    if (isEditing && customer) {
      updateMutation.mutate({
        id: customer.id,
        name: trimmedName,
        phone: trimmedPhone,
        customerId: trimmedCustomerId,
        address: address.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } else {
      createMutation.mutate({
        name: trimmedName,
        phone: trimmedPhone,
        customerId: trimmedCustomerId,
        customerType: "Normal",
        address: address.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#0F4C5C]">
              {isEditing ? "Edit Customer" : "Add Customer"}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {isEditing
                ? "Update customer details or assign a Customer ID"
                : "Create a new customer profile for directory and billing"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              placeholder="Full name"
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              placeholder="10-digit mobile number"
              onChange={(e) => setPhone(e.target.value)}
              maxLength={10}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Customer ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={customerId}
              placeholder="Enter unique customer ID"
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">Unique identifier (e.g. CUST-001)</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Address <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={address}
              placeholder="House, street, landmark"
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Alternate Phone <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="tel"
              value={alternatePhone}
              placeholder="Secondary mobile number"
              onChange={(e) => setAlternatePhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              placeholder="Preferences, directions, notes..."
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[50px] w-full resize-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            {isEditing && canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Move customer "${customer?.name}" to Recycle Bin?\n\nThis customer account will be moved to the Recycle Bin and can be restored later.`
                    )
                  ) {
                    deleteMutation.mutate({ id: customer!.id });
                  }
                }}
                disabled={deleteMutation.isPending}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold rounded-xl transition flex items-center justify-center min-h-[44px]"
                title="Move customer to Recycle Bin"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Check className="size-4" /> {isPending ? "Saving..." : isEditing ? "Save Changes" : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerHistoryModal({
  customer,
  onClose,
  onSelectOrder,
}: {
  customer: any;
  onClose: () => void;
  onSelectOrder: (order: any) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 sm:pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-[#0F4C5C]">{customer.name}</h3>
              {customer.customerId && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[#0F4C5C]/10 text-[#0F4C5C]">
                  ID: {customer.customerId}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{customer.phone}</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl flex justify-between items-center text-xs shrink-0">
          <div>
            <span className="text-slate-500 block text-[11px]">Total Billed:</span>
            <span className="text-sm font-bold text-slate-800">₹{customer.totalBilled}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[11px]">Current Balance:</span>
            <span className={`text-sm font-bold ${customer.runningBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {customer.runningBalance > 0 ? `₹${customer.runningBalance} Due` : "Paid in Full"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Past Laundry Orders</h4>
          {customer.customerOrders.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No order history found.</p>
          ) : (
            customer.customerOrders.map((o: any) => (
              <div
                key={o.id}
                onClick={() => onSelectOrder(o)}
                className="border border-slate-200/80 p-3 rounded-xl space-y-1 text-xs bg-slate-50/50 hover:bg-slate-100/80 cursor-pointer transition group"
              >
                <div className="flex justify-between font-mono font-bold text-[#0F4C5C]">
                  <span className="group-hover:underline flex items-center gap-1">
                    <FileText className="size-3" /> {o.id}
                  </span>
                  <span className="text-slate-700 font-sans font-semibold text-[11px]">{o.status}</span>
                </div>
                <p className="text-slate-600 text-[11px] line-clamp-2">{o.items}</p>
                <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-100 text-[11px]">
                  <span>Bill: ₹{o.totalAmount}</span>
                  <span className="font-semibold text-slate-700">Paid: ₹{o.amountPaid}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition shrink-0 min-h-[44px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
