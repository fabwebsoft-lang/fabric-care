export type OrderStatus = "Received" | "Processing" | "Ready" | "Collected";
export type CustomerType = "Normal" | "Premium";
export type DeliveryType = "Shop Collection" | "Home Delivery";
export type UserRole = "admin" | "manager" | "staff" | "owner" | "worker";

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  clothTags?: string[];
}

export interface Order {
  id: string;
  customerId?: string | null;
  customer: string;
  phone: string;
  customerType?: CustomerType;
  clothesCode?: string | null;
  items: string;
  amount: string;
  balance: string;
  status: OrderStatus;
  deliveryType: DeliveryType | null;
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
}

export interface Customer {
  id: string;
  customerId?: string | null;
  name: string;
  phone: string;
  customerType?: CustomerType;
  address: string | null;
  alternatePhone: string | null;
  notes: string | null;
  storedClothesCode?: string | null;
  orderCount: number;
  totalSpent: string;
  pendingBalance: string;
  pendingBalanceRaw: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: string;
  paymentMethod: string;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
}

export interface Shop {
  id: number;
  name: string;
  address: string;
  customerNotifications: number;
  pricingTier: string;
  shopCode: string;
  lastBackupAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  role: UserRole;
  active: number;
  hasPin: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  deviceLabel: string;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: "Men's Wear" | "Women's Wear" | "Kids Wear" | "Household" | "Other" | string;
  serviceType: "Wash & Fold" | "Wash & Iron" | "Dry Clean" | "Iron Only" | "Steam Iron" | "Other" | string;
  price: number;
  status: "Active" | "Inactive";
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

