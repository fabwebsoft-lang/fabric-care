import { InvoiceSettings, getInvoiceSettings } from "./invoiceSettings";
import { numberToIndianWords } from "./numberToWords";
import { generateQrSvg } from "./qrcode";

export type PaperSize = "A4" | "Thermal80" | "Thermal58";

export interface InvoiceOrderData {
  id: string;
  createdAt: string | Date;
  dueAt?: string | Date | null;
  due?: string;
  customer: string;
  phone: string;
  customerType?: string;
  serviceType?: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  discount?: number;
  items?: string;
  structuredItems?: { name: string; quantity: number; price?: number; service?: string }[];
}

/**
 * Sanitizes and escapes raw strings for safe HTML injection to prevent XSS.
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats a Date object or ISO string into DD-MM-YYYY in Asia/Kolkata (IST).
 */
export function formatISTDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

/**
 * Formats rupee currency string: e.g. ₹ 1,250.00 or ₹ 400
 */
export function formatRupee(amount: number, showDecimals = true): string {
  const num = Number(amount) || 0;
  if (showDecimals && num % 1 !== 0) {
    return `₹ ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹ ${num.toLocaleString("en-IN")}`;
}

/**
 * Normalizes order items list for table rendering
 */
export function getOrderItemsList(order: InvoiceOrderData) {
  if (order.structuredItems && order.structuredItems.length > 0) {
    return order.structuredItems.map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.price) || 0;
      const amount = qty * rate;
      return {
        index: idx + 1,
        name: item.name || "Laundry Item",
        service: item.service || order.serviceType || "Standard Laundry",
        quantity: qty,
        rate,
        amount,
      };
    });
  }

  // Fallback parsing from items string
  if (order.items) {
    const rawParts = order.items.split(/[·,]/).map((s) => s.trim()).filter(Boolean);
    const parsedItems: { index: number; name: string; service: string; quantity: number; rate: number; amount: number }[] = [];

    // Check if it's formatted like "3 items · Standard Laundry" or item names
    let runningIdx = 1;
    for (const part of rawParts) {
      if (/^\d+\s+items/i.test(part)) continue;
      parsedItems.push({
        index: runningIdx++,
        name: part,
        service: order.serviceType || "Standard Laundry",
        quantity: 1,
        rate: order.totalAmount / Math.max(1, rawParts.length),
        amount: order.totalAmount / Math.max(1, rawParts.length),
      });
    }

    if (parsedItems.length > 0) return parsedItems;
  }

  return [
    {
      index: 1,
      name: order.serviceType || "Laundry & Dry Cleaning Service",
      service: order.serviceType || "Standard Laundry",
      quantity: 1,
      rate: order.totalAmount,
      amount: order.totalAmount,
    },
  ];
}

/**
 * Generates the professional A4 Invoice HTML string
 */
export function generateA4InvoiceHtml(order: InvoiceOrderData, settings: InvoiceSettings = getInvoiceSettings()): string {
  const items = getOrderItemsList(order);
  const dateStr = formatISTDate(order.createdAt);
  const deliveryDateStr = order.dueAt ? formatISTDate(order.dueAt) : order.due && order.due !== "—" ? order.due : "";

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0) || order.totalAmount;
  const discount = Number(order.discount) || 0;
  const taxableBase = Math.max(0, subtotal - discount);

  let taxAmount = 0;
  if (settings.enableTax && settings.taxRate > 0) {
    taxAmount = Math.round((taxableBase * settings.taxRate) / 100);
  }

  const grandTotal = settings.enableTax ? taxableBase + taxAmount : order.totalAmount;
  const amountPaid = Number(order.amountPaid) || 0;
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const isPaid = balanceDue <= 0;

  const totalInWords = numberToIndianWords(grandTotal);

  // UPI QR Code (if UPI ID is set)
  let upiQrSvg = "";
  if (settings.upiId && settings.upiId.trim()) {
    const payAmount = balanceDue > 0 ? balanceDue : grandTotal;
    const upiUri = `upi://pay?pa=${encodeURIComponent(settings.upiId.trim())}&pn=${encodeURIComponent(settings.shopName)}&am=${payAmount}&cu=INR&tn=${encodeURIComponent(`Bill ${order.id}`)}`;
    upiQrSvg = generateQrSvg(upiUri, 100);
  }

  const termsLines = (settings.terms || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${order.id} - ${settings.shopName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      max-width: 100%;
    }
    html, body {
      width: 210mm;
      margin: 0 auto;
      padding: 0;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-page {
      width: 210mm;
      min-height: 297mm;
      max-width: 210mm;
      margin: 15px auto;
      background: #ffffff;
      padding: 12mm 14mm;
      box-sizing: border-box;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }
      html, body {
        width: 210mm;
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .invoice-page {
        width: 210mm;
        min-height: 297mm;
        max-width: 210mm;
        margin: 0 auto;
        padding: 12mm 14mm;
        box-sizing: border-box;
        overflow: hidden;
        border: none;
        box-shadow: none;
        border-radius: 0;
      }
    }

    /* Header */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F4C5C;
      padding-bottom: 14px;
      margin-bottom: 18px;
      gap: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .shop-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .shop-logo {
      height: 48px;
      width: auto;
      max-width: 140px;
      object-fit: contain;
      border-radius: 10px;
      background: #ffffff;
      padding: 3px;
      border: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .shop-details {
      min-width: 0;
    }
    .shop-details h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0F4C5C;
      letter-spacing: -0.02em;
      margin-bottom: 2px;
      word-break: break-word;
    }
    .shop-tagline {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .shop-meta {
      font-size: 10.5px;
      color: #475569;
      line-height: 1.35;
      word-break: break-word;
    }

    .invoice-title-block {
      text-align: right;
      flex-shrink: 0;
      min-width: 0;
      max-width: 45%;
    }
    .invoice-badge {
      font-size: 24px;
      font-weight: 900;
      color: #0F4C5C;
      letter-spacing: 0.05em;
      line-height: 1;
      margin-bottom: 6px;
    }
    .invoice-meta-table {
      margin-left: auto;
      font-size: 11px;
      border-collapse: collapse;
      table-layout: auto;
    }
    .invoice-meta-table td {
      padding: 1.5px 0 1.5px 8px;
      text-align: right;
      word-break: break-word;
    }
    .invoice-meta-table .label {
      color: #64748b;
      font-weight: 500;
      white-space: nowrap;
    }
    .invoice-meta-table .val {
      font-weight: 700;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    /* Bill To Section */
    .bill-to-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #F8FAFC;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 18px;
      gap: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .bill-to-left {
      min-width: 0;
      flex: 1;
    }
    .bill-to-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
      margin-bottom: 2px;
    }
    .customer-name {
      font-size: 14px;
      font-weight: 700;
      color: #0F4C5C;
      word-break: break-word;
    }
    .customer-phone {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-top: 1px;
      word-break: break-all;
    }

    /* Status Stamp */
    .status-stamp {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-width: 1.5px;
      border-style: solid;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .stamp-paid {
      background: #ecfdf5;
      color: #065f46;
      border-color: #10b981;
    }
    .stamp-due {
      background: #fff1f2;
      color: #9f1239;
      border-color: #f43f5e;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 11.5px;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .items-table thead th {
      background: #0F4C5C;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      padding: 8px 6px;
      text-align: left;
      overflow-wrap: break-word;
    }
    .items-table thead th.text-center { text-align: center; }
    .items-table thead th.text-right { text-align: right; }
    .items-table thead th:first-child { border-top-left-radius: 6px; }
    .items-table thead th:last-child { border-top-right-radius: 6px; }

    .items-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .items-table tbody tr:nth-child(even) {
      background: #fafafa;
    }
    .items-table tbody td {
      padding: 8px 6px;
      color: #1e293b;
      vertical-align: middle;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .items-table tbody td.text-center { text-align: center; }
    .items-table tbody td.text-right { text-align: right; }
    .items-table .item-name {
      font-weight: 600;
      color: #0f172a;
      display: block;
      word-break: break-word;
    }
    .items-table .service-tag {
      font-size: 10px;
      color: #64748b;
      display: block;
      word-break: break-word;
    }

    /* Summary & Totals Layout */
    .summary-section {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .summary-left {
      flex: 1.2;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
    }
    .amount-in-words {
      background: #F8FAFC;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 10.5px;
    }
    .amount-in-words-label {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 2px;
    }
    .amount-in-words-text {
      font-weight: 700;
      color: #0F4C5C;
      word-break: break-word;
      line-height: 1.35;
    }

    .upi-block {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #F8FAFC;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .upi-qr {
      width: 68px;
      height: 68px;
      flex-shrink: 0;
      background: #ffffff;
      padding: 3px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .upi-qr svg {
      width: 100%;
      height: 100%;
    }
    .upi-info {
      font-size: 10.5px;
      min-width: 0;
    }
    .upi-title {
      font-size: 11px;
      font-weight: 800;
      color: #0F4C5C;
      margin-bottom: 2px;
    }
    .upi-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      color: #0f172a;
      font-size: 10.5px;
      word-break: break-all;
    }
    .upi-hint {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 2px;
    }

    .summary-right {
      flex: 1;
      min-width: 0;
      max-width: 280px;
    }
    .totals-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 11px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .totals-table td {
      padding: 5.5px 10px;
      border-bottom: 1px solid #f1f5f9;
      word-break: break-word;
    }
    .totals-table td.label {
      width: 55%;
      color: #64748b;
      font-weight: 500;
    }
    .totals-table td.value {
      width: 45%;
      text-align: right;
      font-weight: 600;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: nowrap;
    }
    .totals-table tr.grand-total {
      background: #0F4C5C;
    }
    .totals-table tr.grand-total td {
      color: #ffffff;
      font-size: 12.5px;
      font-weight: 800;
      padding: 7px 10px;
      border-bottom: none;
    }
    .totals-table tr.grand-total td.label {
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .totals-table tr.balance-row {
      background: #F8FAFC;
    }
    .totals-table tr.balance-row td.value {
      font-size: 11.5px;
      font-weight: 800;
    }
    .text-emerald { color: #059669 !important; }
    .text-rose { color: #e11d48 !important; }

    /* Terms & Conditions */
    .terms-card {
      margin-top: 16px;
      padding: 10px 12px;
      background: #F8FAFC;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      font-size: 10px;
      color: #475569;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .terms-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .terms-list {
      list-style: none;
      line-height: 1.45;
    }
    .terms-list li {
      margin-bottom: 2px;
      word-break: break-word;
    }

    /* Footer */
    .invoice-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #64748b;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer-thankyou {
      font-weight: 700;
      color: #0F4C5C;
    }
    .footer-watermark {
      font-size: 9.5px;
      color: #94a3b8;
      font-weight: 500;
    }
    .footer-watermark a {
      color: #94a3b8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="invoice-page">
    <!-- Header Row -->
    <div class="header-row">
      <div class="shop-brand">
        <img src="${escapeHtml(settings.logoUrl) || "/fabric-care-logo.png"}" alt="${escapeHtml(settings.shopName)}" class="shop-logo" />
        <div class="shop-details">
          <h1>${escapeHtml(settings.shopName)}</h1>
          <div class="shop-tagline">${escapeHtml(settings.tagline)}</div>
          <div class="shop-meta">
            ${settings.address ? `<div>${escapeHtml(settings.address)}</div>` : ""}
            <div>
              ${settings.phone ? `Phone: <strong>${escapeHtml(settings.phone)}</strong>` : ""}
              ${settings.phone && settings.email ? " · " : ""}
              ${settings.email ? `Email: ${escapeHtml(settings.email)}` : ""}
            </div>
            ${settings.gstin ? `<div>GSTIN: <strong>${escapeHtml(settings.gstin)}</strong></div>` : ""}
          </div>
        </div>
      </div>

      <div class="invoice-title-block">
        <div class="invoice-badge">INVOICE</div>
        <table class="invoice-meta-table">
          <tr>
            <td class="label">Invoice No:</td>
            <td class="val">${escapeHtml(order.id)}</td>
          </tr>
          <tr>
            <td class="label">Bill Date:</td>
            <td class="val">${escapeHtml(dateStr)}</td>
          </tr>
          ${
            deliveryDateStr
              ? `<tr>
            <td class="label">Expected Ready:</td>
            <td class="val">${escapeHtml(deliveryDateStr)}</td>
          </tr>`
              : ""
          }
        </table>
      </div>
    </div>

    <!-- Bill To Section -->
    <div class="bill-to-row">
      <div class="bill-to-left">
        <div class="bill-to-title">Billed To</div>
        <div class="customer-name">${escapeHtml(order.customer)}</div>
        <div class="customer-phone">${escapeHtml(order.phone) || "No phone registered"}</div>
      </div>
      <div>
        <span class="status-stamp ${isPaid ? "stamp-paid" : "stamp-due"}">
          ${isPaid ? "PAID IN FULL" : `BALANCE DUE: ${formatRupee(balanceDue)}`}
        </span>
      </div>
    </div>

    <!-- Items Table: 7%, 24%, 29%, 10%, 15%, 15% -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 7%;" class="text-center">#</th>
          <th style="width: 24%;">ITEM / GARMENT</th>
          <th style="width: 29%;">SERVICE</th>
          <th style="width: 10%;" class="text-center">QTY</th>
          <th style="width: 15%;" class="text-right">RATE</th>
          <th style="width: 15%;" class="text-right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `<tr>
          <td class="text-center" style="color: #64748b; font-weight: 600;">${item.index}</td>
          <td><span class="item-name">${escapeHtml(item.name)}</span></td>
          <td><span class="service-tag">${escapeHtml(item.service)}</span></td>
          <td class="text-center" style="font-weight: 700;">${item.quantity}</td>
          <td class="text-right" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap;">${item.rate ? formatRupee(item.rate, false) : "—"}</td>
          <td class="text-right" style="font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap;">${formatRupee(item.amount, false)}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <!-- Totals & Payment Summary -->
    <div class="summary-section">
      <div class="summary-left">
        <!-- Amount in Words -->
        <div class="amount-in-words">
          <div class="amount-in-words-label">Total Amount in Words</div>
          <div class="amount-in-words-text">${escapeHtml(totalInWords)}</div>
        </div>

        <!-- UPI QR Code -->
        ${
          upiQrSvg
            ? `<div class="upi-block">
          <div class="upi-qr">${upiQrSvg}</div>
          <div class="upi-info">
            <div class="upi-title">Scan to Pay via UPI</div>
            <div class="upi-id">${escapeHtml(settings.upiId)}</div>
            <div class="upi-hint">Scan with GPay, PhonePe, Paytm or any UPI App</div>
          </div>
        </div>`
            : ""
        }
      </div>

      <div class="summary-right">
        <table class="totals-table">
          <tr>
            <td class="label">Subtotal</td>
            <td class="value">${formatRupee(subtotal)}</td>
          </tr>
          ${
            discount > 0
              ? `<tr>
            <td class="label">Discount</td>
            <td class="value text-rose">- ${formatRupee(discount)}</td>
          </tr>`
              : ""
          }
          ${
            settings.enableTax && settings.taxRate > 0
              ? `<tr>
            <td class="label">GST / Tax (${settings.taxRate}%)</td>
            <td class="value">${formatRupee(taxAmount)}</td>
          </tr>`
              : ""
          }
          <tr class="grand-total">
            <td class="label">Grand Total</td>
            <td class="value" style="color:#ffffff;">${formatRupee(grandTotal)}</td>
          </tr>
          <tr>
            <td class="label">Amount Paid</td>
            <td class="value text-emerald">${formatRupee(amountPaid)}</td>
          </tr>
          <tr class="balance-row">
            <td class="label" style="font-weight:700; color:#0f172a;">Balance Due</td>
            <td class="value ${balanceDue > 0 ? "text-rose" : "text-emerald"}">
              ${balanceDue > 0 ? formatRupee(balanceDue) : "₹ 0 (Paid)"}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Terms and Notes -->
    ${
      termsLines.length > 0
        ? `<div class="terms-card">
      <div class="terms-title">Terms & Conditions</div>
      <ul class="terms-list">
        ${termsLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
    </div>`
        : ""
    }

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="footer-thankyou">Thank you for choosing ${escapeHtml(settings.shopName)}!</div>
      <div class="footer-watermark">
        Powered by Mallist | <a href="https://mallist.online" target="_blank" rel="noopener noreferrer">mallist.online</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates the compact POS Thermal Receipt HTML string (80mm or 58mm)
 */
export function generateThermalReceiptHtml(
  order: InvoiceOrderData,
  size: "80mm" | "58mm" = "80mm",
  settings: InvoiceSettings = getInvoiceSettings()
): string {
  const items = getOrderItemsList(order);
  const dateStr = formatISTDate(order.createdAt);
  const deliveryDateStr = order.dueAt ? formatISTDate(order.dueAt) : order.due && order.due !== "—" ? order.due : "";

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0) || order.totalAmount;
  const discount = Number(order.discount) || 0;
  const grandTotal = order.totalAmount;
  const amountPaid = Number(order.amountPaid) || 0;
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const isPaid = balanceDue <= 0;

  const widthMm = size === "58mm" ? "58mm" : "80mm";
  const charWidth = size === "58mm" ? "280px" : "340px";

  const termsLines = (settings.terms || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${order.id}</title>
  <style>
    @page {
      size: ${widthMm} auto;
      margin: 2mm 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: ui-monospace, SFMono-Regular, "Courier New", monospace;
      color: #000000;
      background: #ffffff;
      font-size: ${size === "58mm" ? "11px" : "12px"};
      line-height: 1.3;
      padding: 6px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .thermal-container {
      width: 100%;
      max-width: ${charWidth};
      margin: 0 auto;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .title { font-size: ${size === "58mm" ? "14px" : "16px"}; font-weight: 800; }
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .double-divider {
      border-top: 2px solid #000000;
      margin: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    .status-box {
      border: 1.5px solid #000000;
      padding: 4px;
      margin: 6px 0;
      text-align: center;
      font-weight: bold;
    }
    .item-row {
      margin: 4px 0;
    }
    .item-name {
      font-weight: bold;
    }
    .item-calc {
      display: flex;
      justify-content: space-between;
      font-size: ${size === "58mm" ? "10px" : "11px"};
      padding-left: 6px;
    }
    .footer-note {
      font-size: 10px;
      margin-top: 6px;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="thermal-container">
    <div class="center">
      <div class="title bold">${escapeHtml(settings.shopName)}</div>
      <div>${escapeHtml(settings.tagline)}</div>
      ${settings.address ? `<div>${escapeHtml(settings.address)}</div>` : ""}
      ${settings.phone ? `<div>Tel: ${escapeHtml(settings.phone)}</div>` : ""}
      ${settings.gstin ? `<div>GSTIN: ${escapeHtml(settings.gstin)}</div>` : ""}
    </div>

    <div class="double-divider"></div>

    <div class="row"><span>Bill No:</span><span class="bold">${escapeHtml(order.id)}</span></div>
    <div class="row"><span>Date:</span><span>${escapeHtml(dateStr)}</span></div>
    ${deliveryDateStr ? `<div class="row"><span>Ready Date:</span><span>${escapeHtml(deliveryDateStr)}</span></div>` : ""}
    <div class="row"><span>Customer:</span><span class="bold">${escapeHtml(order.customer)}</span></div>
    <div class="row"><span>Phone:</span><span>${escapeHtml(order.phone) || "—"}</span></div>

    <div class="divider"></div>

    <div class="bold" style="margin-bottom: 4px;">ITEMS & SERVICES:</div>
    ${items
      .map(
        (it) => `<div class="item-row">
      <div class="item-name">${it.index}. ${escapeHtml(it.name)} (${escapeHtml(it.service)})</div>
      <div class="item-calc">
        <span>${it.quantity} Qty x ${formatRupee(it.rate, false)}</span>
        <span class="bold">${formatRupee(it.amount, false)}</span>
      </div>
    </div>`
      )
      .join("")}

    <div class="divider"></div>

    <div class="row"><span>Subtotal:</span><span>${formatRupee(subtotal)}</span></div>
    ${discount > 0 ? `<div class="row"><span>Discount:</span><span>- ${formatRupee(discount)}</span></div>` : ""}
    <div class="row bold" style="font-size: 13px;"><span>TOTAL AMOUNT:</span><span>${formatRupee(grandTotal)}</span></div>
    <div class="row"><span>Amount Paid:</span><span>${formatRupee(amountPaid)}</span></div>
    <div class="row bold"><span>BALANCE DUE:</span><span>${balanceDue > 0 ? formatRupee(balanceDue) : "PAID (₹ 0)"}</span></div>

    <div class="status-box">
      ${isPaid ? "*** PAID IN FULL ***" : `*** BALANCE DUE: ${formatRupee(balanceDue)} ***`}
    </div>

    ${
      termsLines.length > 0
        ? `<div class="divider"></div>
    <div class="footer-note">
      ${termsLines.map((l) => `<div>${escapeHtml(l)}</div>`).join("")}
    </div>`
        : ""
    }

    <div class="double-divider"></div>

    <div class="center" style="font-size: 11px; margin-top: 4px;">
      <div class="bold">Thank you for choosing ${escapeHtml(settings.shopName)}!</div>
      <div style="margin-top: 3px; font-size: 9.5px; color: #555;">
        Powered by Mallist | mallist.online
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers native browser print with the formatted invoice
 */
export function printInvoice(
  order: InvoiceOrderData,
  size: PaperSize = "A4",
  settings: InvoiceSettings = getInvoiceSettings()
) {
  const html =
    size === "A4"
      ? generateA4InvoiceHtml(order, settings)
      : generateThermalReceiptHtml(order, size === "Thermal58" ? "58mm" : "80mm", settings);

  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (!printWindow) {
    alert("Please allow popups to print invoice.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Trigger print after resources load
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };
}

/**
 * Triggers download of the standalone HTML receipt/invoice
 */
export function downloadInvoiceHtml(
  order: InvoiceOrderData,
  size: PaperSize = "A4",
  settings: InvoiceSettings = getInvoiceSettings()
) {
  const html =
    size === "A4"
      ? generateA4InvoiceHtml(order, settings)
      : generateThermalReceiptHtml(order, size === "Thermal58" ? "58mm" : "80mm", settings);

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename =
    size === "A4"
      ? `fabric-care-invoice-${order.id.toLowerCase()}.html`
      : `fabric-care-receipt-${order.id.toLowerCase()}-${size.toLowerCase()}.html`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
