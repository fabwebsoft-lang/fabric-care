import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types
export type Order = {
  id: string;
  customer: string;
  phone: string;
  customerType: "Normal" | "Premium";
  clothesCode: string | null;
  items: string;
  amount: string;
  balance: string;
  status: "Received" | "Processing" | "Ready" | "Collected";
  deliveryType: "Shop Collection" | "Home Delivery" | null;
  due: string;
  initials: string;
  accent: string;
  totalAmount: number;
  amountPaid: number;
  discount: number;
  clothTags?: string[];
  structuredItems: { name: string; quantity: number; price: number; clothTags?: string[] }[];
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  customerType: "Normal" | "Premium";
  address: string | null;
  alternatePhone: string | null;
  notes: string | null;
  storedClothesCode: string | null;
  orderCount: number;
  totalSpent: string;
  pendingBalance: string;
  pendingBalanceRaw: number;
  createdAt: string;
};

export type Expense = {
  id: number;
  title: string;
  category: string;
  amount: string;
  paymentMethod: string;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
};

export type Shop = {
  id: number;
  name: string;
  address: string;
  customerNotifications: number;
  pricingTier: string;
  shopCode: string;
  lastBackupAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Worker = {
  id: number;
  name: string;
  role: "admin" | "manager" | "staff" | "owner" | "worker";
  pinHash?: string | null;
  active: number;
  createdAt: string;
};

export type Device = {
  id: number;
  deviceLabel: string;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
};

// Initial Demo Seed Data
const initialOrders: Order[] = [
  {
    id: "WP-20260916-001-FC01",
    customer: "Anish Sharma",
    phone: "9876543210",
    customerType: "Normal",
    clothesCode: "C-3210",
    items: "3 items · Standard Laundry",
    amount: "₹160",
    balance: "₹60 due",
    status: "Processing",
    deliveryType: "Shop Collection",
    due: "Today, 6:00 PM",
    initials: "AS",
    accent: "#0F4C5C",
    totalAmount: 160,
    amountPaid: 100,
    discount: 0,
    clothTags: ["0001", "0002", "0003"],
    structuredItems: [
      { name: "Shirt", quantity: 2, price: 50, clothTags: ["0001", "0002"] },
      { name: "Pant", quantity: 1, price: 60, clothTags: ["0003"] },
    ],
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "WP-20260916-002-FC01",
    customer: "Priya Patel",
    phone: "9123456789",
    customerType: "Premium",
    clothesCode: "C-6789",
    items: "2 items · Premium Dry Clean",
    amount: "₹400",
    balance: "Paid",
    status: "Ready",
    deliveryType: "Home Delivery",
    due: "Today, 4:00 PM",
    initials: "PP",
    accent: "#0F4C5C",
    totalAmount: 400,
    amountPaid: 400,
    discount: 30,
    clothTags: ["0004", "0005"],
    structuredItems: [
      { name: "Saree", quantity: 1, price: 150, clothTags: ["0004"] },
      { name: "Suit (2-pc)", quantity: 1, price: 250, clothTags: ["0005"] },
    ],
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "WP-20260915-003-FC01",
    customer: "Rahul Verma",
    phone: "9845012345",
    customerType: "Normal",
    clothesCode: "C-2345",
    items: "4 items · Express Wash",
    amount: "₹280",
    balance: "Paid",
    status: "Received",
    deliveryType: "Shop Collection",
    due: "Tomorrow, 11:00 AM",
    initials: "RV",
    accent: "#0F4C5C",
    totalAmount: 280,
    amountPaid: 280,
    discount: 0,
    clothTags: ["0006", "0007", "0008", "0009"],
    structuredItems: [
      { name: "Shirt", quantity: 2, price: 50, clothTags: ["0006", "0007"] },
      { name: "Jeans", quantity: 2, price: 90, clothTags: ["0008", "0009"] },
    ],
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "WP-20260914-004-FC01",
    customer: "Sneha Reddy",
    phone: "9988776655",
    customerType: "Premium",
    clothesCode: "C-6655",
    items: "1 items · Steam Press",
    amount: "₹120",
    balance: "Paid",
    status: "Collected",
    deliveryType: "Shop Collection",
    due: "Yesterday",
    initials: "SR",
    accent: "#0F4C5C",
    totalAmount: 120,
    amountPaid: 120,
    discount: 0,
    clothTags: ["0010"],
    structuredItems: [{ name: "Saree", quantity: 1, price: 120, clothTags: ["0010"] }],
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const initialCustomers: Customer[] = [
  {
    id: 1,
    name: "Anish Sharma",
    phone: "9876543210",
    customerType: "Normal",
    address: "Indiranagar 10th Main, Bengaluru",
    alternatePhone: "9876543211",
    notes: "Regular customer, prefers light starch on shirts.",
    storedClothesCode: "C-3210",
    orderCount: 4,
    totalSpent: "₹1,450",
    pendingBalance: "₹60 due",
    pendingBalanceRaw: 60,
    createdAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  },
  {
    id: 2,
    name: "Priya Patel",
    phone: "9123456789",
    customerType: "Premium",
    address: "Koramangala 4th Block, Bengaluru",
    alternatePhone: null,
    notes: "Silk sarees and designer suits only.",
    storedClothesCode: "C-6789",
    orderCount: 7,
    totalSpent: "₹3,890",
    pendingBalance: "Paid",
    pendingBalanceRaw: 0,
    createdAt: new Date(Date.now() - 60 * 86400 * 1000).toISOString(),
  },
  {
    id: 3,
    name: "Rahul Verma",
    phone: "9845012345",
    customerType: "Normal",
    address: "Domlur 2nd Stage, Bengaluru",
    alternatePhone: null,
    notes: "Office wear batch every Monday.",
    storedClothesCode: "C-2345",
    orderCount: 2,
    totalSpent: "₹560",
    pendingBalance: "Paid",
    pendingBalanceRaw: 0,
    createdAt: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
  },
  {
    id: 4,
    name: "Sneha Reddy",
    phone: "9988776655",
    customerType: "Premium",
    address: "HAL 2nd Stage, Bengaluru",
    alternatePhone: null,
    notes: "Prefers WhatsApp updates.",
    storedClothesCode: "C-6655",
    orderCount: 5,
    totalSpent: "₹2,100",
    pendingBalance: "Paid",
    pendingBalanceRaw: 0,
    createdAt: new Date(Date.now() - 45 * 86400 * 1000).toISOString(),
  },
];

const initialExpenses: Expense[] = [
  {
    id: 1,
    title: "Eco Liquid Detergent (50L)",
    category: "Detergent & Chemicals",
    amount: "3400.00",
    paymentMethod: "UPI",
    expenseDate: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    notes: "Bulk order from supplier",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Garment Packaging Bags (500 pcs)",
    category: "Packaging",
    amount: "1250.00",
    paymentMethod: "Cash",
    expenseDate: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
    notes: "Biodegradable covers with logo",
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: "Steam Iron Boiler Maintenance",
    category: "Machine Maintenance",
    amount: "1800.00",
    paymentMethod: "Bank Transfer",
    expenseDate: new Date(Date.now() - 8 * 86400 * 1000).toISOString(),
    notes: "Quarterly descaling and nozzle check",
    createdAt: new Date().toISOString(),
  },
];

const initialShop: Shop = {
  id: 1,
  name: "Indiranagar shop",
  address: "Indiranagar, Bengaluru",
  customerNotifications: 1,
  pricingTier: "Normal + Premium",
  shopCode: "FC01",
  lastBackupAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const initialWorkers: Worker[] = [
  { id: 1, name: "Ashfaq", role: "owner", pinHash: "1234", active: 1, createdAt: new Date().toISOString() },
  { id: 2, name: "Ramesh Kumar", role: "manager", pinHash: "0000", active: 1, createdAt: new Date().toISOString() },
  { id: 3, name: "Sunil Gowda", role: "staff", pinHash: null, active: 1, createdAt: new Date().toISOString() },
];

const initialDevices: Device[] = [
  { id: 1, deviceLabel: "Counter iPad POS", userAgent: "Mozilla/5.0 (iPad)", lastActiveAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 2, deviceLabel: "Store Manager Phone", userAgent: "Mozilla/5.0 (iPhone)", lastActiveAt: new Date().toISOString(), createdAt: new Date().toISOString() },
];

// LocalStorage Helper
function getStored<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(`fabric_care_${key}`);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(`fabric_care_${key}`, JSON.stringify(val));
  } catch {}
}

// In-memory + LocalStorage Cache
let storedOrders = getStored<Order[]>("orders", initialOrders);
let storedCustomers = getStored<Customer[]>("customers", initialCustomers);
let storedExpenses = getStored<Expense[]>("expenses", initialExpenses);
let storedShop = getStored<Shop>("shop", initialShop);
let storedWorkers = getStored<Worker[]>("workers", initialWorkers);
let storedDevices = getStored<Device[]>("devices", initialDevices);
let storedUser = { id: 1, openId: "user_ashfaq", name: "Ashfaq", email: "asfaq94.md@gmail.com", role: "admin" };

const moneyStr = (num: number) => `₹${Math.round(num).toLocaleString("en-IN")}`;

export const trpc = {
  Provider: ({ children }: { children: React.ReactNode; client?: any; queryClient?: any }) => {
    return <>{children}</>;
  },
  createClient: (_opts?: any) => ({}),
  useUtils: () => {
    const qc = useQueryClient();
    return {
      orders: {
        list: {
          setData: (_input: any, updater: any) => {
            qc.setQueryData(["orders.list"], (prev: any) =>
              typeof updater === "function" ? updater(prev || storedOrders) : updater
            );
          },
          invalidate: async () => qc.invalidateQueries({ queryKey: ["orders.list"] }),
        },
      },
      customers: {
        list: {
          setData: (_input: any, updater: any) => {
            qc.setQueryData(["customers.list"], (prev: any) =>
              typeof updater === "function" ? updater(prev || storedCustomers) : updater
            );
          },
          invalidate: async () => qc.invalidateQueries({ queryKey: ["customers.list"] }),
        },
      },
      expenses: {
        list: {
          setData: (_input: any, updater: any) => {
            qc.setQueryData(["expenses.list"], (prev: any) =>
              typeof updater === "function" ? updater(prev || storedExpenses) : updater
            );
          },
          invalidate: async () => qc.invalidateQueries({ queryKey: ["expenses.list"] }),
        },
      },
      shops: {
        list: {
          setData: (_input: any, updater: any) => {
            qc.setQueryData(["shops.list"], (prev: any) =>
              typeof updater === "function" ? updater(prev || [storedShop]) : updater
            );
          },
          invalidate: async () => qc.invalidateQueries({ queryKey: ["shops.list"] }),
        },
      },
      workers: {
        list: {
          invalidate: async () => qc.invalidateQueries({ queryKey: ["workers.list"] }),
        },
      },
      devices: {
        list: {
          invalidate: async () => qc.invalidateQueries({ queryKey: ["devices.list"] }),
        },
      },
      reports: {
        businessStatements: {
          invalidate: async () => qc.invalidateQueries({ queryKey: ["reports.businessStatements"] }),
        },
      },
      dashboard: {
        stats: {
          invalidate: async () => qc.invalidateQueries({ queryKey: ["dashboard.stats"] }),
        },
      },
      auth: {
        me: {
          setData: (_input: any, updater: any) => {
            qc.setQueryData(["auth.me"], updater);
          },
          invalidate: async () => qc.invalidateQueries({ queryKey: ["auth.me"] }),
        },
      },
    };
  },

  auth: {
    me: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery({
          queryKey: ["auth.me"],
          queryFn: async () => storedUser,
          staleTime: Infinity,
        });
      },
    },
    logout: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async () => {
            storedUser = null as any;
            return { success: true };
          },
          onSuccess: (data) => {
            qc.setQueryData(["auth.me"], null);
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
  },

  orders: {
    list: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery<Order[]>({
          queryKey: ["orders.list"],
          queryFn: async () => [...storedOrders],
          staleTime: 5000,
        });
      },
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Order) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: any) => {
            const count = storedOrders.length + 1;
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const orderNumber = `WP-${dateStr}-${String(count).padStart(3, "0")}-FC01`;
            const total = Number(input.totalAmount || 0);
            const paid = Number(input.amountPaid || 0);
            const discount = Number(input.discount || 0);
            const items = Array.isArray(input.items) ? input.items : [];
            const totalItemsCount = items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);

            const initials = (input.customerName || "Customer")
              .trim()
              .split(/\s+/)
              .map((p: string) => p[0] || "")
              .join("")
              .slice(0, 2)
              .toUpperCase() || "FC";

            const newOrder: Order = {
              id: orderNumber,
              customer: input.customerName,
              phone: input.phone,
              customerType: input.customerType || "Normal",
              clothesCode: input.storedClothesCode || `C-${input.phone.slice(-4)}`,
              items: `${totalItemsCount} items · ${input.serviceType || "Standard Laundry"}`,
              amount: moneyStr(total),
              balance: paid >= total ? "Paid" : `${moneyStr(total - paid)} due`,
              status: "Received",
              deliveryType: input.deliveryType || "Shop Collection",
              due: input.dueAt ? `Due ${new Date(input.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Today, 6:00 PM",
              initials,
              accent: "#0F4C5C",
              totalAmount: total,
              amountPaid: paid,
              discount,
              clothTags: items.flatMap((i: any) => i.clothTags || []),
              structuredItems: items,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            storedOrders = [newOrder, ...storedOrders];
            setStored("orders", storedOrders);

            const custIdx = storedCustomers.findIndex((c) => c.phone === input.phone);
            if (custIdx >= 0) {
              const cust = storedCustomers[custIdx];
              const prevOrders = storedOrders.filter((o) => o.phone === input.phone);
              const totalSpent = prevOrders.reduce((sum, o) => sum + o.totalAmount, 0);
              const totalPaid = prevOrders.reduce((sum, o) => sum + o.amountPaid, 0);
              const pending = Math.max(0, totalSpent - totalPaid);
              storedCustomers[custIdx] = {
                ...cust,
                orderCount: prevOrders.length,
                totalSpent: moneyStr(totalSpent),
                pendingBalance: pending > 0 ? `${moneyStr(pending)} due` : "Paid",
                pendingBalanceRaw: pending,
              };
            } else {
              storedCustomers = [
                {
                  id: Date.now(),
                  name: input.customerName,
                  phone: input.phone,
                  customerType: input.customerType || "Normal",
                  address: input.address || null,
                  alternatePhone: input.alternatePhone || null,
                  notes: input.notes || null,
                  storedClothesCode: input.storedClothesCode || `C-${input.phone.slice(-4)}`,
                  orderCount: 1,
                  totalSpent: moneyStr(total),
                  pendingBalance: total > paid ? `${moneyStr(total - paid)} due` : "Paid",
                  pendingBalanceRaw: Math.max(0, total - paid),
                  createdAt: new Date().toISOString(),
                },
                ...storedCustomers,
              ];
            }
            setStored("customers", storedCustomers);

            return newOrder;
          },
          onSuccess: (data) => {
            qc.setQueryData(["orders.list"], [...storedOrders]);
            qc.setQueryData(["customers.list"], [...storedCustomers]);
            qc.invalidateQueries({ queryKey: ["orders.list"] });
            qc.invalidateQueries({ queryKey: ["customers.list"] });
            qc.invalidateQueries({ queryKey: ["dashboard.stats"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    updateStatus: {
      useMutation: (options?: { onSuccess?: (data: Order) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { id: string; status: Order["status"]; deliveryType?: Order["deliveryType"] }) => {
            const idx = storedOrders.findIndex((o) => o.id === input.id);
            if (idx === -1) throw new Error("Order not found");
            storedOrders[idx] = {
              ...storedOrders[idx],
              status: input.status,
              deliveryType: input.deliveryType || storedOrders[idx].deliveryType,
              updatedAt: new Date().toISOString(),
            };
            setStored("orders", storedOrders);
            return storedOrders[idx];
          },
          onSuccess: (data) => {
            qc.setQueryData(["orders.list"], [...storedOrders]);
            qc.invalidateQueries({ queryKey: ["orders.list"] });
            qc.invalidateQueries({ queryKey: ["dashboard.stats"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    settlePayment: {
      useMutation: (options?: { onSuccess?: (data: Order) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { id: string; amountPaid: number; deliveryType?: Order["deliveryType"] }) => {
            const idx = storedOrders.findIndex((o) => o.id === input.id);
            if (idx === -1) throw new Error("Order not found");
            const ord = storedOrders[idx];
            const newPaid = Math.min(ord.totalAmount, ord.amountPaid + input.amountPaid);
            const isFull = newPaid >= ord.totalAmount;
            storedOrders[idx] = {
              ...ord,
              amountPaid: newPaid,
              balance: isFull ? "Paid" : `${moneyStr(ord.totalAmount - newPaid)} due`,
              status: isFull ? "Collected" : ord.status,
              deliveryType: input.deliveryType || ord.deliveryType,
              updatedAt: new Date().toISOString(),
            };
            setStored("orders", storedOrders);
            return storedOrders[idx];
          },
          onSuccess: (data) => {
            qc.setQueryData(["orders.list"], [...storedOrders]);
            qc.invalidateQueries({ queryKey: ["orders.list"] });
            qc.invalidateQueries({ queryKey: ["dashboard.stats"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    delete: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { id: string }) => {
            storedOrders = storedOrders.filter((o) => o.id !== input.id);
            setStored("orders", storedOrders);
            return { success: true };
          },
          onSuccess: () => {
            qc.setQueryData(["orders.list"], [...storedOrders]);
            qc.invalidateQueries({ queryKey: ["orders.list"] });
            qc.invalidateQueries({ queryKey: ["dashboard.stats"] });
            options?.onSuccess?.();
          },
          onError: options?.onError,
        });
      },
    },
  },

  customers: {
    list: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery<Customer[]>({
          queryKey: ["customers.list"],
          queryFn: async () => [...storedCustomers],
          staleTime: 5000,
        });
      },
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Customer) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: any) => {
            const newCust: Customer = {
              id: Date.now(),
              name: input.name,
              phone: input.phone,
              customerType: input.customerType || "Normal",
              address: input.address || null,
              alternatePhone: input.alternatePhone || null,
              notes: input.notes || null,
              storedClothesCode: input.storedClothesCode || `C-${input.phone.slice(-4)}`,
              orderCount: 0,
              totalSpent: "₹0",
              pendingBalance: "Paid",
              pendingBalanceRaw: 0,
              createdAt: new Date().toISOString(),
            };
            storedCustomers = [newCust, ...storedCustomers];
            setStored("customers", storedCustomers);
            return newCust;
          },
          onSuccess: (data) => {
            qc.setQueryData(["customers.list"], [...storedCustomers]);
            qc.invalidateQueries({ queryKey: ["customers.list"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    update: {
      useMutation: (options?: { onSuccess?: (data: Customer) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: any) => {
            const idx = storedCustomers.findIndex((c) => c.id === input.id);
            if (idx === -1) throw new Error("Customer not found");
            storedCustomers[idx] = { ...storedCustomers[idx], ...input };
            setStored("customers", storedCustomers);
            return storedCustomers[idx];
          },
          onSuccess: (data) => {
            qc.setQueryData(["customers.list"], [...storedCustomers]);
            qc.invalidateQueries({ queryKey: ["customers.list"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
  },

  expenses: {
    list: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery<Expense[]>({
          queryKey: ["expenses.list"],
          queryFn: async () => [...storedExpenses],
          staleTime: 5000,
        });
      },
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Expense) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: any) => {
            const newExp: Expense = {
              id: Date.now(),
              title: input.title,
              category: input.category,
              amount: Number(input.amount).toFixed(2),
              paymentMethod: input.paymentMethod,
              expenseDate: input.expenseDate,
              notes: input.notes || null,
              createdAt: new Date().toISOString(),
            };
            storedExpenses = [newExp, ...storedExpenses];
            setStored("expenses", storedExpenses);
            return newExp;
          },
          onSuccess: (data) => {
            qc.setQueryData(["expenses.list"], [...storedExpenses]);
            qc.invalidateQueries({ queryKey: ["expenses.list"] });
            qc.invalidateQueries({ queryKey: ["reports.businessStatements"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    delete: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { id: number }) => {
            storedExpenses = storedExpenses.filter((e) => e.id !== input.id);
            setStored("expenses", storedExpenses);
            return { success: true };
          },
          onSuccess: () => {
            qc.setQueryData(["expenses.list"], [...storedExpenses]);
            qc.invalidateQueries({ queryKey: ["expenses.list"] });
            options?.onSuccess?.();
          },
          onError: options?.onError,
        });
      },
    },
  },

  shops: {
    list: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery<Shop[]>({
          queryKey: ["shops.list"],
          queryFn: async () => [storedShop],
          staleTime: Infinity,
        });
      },
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Shop) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: any) => {
            storedShop = { ...storedShop, ...input, updatedAt: new Date().toISOString() };
            setStored("shop", storedShop);
            return storedShop;
          },
          onSuccess: (data) => {
            qc.setQueryData(["shops.list"], [storedShop]);
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    updateSettings: {
      useMutation: (options?: { onSuccess?: (data: Shop) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: any) => {
            storedShop = {
              ...storedShop,
              name: input.name,
              address: input.address,
              customerNotifications: input.customerNotifications ? 1 : 0,
              pricingTier: input.pricingTier,
              updatedAt: new Date().toISOString(),
            };
            setStored("shop", storedShop);
            return storedShop;
          },
          onSuccess: (data) => {
            qc.setQueryData(["shops.list"], [storedShop]);
            qc.invalidateQueries({ queryKey: ["shops.list"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    recordBackup: {
      useMutation: (options?: { onSuccess?: (data: { lastBackupAt: string }) => void; onError?: (err: any) => void }) => {
        return useMutation({
          mutationFn: async () => {
            const lastBackupAt = new Date().toISOString();
            storedShop.lastBackupAt = lastBackupAt;
            setStored("shop", storedShop);
            return { lastBackupAt };
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        });
      },
    },
  },

  workers: {
    list: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery<Worker[]>({
          queryKey: ["workers.list"],
          queryFn: async () => [...storedWorkers],
          staleTime: 5000,
        });
      },
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Worker) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { name: string; role: Worker["role"] }) => {
            const newWorker: Worker = {
              id: Date.now(),
              name: input.name,
              role: input.role,
              active: 1,
              createdAt: new Date().toISOString(),
            };
            storedWorkers = [...storedWorkers, newWorker];
            setStored("workers", storedWorkers);
            return newWorker;
          },
          onSuccess: (data) => {
            qc.setQueryData(["workers.list"], [...storedWorkers]);
            qc.invalidateQueries({ queryKey: ["workers.list"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    updateRole: {
      useMutation: (options?: { onSuccess?: (data: Worker) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { workerId: number; role: Worker["role"] }) => {
            const idx = storedWorkers.findIndex((w) => w.id === input.workerId);
            if (idx === -1) throw new Error("Worker not found");
            storedWorkers[idx] = { ...storedWorkers[idx], role: input.role };
            setStored("workers", storedWorkers);
            return storedWorkers[idx];
          },
          onSuccess: (data) => {
            qc.setQueryData(["workers.list"], [...storedWorkers]);
            qc.invalidateQueries({ queryKey: ["workers.list"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    delete: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { workerId: number }) => {
            storedWorkers = storedWorkers.filter((w) => w.id !== input.workerId);
            setStored("workers", storedWorkers);
            return { success: true };
          },
          onSuccess: () => {
            qc.setQueryData(["workers.list"], [...storedWorkers]);
            qc.invalidateQueries({ queryKey: ["workers.list"] });
            options?.onSuccess?.();
          },
          onError: options?.onError,
        });
      },
    },
    setPin: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { workerId: number; pin: string }) => {
            const idx = storedWorkers.findIndex((w) => w.id === input.workerId);
            if (idx === -1) throw new Error("Worker not found");
            storedWorkers[idx] = { ...storedWorkers[idx], pinHash: input.pin };
            setStored("workers", storedWorkers);
            return { success: true };
          },
          onSuccess: () => {
            qc.setQueryData(["workers.list"], [...storedWorkers]);
            qc.invalidateQueries({ queryKey: ["workers.list"] });
            options?.onSuccess?.();
          },
          onError: options?.onError,
        });
      },
    },
    verifyPin: {
      useMutation: () => {
        return useMutation({
          mutationFn: async (input: { workerId: number; pin: string }) => {
            const worker = storedWorkers.find((w) => w.id === input.workerId);
            return { success: worker ? worker.pinHash === input.pin : false };
          },
        });
      },
    },
  },

  devices: {
    list: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery<Device[]>({
          queryKey: ["devices.list"],
          queryFn: async () => [...storedDevices],
          staleTime: 10000,
        });
      },
    },
    register: {
      useMutation: (options?: { onSuccess?: (data: Device) => void; onError?: (err: any) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { deviceLabel: string; userAgent?: string }) => {
            const newDevice: Device = {
              id: Date.now(),
              deviceLabel: input.deviceLabel,
              userAgent: input.userAgent || navigator.userAgent,
              lastActiveAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            storedDevices = [...storedDevices, newDevice];
            setStored("devices", storedDevices);
            return newDevice;
          },
          onSuccess: (data) => {
            qc.setQueryData(["devices.list"], [...storedDevices]);
            qc.invalidateQueries({ queryKey: ["devices.list"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
  },

  reports: {
    businessStatements: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery({
          queryKey: ["reports.businessStatements"],
          queryFn: async () => {
            const totalRevenue = storedOrders.reduce((s, o) => s + o.totalAmount, 0);
            const totalCollected = storedOrders.reduce((s, o) => s + o.amountPaid, 0);
            const totalPending = storedOrders.reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
            const totalExpenses = storedExpenses.reduce((s, e) => s + Number(e.amount), 0);
            const netProfit = totalCollected - totalExpenses;

            const dailyBreakdown = [
              { date: "Mon", sales: 1420, collected: 1200, expenses: 350, net: 850 },
              { date: "Tue", sales: 2100, collected: 1850, expenses: 1200, net: 650 },
              { date: "Wed", sales: 1680, collected: 1500, expenses: 200, net: 1300 },
              { date: "Thu", sales: 2450, collected: 2200, expenses: 600, net: 1600 },
              { date: "Fri", sales: 3100, collected: 2900, expenses: 450, net: 2450 },
              { date: "Sat", sales: 4200, collected: 3950, expenses: 800, net: 3150 },
              { date: "Sun", sales: 3800, collected: 3600, expenses: 150, net: 3450 },
            ];

            return {
              totalSales: totalRevenue,
              totalRevenue,
              totalCollected,
              totalPending,
              totalExpenses,
              netRevenue: netProfit,
              netProfit,
              dailyBreakdown,
              dailyStats: dailyBreakdown.map(d => ({ date: d.date, revenue: d.sales, collected: d.collected, expenses: d.expenses })),
              orderCount: storedOrders.length,
              avgOrderValue: storedOrders.length ? Math.round(totalRevenue / storedOrders.length) : 0,
            };
          },
        });
      },
    },
  },

  dashboard: {
    stats: {
      useQuery: (_input?: any, _options?: any) => {
        return useQuery({
          queryKey: ["dashboard.stats"],
          queryFn: async () => {
            const todaysRevenue = storedOrders.reduce((s, o) => s + o.totalAmount, 0);
            const collectedToday = storedOrders.reduce((s, o) => s + o.amountPaid, 0);
            const pendingDues = storedOrders.reduce((s, o) => s + Math.max(0, o.totalAmount - o.amountPaid), 0);
            const inProcessCount = storedOrders.filter((o) => o.status === "Processing" || o.status === "Received").length;
            const readyCount = storedOrders.filter((o) => o.status === "Ready").length;
            const ordersReceived = storedOrders.filter((o) => o.status === "Received").length;
            const itemsInProcess = storedOrders
              .filter((o) => o.status === "Processing")
              .reduce((sum, o) => sum + o.structuredItems.reduce((acc, item) => acc + item.quantity, 0), 0);

            const processCounts = {
              Received: storedOrders.filter((o) => o.status === "Received").length,
              Processing: storedOrders.filter((o) => o.status === "Processing").length,
              Ready: readyCount,
            };

            return {
              todaysSales: todaysRevenue,
              todaysCollected: collectedToday,
              todaysPending: pendingDues,
              todaysGarmentCount: itemsInProcess,
              todaysRevenue,
              collectedToday,
              pendingDues,
              inProcessCount,
              readyCount,
              ordersReceived,
              itemsInProcess,
              processCounts,
            };
          },
        });
      },
    },
  },
};
