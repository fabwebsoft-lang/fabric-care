import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  setRoleToken,
  clearRoleToken,
  getRoleToken,
  getCachedUser,
  setCachedUser,
  clearAllSession,
  getIroningOrderIds,
  setIroningOrderId,
} from "./session";

// ---------------------------------------------------------------------------
// Display-shaped types consumed by the existing view components. The real
// backend (server/) returns clean, unformatted data — this file is the
// adapter layer that maps it into the shapes the UI was already built
// around, and is the single place that talks to the network.
// ---------------------------------------------------------------------------

export type OrderItem = { name: string; quantity: number; price: number; clothTags?: string[] };

export type Order = {
  id: string;
  customerId?: string | null;
  customer: string;
  phone: string;
  customerType: "Normal" | "Premium";
  clothesCode: string | null;
  items: string;
  amount: string;
  balance: string;
  status: "Received" | "Processing" | "Ironing" | "Ready" | "Collected";
  deliveryType: "Shop Collection" | "Home Delivery" | null;
  due: string;
  initials: string;
  accent: string;
  totalAmount: number;
  amountPaid: number;
  discount: number;
  clothTags?: string[];
  structuredItems: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  customerId?: string | null;
  name: string;
  phone: string;
  normalizedPhone?: string;
  customerType?: "Normal" | "Premium";
  address: string | null;
  alternatePhone: string | null;
  notes: string | null;
  storedClothesCode?: string | null;
  orderCount: number;
  totalSpent: number;
  pendingBalance: number;
  createdAt: string;
};

export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
};

export type Shop = {
  id: string;
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
  id: string;
  name: string;
  email: string | null;
  role: "pending" | "admin" | "manager" | "staff";
  active: number;
  hasPin: boolean;
  createdAt: string;
};

export type Device = {
  id: string;
  deviceLabel: string;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  category: "Men's Wear" | "Women's Wear" | "Kids Wear" | "Household" | "Other" | string;
  serviceType: "Wash & Fold" | "Wash & Iron" | "Dry Clean" | "Iron Only" | "Steam Iron" | "Other" | string;
  price: number;
  status: "Active" | "Inactive";
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecycleBinItemType = "order" | "customer" | "expense";

export interface RecycleBinItem {
  id: string;
  recordType: RecycleBinItemType;
  title: string;
  subtitle?: string;
  customerName?: string;
  phone?: string;
  amount?: number;
  outstandingAmount?: number;
  itemsSummary?: string;
  originalDate?: string;
  deletedAt: string;
  deletedBy: string;
}


// ---------------------------------------------------------------------------
// Vanilla tRPC HTTP client. The frontend and backend are separate packages
// (no shared workspace), so this is intentionally untyped rather than
// importing the server's AppRouter type across a package boundary.
// ---------------------------------------------------------------------------

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4000";

const client: any = createTRPCClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers() {
        const headers: Record<string, string> = {};
        const session = getSessionToken();
        if (session) headers.authorization = `Bearer ${session}`;
        const roleToken = getRoleToken();
        if (roleToken) headers["x-role-token"] = roleToken;
        return headers;
      },
    }),
  ],
});

function errorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

const moneyStr = (num: number) => `₹${Math.round(num).toLocaleString("en-IN")}`;

function toDisplayOrder(o: any): Order {
  const items: OrderItem[] = o.items || [];
  const totalItemsCount = items.reduce((s, i) => s + i.quantity, 0);
  const dueAmount = o.totalAmount - o.amountPaid;
  const initials =
    (o.customer || "Customer")
      .trim()
      .split(/\s+/)
      .map((p: string) => p[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "FC";

  let status: Order["status"] = o.status;
  const ironingSet = getIroningOrderIds();
  if (status === "Processing" && ironingSet.has(o.id)) {
    status = "Ironing";
  } else if (status !== "Processing" && status !== "Ironing" && ironingSet.has(o.id)) {
    setIroningOrderId(o.id, false);
  }

  return {
    id: o.id,
    customerId: o.customerId || null,
    customer: o.customer,
    phone: o.phone,
    customerType: o.customerType,
    clothesCode: o.clothesCode,
    items: `${totalItemsCount} items · ${o.serviceType}`,
    amount: moneyStr(o.totalAmount),
    balance: dueAmount > 0 ? `${moneyStr(dueAmount)} due` : "Paid",
    status,
    deliveryType: o.deliveryType,
    due: o.dueAt
      ? `Due ${new Date(o.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "—",
    initials,
    accent: "#0F4C5C",
    totalAmount: o.totalAmount,
    amountPaid: o.amountPaid,
    discount: o.discount,
    clothTags: items.flatMap((i) => i.clothTags || []),
    structuredItems: items,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// dashboard.stats / reports.businessStatements: the backend returns clean
// field names, but DashboardView and StatementsView were built against the
// old mock's naming. Alias here rather than touching every consumer.
function toDisplayDashboardStats(raw: any) {
  return {
    ...raw,
    todaysSales: raw.todaysRevenue,
    todaysCollected: raw.collectedToday,
    todaysPending: raw.pendingDues,
    todaysGarmentCount: raw.itemsInProcess,
  };
}

function toDisplayStatements(raw: any) {
  return {
    ...raw,
    totalSales: raw.totalRevenue,
    netRevenue: raw.netProfit,
    dailyBreakdown: (raw.dailyStats || []).map((d: any) => ({ ...d, sales: d.revenue })),
  };
}

export const trpc = {
  Provider: ({ children }: { children: React.ReactNode; client?: any; queryClient?: any }) => {
    return <>{children}</>;
  },
  createClient: (_opts?: any) => ({}),

  useUtils: () => {
    const qc = useQueryClient();
    return {
      auth: {
        me: {
          setData: (_input: any, updater: any) => qc.setQueryData(["auth.me"], updater),
          invalidate: () => qc.invalidateQueries({ queryKey: ["auth.me"] }),
        },
      },
      orders: {
        list: {
          setData: (_input: any, updater: any) => qc.setQueryData(["orders.list"], updater),
          invalidate: () => qc.invalidateQueries({ queryKey: ["orders.list"] }),
        },
      },
      customers: {
        list: { invalidate: () => qc.invalidateQueries({ queryKey: ["customers.list"] }) },
        search: { invalidate: () => qc.invalidateQueries({ queryKey: ["customers.search"] }) },
      },
      expenses: {
        list: { invalidate: () => qc.invalidateQueries({ queryKey: ["expenses.list"] }) },
      },
      shops: {
        list: {
          setData: (_input: any, updater: any) => qc.setQueryData(["shops.list"], updater),
          invalidate: () => qc.invalidateQueries({ queryKey: ["shops.list"] }),
        },
      },
      workers: {
        list: { invalidate: () => qc.invalidateQueries({ queryKey: ["workers.list"] }) },
      },
      devices: {
        list: { invalidate: () => qc.invalidateQueries({ queryKey: ["devices.list"] }) },
      },
      products: {
        list: {
          setData: (_input: any, updater: any) => qc.setQueryData(["products.list"], updater),
          invalidate: () => qc.invalidateQueries({ queryKey: ["products.list"] }),
        },
        activeList: {
          invalidate: () => qc.invalidateQueries({ queryKey: ["products.activeList"] }),
        },
      },
      dashboard: {
        stats: { invalidate: () => qc.invalidateQueries({ queryKey: ["dashboard.stats"] }) },
      },
      reports: {
        businessStatements: {
          invalidate: () => qc.invalidateQueries({ queryKey: ["reports.businessStatements"] }),
        },
      },
      recycleBin: {
        list: { invalidate: () => qc.invalidateQueries({ queryKey: ["recycleBin.list"] }) },
        counts: { invalidate: () => qc.invalidateQueries({ queryKey: ["recycleBin.counts"] }) },
      },
    };
  },

  auth: {
    me: {
      useQuery: (_input?: any, options?: any) => {
        const token = getSessionToken();
        const cached = token ? getCachedUser() : null;

        return useQuery<any>({
          queryKey: ["auth.me"],
          queryFn: async () => {
            const currentToken = getSessionToken();
            if (!currentToken) return null;
            try {
              const res = await client.auth.me.query();
              if (res) {
                if (res.refreshedToken) {
                  setSessionToken(res.refreshedToken);
                }
                const userObj = { id: res.id, name: res.name, email: res.email, role: res.role };
                setCachedUser(userObj);
                return userObj;
              }
              return null;
            } catch (err: any) {
              const msg = errorMessage(err).toLowerCase();
              // Only clear session if explicitly unauthenticated by server (e.g. invalid token, user deleted)
              if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("invalid token")) {
                clearAllSession();
                return null;
              }
              // If offline or network error, retain existing cached session
              const existingCached = getCachedUser();
              if (existingCached) return existingCached;
              return null;
            }
          },
          initialData: cached || undefined,
          staleTime: 1000 * 60 * 5, // 5 minutes fresh
          gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days cache
          retry: 2,
          // Poll while awaiting admin approval so the "Contact Admin" screen
          // unlocks on its own once a role is assigned, no refresh needed.
          refetchInterval: (query: any) => (query.state.data?.role === "pending" ? 5000 : false),
          ...options,
        });
      },
    },
    signup: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { name: string; email: string; password: string }) => {
            try {
              const res = await client.auth.signup.mutate(input);
              setSessionToken(res.token);
              setCachedUser(res.user);
              return res.user;
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.setQueryData(["auth.me"], data);
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    login: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { email: string; password: string }) => {
            try {
              const res = await client.auth.login.mutate(input);
              setSessionToken(res.token);
              setCachedUser(res.user);
              return res.user;
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.setQueryData(["auth.me"], data);
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    logout: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async () => {
            try {
              await client.auth.logout.mutate();
            } catch {}
            clearAllSession();
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
      useQuery: (_input?: any, options?: any) =>
        useQuery<Order[]>({
          queryKey: ["orders.list"],
          queryFn: async () => (await client.orders.list.query()).map(toDisplayOrder),
          staleTime: 5000,
          ...options,
        }),
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Order) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: any) => {
            try {
              return toDisplayOrder(await client.orders.create.mutate(input));
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    updateStatus: {
      useMutation: (options?: { onSuccess?: (data: Order) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { id: string; status: Order["status"] }) => {
            try {
              const res = await client.orders.updateStatus.mutate(input);
              if (input.status === "Ironing") {
                setIroningOrderId(input.id, true);
              } else {
                setIroningOrderId(input.id, false);
              }
              const display = toDisplayOrder(res);
              display.status = input.status;
              return display;
            } catch (err) {
              const msg = errorMessage(err);
              // Graceful compatibility fallback if cloud backend hasn't reloaded Zod enum:
              if (input.status === "Ironing" && (msg.includes("invalid_value") || msg.includes("Invalid option") || msg.includes("expected one of"))) {
                const res = await client.orders.updateStatus.mutate({ id: input.id, status: "Processing" });
                setIroningOrderId(input.id, true);
                const display = toDisplayOrder(res);
                display.status = "Ironing";
                return display;
              }
              throw new Error(msg);
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    bulkUpdateStatus: {
      useMutation: (options?: {
        onSuccess?: (data: { count: number; ids: string[] }, variables: { ids: string[]; status: Order["status"] }) => void | Promise<any>;
        onError?: (err: Error) => void;
      }) =>
        useMutation({
          mutationFn: async (input: { ids: string[]; status: Order["status"] }) => {
            try {
              const res = await client.orders.bulkUpdateStatus.mutate(input);
              if (input.status === "Ironing") {
                input.ids.forEach((id) => setIroningOrderId(id, true));
              } else {
                input.ids.forEach((id) => setIroningOrderId(id, false));
              }
              return res;
            } catch (err) {
              const msg = errorMessage(err);
              if (input.status === "Ironing" && (msg.includes("invalid_value") || msg.includes("Invalid option") || msg.includes("expected one of"))) {
                input.ids.forEach((id) => setIroningOrderId(id, true));
                return await client.orders.bulkUpdateStatus.mutate({ ids: input.ids, status: "Processing" });
              }
              throw new Error(msg);
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    settlePayment: {
      useMutation: (options?: { onSuccess?: (data: Order, variables?: any) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: any) => {
            try {
              return toDisplayOrder(await client.orders.settlePayment.mutate(input));
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    bulkMarkAsPaid: {
      useMutation: (options?: {
        onSuccess?: (data: { count: number; ids: string[] }, variables: { ids: string[] }) => void | Promise<any>;
        onError?: (err: Error) => void;
      }) =>
        useMutation({
          mutationFn: async (input: { ids: string[] }) => {
            try {
              return await client.orders.bulkMarkAsPaid.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    delete: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { id: string }) => {
            try {
              return await client.orders.delete.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
  },

  customers: {
    list: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<Customer[]>({
          queryKey: ["customers.list"],
          queryFn: () => client.customers.list.query(),
          staleTime: 5000,
          ...options,
        }),
    },
    search: {
      useQuery: (input: { query: string; limit?: number }, options?: any) =>
        useQuery<Customer[]>({
          queryKey: ["customers.search", input],
          queryFn: () => client.customers.search.query(input),
          staleTime: 2000,
          ...options,
        }),
    },
    checkDuplicate: {
      useQuery: (input: { phone: string; excludeId?: string }, options?: any) =>
        useQuery<{ exists: boolean; customer: Customer | null }>({
          queryKey: ["customers.checkDuplicate", input],
          queryFn: () => client.customers.checkDuplicate.query(input),
          staleTime: 1000,
          enabled: Boolean(input?.phone && input.phone.trim().length >= 3),
          ...options,
        }),
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: any) => {
            try {
              return await client.customers.create.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    update: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: any) => {
            try {
              return await client.customers.update.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    delete: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { id: string }) => {
            try {
              return await client.customers.delete.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
  },

  expenses: {
    list: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<Expense[]>({
          queryKey: ["expenses.list"],
          queryFn: () => client.expenses.list.query(),
          staleTime: 5000,
          ...options,
        }),
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Expense) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: any) => {
            try {
              return await client.expenses.create.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    update: {
      useMutation: (options?: { onSuccess?: (data: Expense) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: any) => {
            try {
              return await client.expenses.update.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    delete: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { id: string }) => {
            try {
              return await client.expenses.delete.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
  },

  shops: {
    list: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<Shop[]>({
          queryKey: ["shops.list"],
          queryFn: () => client.shops.list.query(),
          staleTime: 30000,
          ...options,
        }),
    },
    updateSettings: {
      useMutation: (options?: { onSuccess?: (data: Shop) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: any) => {
            try {
              return await client.shops.updateSettings.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    recordBackup: {
      useMutation: (options?: { onSuccess?: (data: { lastBackupAt: string }) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async () => {
            try {
              return await client.shops.recordBackup.mutate();
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
  },

  workers: {
    list: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<Worker[]>({
          queryKey: ["workers.list"],
          queryFn: () => client.workers.list.query(),
          staleTime: 5000,
          ...options,
        }),
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { name: string; role: Worker["role"]; pin?: string }) => {
            try {
              return await client.workers.create.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    updateRole: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { workerId: string; role: Worker["role"] }) => {
            try {
              return await client.workers.updateRole.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    delete: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { workerId: string }) => {
            try {
              return await client.workers.delete.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    setPin: {
      useMutation: (options?: { onSuccess?: () => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { workerId: string; pin: string }) => {
            try {
              return await client.workers.setPin.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
    // Verifies a worker's PIN and, on success, stores the short-lived
    // role-token the server issues so subsequent requests are enforced
    // under that worker's actual permissions (see server/README.md).
    verifyPin: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { workerId: string; pin: string }) => {
            try {
              const res = await client.workers.verifyPin.mutate(input);
              if (res.success) setRoleToken(res.roleToken);
              return res;
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
  },

  devices: {
    list: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<Device[]>({
          queryKey: ["devices.list"],
          queryFn: () => client.devices.list.query(),
          staleTime: 10000,
          ...options,
        }),
    },
    register: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) =>
        useMutation({
          mutationFn: async (input: { deviceLabel: string; userAgent?: string }) => {
            try {
              return await client.devices.register.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: options?.onSuccess,
          onError: options?.onError,
        }),
    },
  },

  reports: {
    businessStatements: {
      useQuery: (input?: { period?: "today" | "7_days" | "month" | "financial_year" | "custom"; startDate?: string; endDate?: string }, options?: any) =>
        useQuery<any>({
          queryKey: ["reports.businessStatements", input],
          queryFn: async () => toDisplayStatements(await client.reports.businessStatements.query(input)),
          ...options,
        }),
    },
  },

  dashboard: {
    stats: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<any>({
          queryKey: ["dashboard.stats"],
          queryFn: async () => toDisplayDashboardStats(await client.dashboard.stats.query()),
          ...options,
        }),
    },
  },

  products: {
    list: {
      useQuery: (input?: { search?: string; category?: string; serviceType?: string; status?: string }, options?: any) =>
        useQuery<Product[]>({
          queryKey: ["products.list", input],
          queryFn: () => client.products.list.query(input),
          staleTime: 5000,
          ...options,
        }),
    },
    activeList: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<Product[]>({
          queryKey: ["products.activeList"],
          queryFn: () => client.products.activeList.query(),
          staleTime: 5000,
          ...options,
        }),
    },
    create: {
      useMutation: (options?: { onSuccess?: (data: Product) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: {
            name: string;
            category: string;
            serviceType: string;
            price: number;
            status?: "Active" | "Inactive";
          }) => {
            try {
              return await client.products.create.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["products.list"] });
            qc.invalidateQueries({ queryKey: ["products.activeList"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    update: {
      useMutation: (options?: { onSuccess?: (data: Product) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: {
            id: string;
            name?: string;
            category?: string;
            serviceType?: string;
            price?: number;
            status?: "Active" | "Inactive";
          }) => {
            try {
              return await client.products.update.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["products.list"] });
            qc.invalidateQueries({ queryKey: ["products.activeList"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    toggleStatus: {
      useMutation: (options?: { onSuccess?: (data: Product) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { id: string }) => {
            try {
              return await client.products.toggleStatus.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["products.list"] });
            qc.invalidateQueries({ queryKey: ["products.activeList"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    delete: {
      useMutation: (options?: { onSuccess?: (data: { success: boolean; archived: boolean }) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { id: string }) => {
            try {
              return await client.products.delete.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["products.list"] });
            qc.invalidateQueries({ queryKey: ["products.activeList"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
  },

  recycleBin: {
    list: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<RecycleBinItem[]>({
          queryKey: ["recycleBin.list"],
          queryFn: () => client.recycleBin.list.query(),
          staleTime: 3000,
          ...options,
        }),
    },
    counts: {
      useQuery: (_input?: any, options?: any) =>
        useQuery<{ total: number; orders: number; customers: number; expenses: number }>({
          queryKey: ["recycleBin.counts"],
          queryFn: () => client.recycleBin.counts.query(),
          staleTime: 3000,
          ...options,
        }),
    },
    restore: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { type: RecycleBinItemType; id: string }) => {
            try {
              return await client.recycleBin.restore.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["recycleBin.list"] });
            qc.invalidateQueries({ queryKey: ["recycleBin.counts"] });
            qc.invalidateQueries({ queryKey: ["orders.list"] });
            qc.invalidateQueries({ queryKey: ["customers.list"] });
            qc.invalidateQueries({ queryKey: ["expenses.list"] });
            qc.invalidateQueries({ queryKey: ["dashboard.stats"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    deleteForever: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input: { type: RecycleBinItemType; id: string }) => {
            try {
              return await client.recycleBin.deleteForever.mutate(input);
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["recycleBin.list"] });
            qc.invalidateQueries({ queryKey: ["recycleBin.counts"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
    emptyBin: {
      useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (err: Error) => void }) => {
        const qc = useQueryClient();
        return useMutation({
          mutationFn: async (input?: { type?: "all" | "order" | "customer" | "expense" }) => {
            try {
              return await client.recycleBin.emptyBin.mutate(input || {});
            } catch (err) {
              throw new Error(errorMessage(err));
            }
          },
          onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["recycleBin.list"] });
            qc.invalidateQueries({ queryKey: ["recycleBin.counts"] });
            qc.invalidateQueries({ queryKey: ["orders.list"] });
            qc.invalidateQueries({ queryKey: ["customers.list"] });
            qc.invalidateQueries({ queryKey: ["expenses.list"] });
            qc.invalidateQueries({ queryKey: ["dashboard.stats"] });
            options?.onSuccess?.(data);
          },
          onError: options?.onError,
        });
      },
    },
  },
};

