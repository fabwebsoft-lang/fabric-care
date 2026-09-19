/**
 * Client-side phone normalization utility for Fabric Care.
 * Handles Indian 10-digit mobile formats, +91 prefixes, spaces, hyphens, and leading zeros.
 */

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";

  let cleaned = raw.trim().replace(/[\s\-().+]/g, "");

  // Handle Indian country code: 91XXXXXXXXXX (12 digits) -> XXXXXXXXXX (10 digits)
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // Handle leading zero: 0XXXXXXXXXX (11 digits) -> XXXXXXXXXX (10 digits)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const normalized = normalizePhone(raw);
  if (normalized.length === 10) {
    return `${normalized.slice(0, 5)} ${normalized.slice(5)}`;
  }
  return raw.trim();
}
