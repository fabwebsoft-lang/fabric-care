export interface ShopBranch {
  id: string;
  name: string;
  shortName: string;
  address: string;
  city: string;
  tagline?: string;
  phone?: string;
}

export const SHOP_BRANCHES: ShopBranch[] = [
  {
    id: "pandian-nagar",
    name: "Branch 1 - Pandian Nagar",
    shortName: "Pandian Nagar",
    address: "17/B3, 1st street, Pandian Nagar, Dindigul",
    city: "Dindigul",
    tagline: "Associated with Dindigul Express",
    phone: "+91 98765 43210",
  },
  {
    id: "skt-dindigul",
    name: "Branch 2 - SKT Dindigul",
    shortName: "SKT Dindigul",
    address: "SKT Dindigul",
    city: "Dindigul",
    tagline: "Associated with Dindigul Express",
    phone: "+91 98765 43210",
  },
];

export const DEFAULT_BRANCH = SHOP_BRANCHES[0];

const STORAGE_KEY = "fabric_care_selected_branch_id";

export function getStoredBranchId(): string {
  if (typeof window === "undefined") return DEFAULT_BRANCH.id;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_BRANCH.id;
  } catch {
    return DEFAULT_BRANCH.id;
  }
}

export function saveStoredBranchId(branchId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, branchId);
  } catch {
    // ignore
  }
}

export function getBranchById(id?: string | null): ShopBranch {
  if (!id) return DEFAULT_BRANCH;
  const found = SHOP_BRANCHES.find(
    (b) => b.id === id || b.shortName.toLowerCase() === id.toLowerCase() || b.name.toLowerCase() === id.toLowerCase()
  );
  return found || DEFAULT_BRANCH;
}

export function getBranchByAddressOrName(addressOrName?: string | null): ShopBranch {
  if (!addressOrName) return DEFAULT_BRANCH;
  const clean = addressOrName.toLowerCase();
  if (clean.includes("skt")) {
    return SHOP_BRANCHES[1];
  }
  return SHOP_BRANCHES[0];
}
