import React, { useState } from "react";
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

  // Normalize order data
  const normalizedOrder: InvoiceOrderData = {
    id: order.id,
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F4C5C]/50 backdrop-blur-sm p-2 sm:p-4 md:p-6 flex justify-center items-center min-h-screen">
      <div className="relative w-full max-w-4xl bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[95vh] overflow-hidden my-auto">
        {/* Modal Top Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[#0F4C5C] text-white flex items-center justify-center font-bold text-xs">
              <FileText className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#0F4C5C]">{normalizedOrder.id}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isPaid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  {isPaid ? "PAID" : `DUE ${formatRupee(balanceDue)}`}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700">{normalizedOrder.customer}</p>
            </div>
          </div>

          {/* Format Switcher & Actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Format toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormat("A4")}
                className={`px-2.5 py-1 rounded-lg transition ${format === "A4" ? "bg-white text-[#0F4C5C] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                A4 Invoice
              </button>
              <button
                type="button"
                onClick={() => setFormat("Thermal80")}
                className={`px-2.5 py-1 rounded-lg transition ${format === "Thermal80" ? "bg-white text-[#0F4C5C] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                Thermal 80mm
              </button>
              <button
                type="button"
                onClick={() => setFormat("Thermal58")}
                className={`px-2.5 py-1 rounded-lg transition ${format === "Thermal58" ? "bg-white text-[#0F4C5C] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                58mm
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#0F4C5C] text-white font-bold rounded-xl text-xs hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center gap-1.5"
            >
              <Printer className="size-3.5" /> Print
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
            >
              <Download className="size-3.5" /> Download
            </button>

            {/* Share Button */}
            <div className="relative">
              <button
                onClick={handleShareNative}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
              >
                <Share2 className="size-3.5" /> Share
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="size-8 grid place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ml-1"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body - Live Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
          {format === "A4" ? (
            /* A4 Professional Invoice View */
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-slate-200 p-6 sm:p-8 text-slate-800 space-y-6 text-xs transition-all">
              {/* Header Row */}
              <div className="flex justify-between items-start border-b-2 border-[#0F4C5C] pb-5 gap-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={settings.logoUrl || "/fabric-care-logo.png"}
                    alt={settings.shopName}
                    className="size-12 object-contain rounded-xl bg-white p-1 border border-slate-200 shadow-xs"
                  />
                  <div>
                    <h2 className="text-xl font-black text-[#0F4C5C] tracking-tight">{settings.shopName}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{settings.tagline}</p>
                    <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                      {settings.address && <p>{settings.address}</p>}
                      <p>
                        {settings.phone && <span>Phone: <strong>{settings.phone}</strong></span>}
                        {settings.phone && settings.email && " · "}
                        {settings.email && <span>{settings.email}</span>}
                      </p>
                      {settings.gstin && <p>GSTIN: <strong>{settings.gstin}</strong></p>}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <h1 className="text-2xl font-black text-[#0F4C5C] tracking-wider">INVOICE</h1>
                  <table className="text-[11px] text-right ml-auto mt-1">
                    <tbody>
                      <tr>
                        <td className="text-slate-500 pr-2 font-medium">Invoice No:</td>
                        <td className="font-mono font-bold text-slate-900">{normalizedOrder.id}</td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 pr-2 font-medium">Date:</td>
                        <td className="font-mono font-bold text-slate-900">{dateStr}</td>
                      </tr>
                      {deliveryDateStr && (
                        <tr>
                          <td className="text-slate-500 pr-2 font-medium">Expected Ready:</td>
                          <td className="font-mono font-bold text-slate-900">{deliveryDateStr}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill To & Status Section */}
              <div className="flex justify-between items-center bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Billed To</span>
                  <p className="text-sm font-bold text-[#0F4C5C] mt-0.5">{normalizedOrder.customer}</p>
                  <p className="text-xs text-slate-600 font-mono font-medium">{normalizedOrder.phone || "No phone registered"}</p>
                </div>
                <div>
                  <span
                    className={`inline-block px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide uppercase border ${
                      isPaid
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-rose-50 text-rose-800 border-rose-300"
                    }`}
                  >
                    {isPaid ? "PAID IN FULL" : `BALANCE DUE: ${formatRupee(balanceDue)}`}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0F4C5C] text-white text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Item / Garment</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-3 text-center w-14">Qty</th>
                      <th className="py-2.5 px-3 text-right w-20">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right w-24">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.index} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{it.index}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{it.name}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{it.service}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                          {it.rate ? formatRupee(it.rate, false).replace("₹ ", "") : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatRupee(it.amount, false).replace("₹ ", "")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Left Side: Words & QR */}
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Total in Words</span>
                    <p className="font-bold text-[#0F4C5C] text-xs mt-0.5 leading-snug">{totalInWords}</p>
                  </div>

                  {upiQrDataUrl && (
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                      <img src={upiQrDataUrl} alt="UPI QR Code" className="size-16 bg-white p-1 rounded-lg border border-slate-200" />
                      <div className="text-[11px]">
                        <p className="font-bold text-[#0F4C5C] text-xs">Scan to Pay via UPI</p>
                        <p className="font-mono font-bold text-slate-800 text-[10px] mt-0.5">{settings.upiId}</p>
                        <p className="text-slate-500 text-[9px]">GPay, PhonePe, Paytm or any UPI App</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Totals Box */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between px-3.5 py-2 text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-slate-800">{formatRupee(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between px-3.5 py-2 text-rose-600">
                      <span>Discount</span>
                      <span className="font-mono font-semibold">- {formatRupee(discount)}</span>
                    </div>
                  )}
                  {settings.enableTax && settings.taxRate > 0 && (
                    <div className="flex justify-between px-3.5 py-2 text-slate-600">
                      <span>GST / Tax ({settings.taxRate}%)</span>
                      <span className="font-mono font-semibold">{formatRupee(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-3.5 py-2.5 bg-[#0F4C5C] text-white font-bold text-sm">
                    <span>Grand Total</span>
                    <span className="font-mono">{formatRupee(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between px-3.5 py-2 text-emerald-700 font-medium">
                    <span>Amount Paid</span>
                    <span className="font-mono font-bold">{formatRupee(amountPaid)}</span>
                  </div>
                  <div className="flex justify-between px-3.5 py-2 bg-slate-50 font-bold">
                    <span className="text-slate-800">Balance Due</span>
                    <span className={`font-mono ${balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {balanceDue > 0 ? formatRupee(balanceDue) : "₹ 0 (Paid)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              {termsLines.length > 0 && (
                <div className="bg-slate-50/80 border border-dashed border-slate-300 rounded-xl p-3 text-[10px] text-slate-600 space-y-1">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block">Terms & Conditions:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {termsLines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 gap-1">
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
              className={`bg-white rounded-lg shadow-md border border-slate-300 p-4 font-mono text-black text-xs space-y-3 ${
                format === "Thermal58" ? "max-w-[280px]" : "max-w-[340px]"
              }`}
            >
              <div className="text-center space-y-0.5">
                <p className="font-extrabold text-sm">{settings.shopName}</p>
                <p className="text-[10px] uppercase text-slate-600">{settings.tagline}</p>
                {settings.address && <p className="text-[10px] text-slate-600">{settings.address}</p>}
                {settings.phone && <p className="text-[10px] text-slate-600">Tel: {settings.phone}</p>}
                {settings.gstin && <p className="text-[10px] text-slate-600">GSTIN: {settings.gstin}</p>}
              </div>

              <div className="border-t-2 border-black" />

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span>Bill No:</span><span className="font-bold">{normalizedOrder.id}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{dateStr}</span></div>
                {deliveryDateStr && <div className="flex justify-between"><span>Ready:</span><span>{deliveryDateStr}</span></div>}
                <div className="flex justify-between"><span>Customer:</span><span className="font-bold">{normalizedOrder.customer}</span></div>
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
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <MessageSquare className="size-3.5 text-[#0F4C5C]" /> Send SMS
              </button>
            )}
            <button
              onClick={() => setShowShareMenu(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <Share2 className="size-3.5 text-[#0F4C5C]" /> More Share Options
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canDelete && onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs hover:bg-rose-100 transition"
              >
                Delete Bill
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#0F4C5C] text-white font-bold rounded-xl text-xs hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center gap-1.5"
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
