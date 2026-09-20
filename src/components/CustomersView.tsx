import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Users, Search, Phone, Tag, CreditCard, ChevronRight, History, X } from "lucide-react";
import { toast } from "sonner";

export default function CustomersView({ onNewOrder }: { onNewOrder?: (customer?: any) => void }) {
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();
  const { data: orders = [] } = trpc.orders.list.useQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

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
    `${c.name} ${c.phone} ${c.storedClothesCode || ""}`
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
            Manage customer accounts, saved garment codes, and running balances
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>
          {onNewOrder && (
            <button
              onClick={() => onNewOrder()}
              className="px-4 py-2 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              + New Bill
            </button>
          )}
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
                    <h3 className="font-bold text-slate-800 text-sm">{c.name}</h3>
                    <a
                      href={`tel:${c.phone}`}
                      className="text-xs text-[#0F4C5C] hover:underline flex items-center gap-1 mt-0.5"
                      title="Tap to call"
                    >
                      <Phone className="size-3" /> {c.phone}
                    </a>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#0F4C5C]/10 text-[#0F4C5C]">
                    {c.customerType || "Normal"}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  {c.storedClothesCode && (
                    <div className="flex justify-between items-center text-slate-600 bg-slate-50 p-2 rounded-xl">
                      <span className="text-[11px] text-slate-500">Clothes Tag Code:</span>
                      <span className="font-mono font-bold text-[#0F4C5C]">
                        {c.storedClothesCode}
                      </span>
                    </div>
                  )}

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
        />
      )}
    </div>
  );
}

function CustomerHistoryModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 sm:pb-4 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#0F4C5C]">{customer.name}</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">{customer.phone} · Tag Code: {customer.storedClothesCode || "N/A"}</p>
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
              <div key={o.id} className="border border-slate-200/80 p-3 rounded-xl space-y-1 text-xs bg-slate-50/50">
                <div className="flex justify-between font-mono font-bold text-[#0F4C5C]">
                  <span>{o.id}</span>
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
          className="w-full py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition shrink-0"
        >
          Close
        </button>
      </div>
    </div>
  );
}
