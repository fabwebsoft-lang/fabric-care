import { useState, useEffect } from "react";

export interface InvoiceSettings {
  shopName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  upiId: string;
  logoUrl: string;
  terms: string;
  enableTax: boolean;
  taxRate: number; // in percent e.g. 5, 18
  defaultPaperSize: "A4" | "Thermal80" | "Thermal58";
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  shopName: "Fabric Care",
  tagline: "You wear, we care",
  address: "Indiranagar, Bengaluru - 560038",
  phone: "+91 98765 43210",
  email: "care@fabriccare.in",
  gstin: "",
  upiId: "",
  logoUrl: "/fabric-care-logo.png",
  terms: "1. Please collect your clothes within 30 days of ready date.\n2. Please check your items and count at the time of pickup.\n3. Bring this bill or receipt SMS when collecting your clothes.",
  enableTax: false,
  taxRate: 5,
  defaultPaperSize: "A4",
};

const STORAGE_KEY = "fabric_care_invoice_settings";
const SETTINGS_EVENT = "fabric_care_invoice_settings_updated";

export function getInvoiceSettings(): InvoiceSettings {
  if (typeof window === "undefined") {
    return DEFAULT_INVOICE_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INVOICE_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_INVOICE_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_INVOICE_SETTINGS;
  }
}

export function saveInvoiceSettings(updated: Partial<InvoiceSettings>): InvoiceSettings {
  const current = getInvoiceSettings();
  const next = { ...current, ...updated };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }));
  } catch (err) {
    console.error("Failed to save invoice settings:", err);
  }
  return next;
}

export function useInvoiceSettings(): [InvoiceSettings, (updated: Partial<InvoiceSettings>) => void] {
  const [settings, setSettings] = useState<InvoiceSettings>(() => getInvoiceSettings());

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setSettings(e.detail);
      } else {
        setSettings(getInvoiceSettings());
      }
    };

    window.addEventListener(SETTINGS_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const update = (updated: Partial<InvoiceSettings>) => {
    const saved = saveInvoiceSettings(updated);
    setSettings(saved);
  };

  return [settings, update];
}
