import React, { useState, useMemo, useEffect } from "react";
import {
  Printer,
  Download,
  Share2,
  X,
  MessageSquare,
  Copy,
  ExternalLink,
  Send,
  Check,
  QrCode,
  Layers,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  PaperSize,
  InvoiceOrderData,
  formatISTDate,
  formatRupee,
  getOrderItemsList,
  printInvoice,
  downloadInvoiceHtml,
} from "@/lib/invoiceGenerator";
import { useInvoiceSettings } from "@/lib/invoiceSettings";
import { numberToIndianWords } from "@/lib/numberToWords";
import { generateQrDataUrl } from "@/lib/qrcode";
import { buildBillText, getSmsUri, getWhatsAppUri } from "@/lib/billText";

import {
  SHOP_BRANCHES,
  getBranchByAddressOrName,
  getBranchById,
} from "@/lib/branches";

interface InvoiceModalProps {
  order: any;
  onClose: () => void;
  onSendSms?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

export default function InvoiceModal({
  order,
  onClose,
  onSendSms,
  onDelete,
  canDelete,
}: InvoiceModalProps) {
  const [settings] = useInvoiceSettings();
  const [format, setFormat] = useState<PaperSize>(settings.defaultPaperSize || "A4");
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Branch state for invoice
  const initialBranch = getBranchByAddressOrName(order.branchAddress || order.branch);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranch.id);
  const selectedBranch = useMemo(() => getBranchById(selectedBranchId), [selectedBranchId]);

  // Normalize order data
  const normalizedOrder: InvoiceOrderData = {
    id: order.id,
    customerId: order.customerId,
    createdAt: order.createdAt,
    dueAt: order.dueAt,
    due: order.due,
    customer: order.customer,
    phone: order.phone,
    customerType: order.customerType,
    serviceType: order.serviceType,
    status: order.status,
    totalAmount: order.totalAmount,
    amountPaid: order.amountPaid,
    discount: order.discount,
    items: order.items,
    structuredItems: order.structuredItems,
    branch: selectedBranch.shortName,
    branchAddress: selectedBranch.address,
  };

  const items = getOrderItemsList(normalizedOrder);
  const dateStr = formatISTDate(normalizedOrder.createdAt);
  const deliveryDateStr = normalizedOrder.dueAt
    ? formatISTDate(normalizedOrder.dueAt)
    : normalizedOrder.due && normalizedOrder.due !== "—"
    ? normalizedOrder.due
    : "";

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0) || normalizedOrder.totalAmount;
  const discount = Number(normalizedOrder.discount) || 0;
  const taxableBase = Math.max(0, subtotal - discount);

  let taxAmount = 0;
  if (settings.enableTax && settings.taxRate > 0) {
    taxAmount = Math.round((taxableBase * settings.taxRate) / 100);
  }

  const grandTotal = settings.enableTax ? taxableBase + taxAmount : normalizedOrder.totalAmount;
  const amountPaid = Number(normalizedOrder.amountPaid) || 0;
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const isPaid = balanceDue <= 0;
  const totalInWords = numberToIndianWords(grandTotal);

  // UPI QR Code Data URL
  let upiQrDataUrl = "";
  if (settings.upiId && settings.upiId.trim()) {
    const payAmount = balanceDue > 0 ? balanceDue : grandTotal;
    const upiUri = `upi://pay?pa=${encodeURIComponent(settings.upiId.trim())}&pn=${encodeURIComponent(settings.shopName)}&am=${payAmount}&cu=INR&tn=${encodeURIComponent(`Bill ${normalizedOrder.id}`)}`;
    upiQrDataUrl = generateQrDataUrl(upiUri, 120);
  }

  const termsLines = (settings.terms || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Print handler
  const handlePrint = () => {
    printInvoice(normalizedOrder, format, settings);
  };

  // Download handler
  const handleDownload = () => {
    downloadInvoiceHtml(normalizedOrder, format, settings);
    toast.success(`${format === "A4" ? "Invoice" : "Receipt"} downloaded successfully`);
  };

  // Plain bill text for sharing
  const billText = buildBillText(normalizedOrder);

  // Share handlers
  const handleShareNative = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Bill ${normalizedOrder.id} - ${settings.shopName}`,
          text: billText,
        });
        toast.success("Shared successfully");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setShowShareMenu(true);
        }
      }
    } else {
      setShowShareMenu(true);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(billText);
      toast.success("Bill text copied to clipboard!");
      setShowShareMenu(false);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleWhatsApp = () => {
    const url = getWhatsAppUri(normalizedOrder.phone, billText);
    window.open(url, "_blank");
    setShowShareMenu(false);
  };

  const handleSms = () => {
    if (!normalizedOrder.phone) {
      toast.error("No phone number registered for customer");
      return;
    }
    const url = getSmsUri(normalizedOrder.phone, billText);
    window.location.href = url;
    setShowShareMenu(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 md:p-6 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-white sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden my-auto"
      >
        {/* Modal Top Bar */}
        <div className="bg-white border-b border-slate-200 px-3.5 sm:px-5 py-2.5 sm:py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0 z-10">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="size-7 sm:size-8 rounded-lg bg-[#0F4C5C] text-white flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
                <FileText className="size-3.5 sm:size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 id="invoice-modal-title" className="font-mono text-xs sm:text-sm font-bold text-[#0F4C5C]">{normalizedOrder.id}</h2>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isPaid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {isPaid ? "PAID" : `DUE ${formatRupee(balanceDue)}`}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-700 truncate max-w-[170px] sm:max-w-xs">{normalizedOrder.customer}</p>
              </div>
            </div>

            {/* Close Button on Mobile */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden size-11 min-h-[44px] min-w-[44px] grid place-items-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] transition shrink-0 cursor-pointer"
              aria-label="Close invoice dialog"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {/* Format Switcher, Branch Selector & Actions */}
          <div className="flex items-center justify-between sm:justify-end flex-wrap gap-1.5 sm:gap-2">
            {/* Branch Selector Dropdown */}
            <div className="flex items-center bg-slate-100 px-2 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1 hidden sm:inline">Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#0F4C5C] focus:outline-none cursor-pointer pr-1"
                aria-label="Select Billing Branch"
              >
                {SHOP_BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.shortName}
                  </option>
                ))}
              </select>
            </div>

            {/* Format toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 text-[11px] sm:text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormat("A4")}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition ${format === "A4" ? "bg-white text-[#0F4C5C] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                A4 Invoice
              </button>
              <button
                type="button"
                onClick={() => setFormat("Thermal80")}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition ${format === "Thermal80" ? "bg-white text-[#0F4C5C] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                Thermal 80mm
              </button>
              <button
                type="button"
                onClick={() => setFormat("Thermal58")}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition ${format === "Thermal58" ? "bg-white text-[#0F4C5C] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                58mm
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 ml-auto sm:ml-0">
              {/* Print Button */}
              <button
                onClick={handlePrint}
                className="px-2.5 sm:px-3 py-1.5 bg-[#0F4C5C] text-white font-bold rounded-xl text-xs hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <Printer className="size-3.5" /> <span className="hidden sm:inline">Print</span>
              </button>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <Download className="size-3.5" /> <span className="hidden sm:inline">Download</span>
              </button>

              {/* Share Button */}
              <button
                onClick={handleShareNative}
                className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <Share2 className="size-3.5" /> <span className="hidden sm:inline">Share</span>
              </button>

              {/* Close Button on desktop */}
              <button
                onClick={onClose}
                className="hidden sm:grid size-8 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ml-1"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body - Live Preview inside scroll container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100/70 p-2 sm:p-4 md:p-6 flex flex-col items-center min-h-0">
          {format === "A4" ? (
            /* A4 Professional Invoice View - ONE unified white card containing all sections */
            <div className="w-full max-w-2xl bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/90 p-3.5 sm:p-6 md:p-8 text-slate-800 space-y-4 sm:space-y-6 text-xs mx-auto box-border">
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-[#0F4C5C] pb-3 sm:pb-5 gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                  <img
                    src={settings.logoUrl || "/fabric-care-logo.png"}
                    alt={settings.shopName}
                    className="h-10 sm:h-12 w-auto max-w-[140px] sm:max-w-[160px] object-contain rounded-xl bg-slate-50 p-1 border border-slate-200 shadow-2xs shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-base sm:text-xl font-black text-[#0F4C5C] tracking-tight truncate sm:whitespace-normal">
                        {settings.shopName}
                      </h2>
                      <span className="text-[10px] sm:text-[11px] font-bold bg-[#0F4C5C]/10 text-[#0F4C5C] px-2 py-0.5 rounded-md">
                        {selectedBranch.shortName}
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">{settings.tagline}</p>
                    <div className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 space-y-0.5">
                      <p className="font-semibold text-slate-700 line-clamp-2 sm:line-clamp-none">
                        {selectedBranch.address}
                      </p>
                      <p className="text-[10px] sm:text-[11px]">
                        {settings.phone && <span>Phone: <strong>{settings.phone}</strong></span>}
                        {settings.phone && settings.email && " · "}
                        {settings.email && <span>{settings.email}</span>}
                      </p>
                      {settings.gstin && <p className="text-[10px]">GSTIN: <strong>{settings.gstin}</strong></p>}
                    </div>
                  </div>
                </div>

                <div className="sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1">
                  <h1 className="text-lg sm:text-2xl font-black text-[#0F4C5C] tracking-wider">INVOICE</h1>
                  <div className="text-[10px] sm:text-[11px] text-slate-600 space-y-0.5 text-right">
                    <p><span className="text-slate-400 mr-1">No:</span><span className="font-mono font-bold text-slate-900">{normalizedOrder.id}</span></p>
                    <p><span className="text-slate-400 mr-1">Date:</span><span className="font-mono font-bold text-slate-900">{dateStr}</span></p>
                    {deliveryDateStr && (
                      <p><span className="text-slate-400 mr-1">Ready:</span><span className="font-mono font-bold text-slate-900">{deliveryDateStr}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill To & Status Section */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 gap-2.5">
                <div className="min-w-0">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">Billed To</span>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <p className="text-xs sm:text-sm font-bold text-[#0F4C5C] truncate">{normalizedOrder.customer}</p>
                    {normalizedOrder.customerId && (
                      <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded">
                        ID: {normalizedOrder.customerId}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 font-mono font-medium">{normalizedOrder.phone || "No phone registered"}</p>
                </div>
                <div className="w-full sm:w-auto flex justify-start sm:justify-end">
                  <span
                    className={`inline-block px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-extrabold tracking-wide uppercase border ${
                      isPaid
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-rose-50 text-rose-800 border-rose-300"
                    }`}
                  >
                    {isPaid ? "PAID IN FULL" : `BALANCE DUE: ${formatRupee(balanceDue)}`}
                  </span>
                </div>
              </div>

              {/* Items Table - 100% width with table-layout: fixed, wrapping text and Amount always visible */}
              <div className="w-full border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-xs table-fixed">
                  <thead>
                    <tr className="bg-[#0F4C5C] text-white text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-2 sm:py-2.5 px-1 sm:px-2 text-center" style={{ width: "7%" }}>#</th>
                      <th className="py-2 sm:py-2.5 px-1.5 sm:px-2.5" style={{ width: "24%" }}>Item / Garment</th>
                      <th className="py-2 sm:py-2.5 px-1.5 sm:px-2.5" style={{ width: "29%" }}>Service</th>
                      <th className="py-2 sm:py-2.5 px-1 sm:px-2 text-center" style={{ width: "10%" }}>Qty</th>
                      <th className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 text-right" style={{ width: "15%" }}>Rate</th>
                      <th className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 text-right" style={{ width: "15%" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.index} className="hover:bg-slate-50/50">
                        <td className="py-2 sm:py-2.5 px-1 sm:px-2 text-center text-slate-400 font-medium text-[10.5px] sm:text-xs align-middle">{it.index}</td>
                        <td className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 min-w-0 align-middle">
                          <div className="font-semibold text-slate-800 text-[11px] sm:text-xs leading-snug break-words">{it.name}</div>
                        </td>
                        <td className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 min-w-0 text-slate-500 text-[10.5px] sm:text-[11px] align-middle break-words">{it.service}</td>
                        <td className="py-2 sm:py-2.5 px-1 sm:px-2 text-center font-bold text-slate-800 text-[11px] sm:text-xs align-middle">{it.quantity}</td>
                        <td className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 text-right text-slate-600 font-mono text-[10.5px] sm:text-xs whitespace-nowrap align-middle">
                          {it.rate ? formatRupee(it.rate, false) : "—"}
                        </td>
                        <td className="py-2 sm:py-2.5 px-1.5 sm:px-2.5 text-right font-bold text-slate-900 font-mono text-[10.5px] sm:text-xs whitespace-nowrap align-middle">
                          {formatRupee(it.amount, false)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                {/* Left Side: Words & QR */}
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 sm:p-3">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Total in Words</span>
                    <p className="font-bold text-[#0F4C5C] text-[11px] sm:text-xs mt-0.5 leading-snug break-words">{totalInWords}</p>
                  </div>

                  {upiQrDataUrl && (
                    <div className="flex items-center gap-2.5 sm:gap-3 bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 sm:p-3">
                      <img src={upiQrDataUrl} alt="UPI QR Code" className="size-14 sm:size-16 bg-white p-1 rounded-lg border border-slate-200 shrink-0" />
                      <div className="text-[10px] sm:text-[11px] min-w-0">
                        <p className="font-bold text-[#0F4C5C] text-[11px] sm:text-xs">Scan to Pay via UPI</p>
                        <p className="font-mono font-bold text-slate-800 text-[10px] mt-0.5 truncate">{settings.upiId}</p>
                        <p className="text-slate-500 text-[9px] leading-tight mt-0.5">GPay, PhonePe, Paytm or any UPI App</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Totals Box */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100 text-xs shadow-2xs">
                  <div className="flex justify-between px-3 py-1.5 sm:py-2 text-slate-600 text-[11px] sm:text-xs">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-slate-800">{formatRupee(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between px-3 py-1.5 sm:py-2 text-rose-600 text-[11px] sm:text-xs">
                      <span>Discount</span>
                      <span className="font-mono font-semibold">- {formatRupee(discount)}</span>
                    </div>
                  )}
                  {settings.enableTax && settings.taxRate > 0 && (
                    <div className="flex justify-between px-3 py-1.5 sm:py-2 text-slate-600 text-[11px] sm:text-xs">
                      <span>GST / Tax ({settings.taxRate}%)</span>
                      <span className="font-mono font-semibold">{formatRupee(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-3 py-2 sm:py-2.5 bg-[#0F4C5C] text-white font-bold text-xs sm:text-sm">
                    <span>Grand Total</span>
                    <span className="font-mono">{formatRupee(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 sm:py-2 text-emerald-700 font-medium text-[11px] sm:text-xs">
                    <span>Amount Paid</span>
                    <span className="font-mono font-bold">{formatRupee(amountPaid)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2 sm:py-2.5 bg-slate-50 font-bold text-[11px] sm:text-xs">
                    <span className="text-slate-800">Balance Due</span>
                    <span className={`font-mono ${balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {balanceDue > 0 ? formatRupee(balanceDue) : "₹ 0 (Paid)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              {termsLines.length > 0 && (
                <div className="bg-slate-50/80 border border-dashed border-slate-300 rounded-xl p-2.5 sm:p-3 text-[10px] text-slate-600 space-y-1">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block">Terms & Conditions:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {termsLines.map((l, i) => (
                      <li key={i} className="break-words">{l}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between items-center text-[10px] sm:text-[11px] text-slate-500 gap-1 text-center sm:text-left">
                <span className="font-bold text-[#0F4C5C]">Thank you for choosing {settings.shopName}!</span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Powered by Mallist |{" "}
                  <a href="https://mallist.online" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    mallist.online
                  </a>
                </span>
              </div>
            </div>
          ) : (
            /* Thermal POS Receipt View (80mm / 58mm) */
            <div
              className={`bg-white rounded-xl shadow-sm border border-slate-300 p-3.5 sm:p-4 font-mono text-black text-xs space-y-3 mx-auto box-border ${
                format === "Thermal58" ? "w-full max-w-[280px]" : "w-full max-w-[340px]"
              }`}
            >
              <div className="text-center space-y-0.5">
                <p className="font-extrabold text-sm">{settings.shopName} ({selectedBranch.shortName})</p>
                <p className="text-[10px] uppercase text-slate-600">{settings.tagline}</p>
                <p className="text-[10px] text-slate-800 font-bold">{selectedBranch.address}</p>
                {settings.phone && <p className="text-[10px] text-slate-600">Tel: {settings.phone}</p>}
                {settings.gstin && <p className="text-[10px] text-slate-600">GSTIN: {settings.gstin}</p>}
              </div>

              <div className="border-t-2 border-black" />

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span>Bill No:</span><span className="font-bold">{normalizedOrder.id}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{dateStr}</span></div>
                {deliveryDateStr && <div className="flex justify-between"><span>Ready:</span><span>{deliveryDateStr}</span></div>}
                <div className="flex justify-between"><span>Customer:</span><span className="font-bold">{normalizedOrder.customer}</span></div>
                {normalizedOrder.customerId && (
                  <div className="flex justify-between"><span>Customer ID:</span><span className="font-mono font-bold">{normalizedOrder.customerId}</span></div>
                )}
                <div className="flex justify-between"><span>Phone:</span><span>{normalizedOrder.phone || "—"}</span></div>
              </div>

              <div className="border-t border-dashed border-black" />

              <div className="space-y-1.5 text-[11px]">
                <span className="font-bold block">ITEMS & SERVICES:</span>
                {items.map((it) => (
                  <div key={it.index} className="space-y-0.5">
                    <div className="font-semibold">{it.index}. {it.name} ({it.service})</div>
                    <div className="flex justify-between text-[10px] pl-2">
                      <span>{it.quantity} x {formatRupee(it.rate, false)}</span>
                      <span className="font-bold">{formatRupee(it.amount, false)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black" />

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatRupee(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-rose-600"><span>Discount:</span><span>- {formatRupee(discount)}</span></div>}
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                  <span>TOTAL:</span><span>{formatRupee(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-700"><span>Paid:</span><span>{formatRupee(amountPaid)}</span></div>
                <div className="flex justify-between font-bold">
                  <span>BALANCE:</span><span>{balanceDue > 0 ? formatRupee(balanceDue) : "PAID (₹ 0)"}</span>
                </div>
              </div>

              <div className="border-2 border-black p-1 text-center font-bold text-xs">
                {isPaid ? "*** PAID IN FULL ***" : `*** BALANCE DUE: ${formatRupee(balanceDue)} ***`}
              </div>

              {termsLines.length > 0 && (
                <div className="border-t border-dashed border-black pt-1 text-[9px] text-center space-y-0.5">
                  {termsLines.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              )}

              <div className="border-t-2 border-black pt-2 text-center text-[10px] space-y-1">
                <p className="font-bold">Thank you for choosing {settings.shopName}!</p>
                <p className="text-[9px] text-slate-500">
                  Powered by Mallist | mallist.online
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onSendSms && (
              <button
                onClick={onSendSms}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95"
              >
                <MessageSquare className="size-3.5 text-[#0F4C5C]" /> Send SMS
              </button>
            )}
            <button
              onClick={() => setShowShareMenu(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Share2 className="size-3.5 text-[#0F4C5C]" /> More Share Options
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canDelete && onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs hover:bg-rose-100 transition active:scale-95"
              >
                Delete Bill
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#0F4C5C] text-white font-bold rounded-xl text-xs hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="size-3.5" /> Print Bill
            </button>
          </div>
        </div>
      </div>

      {/* Share Sub-Modal */}
      {showShareMenu && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F4C5C]">Share Invoice & Receipt</h3>
                <p className="text-[11px] text-slate-500">Bill {normalizedOrder.id}</p>
              </div>
              <button
                onClick={() => setShowShareMenu(false)}
                className="size-7 grid place-items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleWhatsApp}
                className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 text-xs font-bold transition flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-emerald-600" /> Share on WhatsApp
                </span>
                <ExternalLink className="size-3.5 text-emerald-600" />
              </button>

              <button
                onClick={handleCopyText}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Copy className="size-4 text-[#0F4C5C]" /> Copy Receipt Text
                </span>
                <Check className="size-3.5 text-slate-400" />
              </button>

              <button
                onClick={handleSms}
                className="w-full p-3 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100/70 text-sky-800 text-xs font-bold transition flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Send className="size-4 text-sky-600" /> Send via SMS
                </span>
                <ExternalLink className="size-3.5 text-sky-600" />
              </button>
            </div>

            <button
              onClick={() => setShowShareMenu(false)}
              className="w-full py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
