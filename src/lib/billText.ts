/**
 * Shared utility for building clean bill text, SMS links, and WhatsApp sharing.
 */

export interface BillOrder {
  id: string;
  createdAt: string;
  customer: string;
  phone: string;
  items: string;
  serviceType?: string;
  totalAmount: number;
  amountPaid: number;
  status: string;
  structuredItems?: { name: string; quantity: number; price?: number }[];
}

/**
 * Builds the standardized plain text receipt for SMS, WhatsApp, and Web Share.
 */
export function buildBillText(order: BillOrder): string {
  const dateStr = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(order.createdAt || Date.now()));

  const dueAmount = Math.max(0, (order.totalAmount || 0) - (order.amountPaid || 0));
  
  let itemCount = 0;
  if (order.structuredItems && order.structuredItems.length > 0) {
    itemCount = order.structuredItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  } else if (order.items) {
    itemCount = order.items.split(",").length;
  } else {
    itemCount = 1;
  }

  const serviceType = order.serviceType || "Standard Laundry";

  return [
    "Fabric Care - You wear, we care",
    `Bill: ${order.id}`,
    `Date: ${dateStr}`,
    `Customer: ${order.customer}`,
    `Items: ${itemCount} items - ${serviceType}`,
    `Total: ₹${order.totalAmount}`,
    `Paid: ₹${order.amountPaid}`,
    `Balance: ₹${dueAmount}`,
    `Status: ${order.status}`,
    "Thank you!",
  ].join("\n");
}

/**
 * Generates an OS-compatible sms: URL.
 * Works on iOS (&body=) and Android/Desktop (?body=).
 */
export function getSmsUri(phone: string, body: string): string {
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, "") : "";
  const encodedBody = encodeURIComponent(body);
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const separator = isIOS ? "&" : "?";
  return `sms:${cleanPhone}${separator}body=${encodedBody}`;
}

/**
 * Generates a WhatsApp wa.me URL.
 */
export function getWhatsAppUri(phone: string, body: string): string {
  let cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  // If 10-digit Indian phone without country code, add 91
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }
  const encoded = encodeURIComponent(body);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
