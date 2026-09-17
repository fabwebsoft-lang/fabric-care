import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  FileText,
  Search,
  Download,
  ChevronRight,
  Filter,
  Eye,
  Tag,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  Received: "bg-amber-100 text-amber-800 border-amber-200",
  Processing: "bg-blue-100 text-blue-800 border-blue-200",
  Ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Collected: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function BillsView({ onNewOrder }: { onNewOrder: () => void }) {
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery();
  const { canDelete, role } = useAccessControl();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;
    const matchesQuery =
      `${o.id} ${o.customer} ${o.phone}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <FileText className="size-5 sm:size-6 text-[#0F4C5C]" />
            Bills & Invoices
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Full history of customer laundry bills, payment status, and cloth tags
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search bill #, customer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
          </div>
          <button
            onClick={onNewOrder}
            className="px-4 py-2 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            + New Order
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
        {["All", "Received", "Processing", "Ready", "Collected"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === st
                ? "bg-[#0F4C5C] text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading invoices...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200/80 shadow-xs">
          <FileText className="size-10 sm:size-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm sm:text-base font-bold text-slate-700">No bills found</p>
          <p className="text-xs text-slate-500 mt-1">Try changing search filters or create a new order</p>
        </div>
      ) : (
        <>
          {/* Mobile Cards View (< md) */}
          <div className="grid gap-3 grid-cols-1 md:hidden">
            {filteredOrders.map((order) => {
              const dueAmount = Math.max(0, order.totalAmount - order.amountPaid);
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 cursor-pointer hover:border-[#0F4C5C]/40 transition active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#0F4C5C]">
                        {order.id}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm mt-0.5">{order.customer}</h3>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="size-3" /> {order.phone}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                        statusStyles[order.status]
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 font-medium">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Garments:</span>
                    <p className="truncate">{order.items}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px]">Total: </span>
                      <strong className="text-slate-800 font-bold">{order.amount}</strong>
                    </div>
                    <div>
                      {dueAmount > 0 ? (
                        <span className="text-rose-600 font-bold text-xs">₹{dueAmount} due</span>
                      ) : (
                        <span className="text-emerald-600 font-bold text-xs">Paid in Full</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-slate-100 text-[#0F4C5C] font-bold rounded-lg text-[11px] flex items-center gap-1"
                    >
                      <Eye className="size-3" /> View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold">
                    <th className="py-3 px-4">Bill #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Garments / Items</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const dueAmount = Math.max(0, order.totalAmount - order.amountPaid);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#0F4C5C]">
                          {order.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{order.customer}</p>
                          <p className="text-slate-400 text-[10px]">{order.phone}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-[240px] truncate">
                          {order.items}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {order.amount}
                        </td>
                        <td className="py-3.5 px-4 font-medium">
                          {dueAmount > 0 ? (
                            <span className="text-rose-600 font-bold">₹{dueAmount} due</span>
                          ) : (
                            <span className="text-emerald-600 font-bold">Paid</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                              statusStyles[order.status]
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 bg-slate-100 text-[#0F4C5C] font-semibold rounded-lg hover:bg-slate-200 transition text-[11px] inline-flex items-center gap-1"
                          >
                            <Eye className="size-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Bill Details Modal */}
      {selectedOrder && (
        <BillDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

function BillDetailsModal({ order, onClose }: { order: any; onClose: () => void }) {
  const { canDelete, role } = useAccessControl();
  const utils = trpc.useUtils();
  const dueAmount = Math.max(0, order.totalAmount - order.amountPaid);

  const deleteOrderMutation = trpc.orders.delete.useMutation({
    onSuccess: async () => {
      await utils.orders.list.invalidate();
      toast.success(`Bill ${order.id} deleted`);
      onClose();
    },
    onError: (err) => toast.error("Failed to delete bill", { description: err.message }),
  });

  const handleDelete = () => {
    if (!canDelete) {
      toast.error("Permission Denied", { description: "Staff role is restricted from deleting bills. Contact an Admin or Manager." });
      return;
    }
    if (confirm(`Are you sure you want to delete Bill ${order.id}? This action cannot be undone.`)) {
      deleteOrderMutation.mutate({ id: order.id });
    }
  };

  const handleDownloadReceipt = () => {
    const receiptHtml = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fabric Care Receipt ${order.id}</title>
  <style>
    body { margin:0; background:#f8fafc; color:#0f172a; font:14px Arial,sans-serif; }
    .receipt { width:100%; max-width:580px; margin:24px auto; background:#fff; padding:28px; border-radius:16px; border:1px solid #e2e8f0; }
    .brand { color:#0F4C5C; font-size:22px; font-weight:700; }
    .muted { color:#64748b; font-size:12px; }
    .rule { border:0; border-top:1px solid #e2e8f0; margin:20px 0; }
    .row { display:flex; justify-space-between; padding:8px 0; font-size:13px; }
    .value { font-weight:700; text-align:right; }
    .footer { margin-top:24px; color:#64748b; font-size:11px; text-align:center; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">Fabric Care</div>
    <div class="muted">Laundry & Dry Cleaning Operations</div>
    <hr class="rule">
    <div class="row"><span class="muted">Bill #</span><span class="value">${order.id}</span></div>
    <div class="row"><span class="muted">Customer</span><span class="value">${order.customer}</span></div>
    <div class="row"><span class="muted">Phone</span><span class="value">${order.phone}</span></div>
    <div class="row"><span class="muted">Garments</span><span class="value">${order.items}</span></div>
    <div class="row"><span class="muted">Status</span><span class="value">${order.status}</span></div>
    <hr class="rule">
    <div class="row"><span class="muted">Total Amount</span><span class="value">${order.amount}</span></div>
    <div class="row"><span class="muted">Amount Paid</span><span class="value">₹${order.amountPaid}</span></div>
    <div class="row"><span class="muted">Balance Due</span><span class="value" style="color:${dueAmount > 0 ? '#e11d48' : '#059669'}">₹${dueAmount}</span></div>
    <div class="footer">Thank you for trusting Fabric Care!</div>
  </div>
</body>
</html>`;

    const blob = new Blob([receiptHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fabric-care-${order.id.toLowerCase()}-receipt.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded successfully");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F4C5C]/50 backdrop-blur-sm p-3 sm:p-6 flex justify-center items-center min-h-screen">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50 shrink-0">
          <div>
            <span className="font-mono text-xs font-bold text-[#0F4C5C]">
              {order.id}
            </span>
            <h3 className="text-base font-bold text-slate-800">{order.customer}</h3>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Phone</span>
              <p className="font-bold text-slate-700 mt-0.5">{order.phone}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Status</span>
              <p className="font-bold text-[#0F4C5C] mt-0.5">{order.status}</p>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Garments List</span>
            <p className="font-medium text-slate-700">{order.items}</p>
          </div>

          <div className="bg-[#0F4C5C]/5 p-4 rounded-xl border border-[#0F4C5C]/20 space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span>Total Bill Amount:</span>
              <span className="font-bold text-slate-800 text-sm">{order.amount}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Advance Paid:</span>
              <span className="font-bold text-emerald-600">₹{order.amountPaid}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#0F4C5C]/15">
              <span className="font-bold text-slate-800">Remaining Balance:</span>
              <span className={`font-bold text-sm ${dueAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {dueAmount > 0 ? `₹${dueAmount}` : "Paid in Full"}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50 flex flex-wrap sm:flex-nowrap gap-2 justify-end shrink-0">
          <button
            onClick={handleDownloadReceipt}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#0F4C5C] text-white font-bold rounded-xl text-xs hover:bg-[#0F4C5C]/90 transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Download className="size-3.5" /> Download Receipt
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteOrderMutation.isPending || !canDelete}
            className="flex-1 sm:flex-none px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs hover:bg-rose-100 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
