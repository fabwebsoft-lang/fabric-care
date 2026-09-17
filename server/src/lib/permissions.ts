// Authoritative, server-enforced permission table.
// Mirrors src/contexts/AccessControlContext.tsx on the frontend, which should
// only be used for UI display now — actual enforcement happens here.
export type RoleName = "admin" | "manager" | "staff";

export interface RolePermissions {
  canViewReports: boolean;
  canDeleteOrders: boolean;
  canDeleteExpenses: boolean;
  canDeleteCustomers: boolean;
  canManageSettings: boolean;
  canManageRoles: boolean;
  canCreateOrders: boolean;
  canUpdateOrderStatus: boolean;
  canSettlePayments: boolean;
  canRecordExpenses: boolean;
}

export const ROLE_PERMISSIONS: Record<RoleName, RolePermissions> = {
  admin: {
    canViewReports: true,
    canDeleteOrders: true,
    canDeleteExpenses: true,
    canDeleteCustomers: true,
    canManageSettings: true,
    canManageRoles: true,
    canCreateOrders: true,
    canUpdateOrderStatus: true,
    canSettlePayments: true,
    canRecordExpenses: true,
  },
  manager: {
    canViewReports: false,
    canDeleteOrders: true,
    canDeleteExpenses: true,
    canDeleteCustomers: true,
    canManageSettings: false,
    canManageRoles: false,
    canCreateOrders: true,
    canUpdateOrderStatus: true,
    canSettlePayments: true,
    canRecordExpenses: true,
  },
  staff: {
    canViewReports: false,
    canDeleteOrders: false,
    canDeleteExpenses: false,
    canDeleteCustomers: false,
    canManageSettings: false,
    canManageRoles: false,
    canCreateOrders: true,
    canUpdateOrderStatus: true,
    canSettlePayments: true,
    canRecordExpenses: true,
  },
};
