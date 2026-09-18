import { useState, useMemo } from "react";
import { trpc, type Product } from "@/lib/trpc";
import {
  Shirt,
  Search,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Tag,
  Filter,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Archive,
  ArrowUpDown,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Men's Wear", "Women's Wear", "Kids Wear", "Household", "Other"] as const;
const SERVICE_TYPES = ["Wash & Fold", "Wash & Iron", "Dry Clean", "Iron Only", "Steam Iron", "Other"] as const;

export default function ProductsView({ onNewOrder }: { onNewOrder?: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const utils = trpc.useUtils();
  const { data: products = [], isLoading } = trpc.products.list.useQuery();

  const toggleStatusMutation = trpc.products.toggleStatus.useMutation({
    onSuccess: (updated) => {
      utils.products.list.invalidate();
      utils.products.activeList.invalidate();
      toast.success(`${updated.name} is now ${updated.status}`, {
        description: updated.status === "Active" ? "Item is now selectable in New Orders" : "Item hidden from New Order selection",
      });
    },
    onError: (err) => {
      toast.error("Could not update status", { description: err.message });
    },
  });

  const deleteProductMutation = trpc.products.delete.useMutation({
    onSuccess: (res) => {
      utils.products.list.invalidate();
      utils.products.activeList.invalidate();
      setDeletingProduct(null);
      if (res.archived) {
        toast.info("Item archived safely", {
          description: "This item was used in past orders and has been safely archived to preserve historical bills.",
        });
      } else {
        toast.success("Item deleted permanently");
      }
    },
    onError: (err) => {
      toast.error("Could not delete item", { description: err.message });
    },
  });

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      const matchesService = serviceFilter === "All" || p.serviceType === serviceFilter;
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesCategory && matchesService && matchesStatus;
    });
  }, [products, searchQuery, categoryFilter, serviceFilter, statusFilter]);

  const activeCount = products.filter((p) => p.status === "Active").length;
  const inactiveCount = products.filter((p) => p.status === "Inactive").length;
  const avgPrice = products.length > 0 ? Math.round(products.reduce((acc, p) => acc + p.price, 0) / products.length) : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
            <Shirt className="size-5 sm:size-6 text-[#0F4C5C]" />
            Products & Laundry Services
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Manage catalog items, service categories, pricing rates, and active New Order availability
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingProduct(null);
              setIsAddModalOpen(true);
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Plus className="size-4" strokeWidth={2.5} /> Add Item
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Items</span>
          <p className="font-display text-xl sm:text-2xl font-bold text-[#0F4C5C] mt-1">{products.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">All catalog entries</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Active in Orders</span>
          <p className="font-display text-xl sm:text-2xl font-bold text-emerald-800 mt-1">{activeCount}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Selectable in New Order</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Inactive Items</span>
          <p className="font-display text-xl sm:text-2xl font-bold text-slate-700 mt-1">{inactiveCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Hidden from counter</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3.5 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Average Rate</span>
          <p className="font-display text-xl sm:text-2xl font-bold text-amber-800 mt-1">₹{avgPrice}</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Across all services</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product by name (e.g. Pant, Saree)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20 focus:border-[#0F4C5C]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full md:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Service filter */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full md:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]/20"
            >
              <option value="All">All Services</option>
              {SERVICE_TYPES.map((srv) => (
                <option key={srv} value={srv}>{srv}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
          {(["All", "Active", "Inactive"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#0F4C5C] text-white shadow-2xs font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st}
              {st === "Active" && ` (${activeCount})`}
              {st === "Inactive" && ` (${inactiveCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table & Responsive Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <div className="size-6 animate-spin rounded-full border-2 border-[#0F4C5C] border-t-transparent" />
            <span>Loading products catalog...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <ShoppingBag className="size-6" />
            </div>
            <p className="text-sm font-bold text-[#0F4C5C]">No products found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || categoryFilter !== "All" || serviceFilter !== "All" || statusFilter !== "All"
                ? "Try adjusting your search query or filters to find items."
                : "Get started by adding your first laundry item to the catalog."}
            </p>
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsAddModalOpen(true);
              }}
              className="mt-4 px-4 py-2 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus className="size-4" /> Add Item Now
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#F7F3EE]/60 text-[10px] font-bold uppercase tracking-wider text-[#0F4C5C]">
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Service Type</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 place-items-center rounded-xl bg-[#F7F3EE] text-[#0F4C5C]">
                            <Shirt className="size-4" />
                          </div>
                          <div>
                            <p className="font-bold text-[#0F4C5C] text-xs">{product.name}</p>
                            <span className="text-[10px] text-slate-400">ID: {product.id.slice(-6)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-700 text-[11px]">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0F4C5C]/10 font-bold text-[#0F4C5C] text-[11px]">
                          {product.serviceType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-display text-sm font-bold text-[#0F4C5C]">
                          ₹{product.price}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleStatusMutation.mutate({ id: product.id })}
                          disabled={toggleStatusMutation.isPending}
                          className="group inline-flex items-center gap-1.5 focus:outline-none"
                          title="Click to toggle status"
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                              product.status === "Active"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200 group-hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                product.status === "Active" ? "bg-emerald-600 animate-pulse" : "bg-slate-400"
                              }`}
                            />
                            {product.status}
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        {new Date(product.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F4C5C] hover:bg-[#F7F3EE] transition"
                            title="Edit Item"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingProduct(product)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete or Archive Item"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <div key={product.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-9 place-items-center rounded-xl bg-[#F7F3EE] text-[#0F4C5C] shrink-0">
                        <Shirt className="size-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[#0F4C5C] text-sm">{product.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {product.category}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0F4C5C]/10 text-[#0F4C5C] font-bold">
                            {product.serviceType}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="font-display text-base font-bold text-[#0F4C5C]">
                      ₹{product.price}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-xs">
                    <button
                      onClick={() => toggleStatusMutation.mutate({ id: product.id })}
                      disabled={toggleStatusMutation.isPending}
                      className="inline-flex items-center gap-1"
                    >
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          product.status === "Active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${product.status === "Active" ? "bg-emerald-600" : "bg-slate-400"}`} />
                        {product.status}
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setIsAddModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#0F4C5C] bg-[#F7F3EE] hover:bg-[#0F4C5C] hover:text-white transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingProduct(product)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            setIsAddModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}

      {/* Safe Delete / Archive Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0F4C5C]/50 px-4 py-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="size-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3.5">
              <AlertCircle className="size-5" />
            </div>
            <h3 className="font-display text-base font-bold text-[#0F4C5C]">
              Delete "{deletingProduct.name}"?
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              If this item is already used in historical orders, it will be safely archived and deactivated so existing bills are never broken.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteProductMutation.isPending}
                onClick={() => deleteProductMutation.mutate({ id: deletingProduct.id })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-50"
              >
                {deleteProductMutation.isPending ? "Processing..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductFormModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(product);
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState<string>(product?.category || "Men's Wear");
  const [serviceType, setServiceType] = useState<string>(product?.serviceType || "Wash & Iron");
  const [price, setPrice] = useState<string>(product ? String(product.price) : "");
  const [status, setStatus] = useState<"Active" | "Inactive">(product?.status || "Active");

  const createMutation = trpc.products.create.useMutation({
    onSuccess: (created) => {
      toast.success(`${created.name} added to catalog`, {
        description: `₹${created.price} · Available in New Orders`,
      });
      onSuccess();
    },
    onError: (err) => {
      toast.error("Could not create item", { description: err.message });
    },
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: (updated) => {
      toast.success(`${updated.name} updated`, {
        description: `New price: ₹${updated.price} · Applied to future orders`,
      });
      onSuccess();
    },
    onError: (err) => {
      toast.error("Could not update item", { description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please enter a valid price greater than 0");
      return;
    }

    if (isEditing && product) {
      updateMutation.mutate({
        id: product.id,
        name: name.trim(),
        category: category as any,
        serviceType: serviceType as any,
        price: priceNum,
        status,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        category: category as any,
        serviceType: serviceType as any,
        price: priceNum,
        status,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F4C5C]/50 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-center min-h-screen">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#0F4C5C]/20 bg-[#0F4C5C] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-white/10 text-white">
              <Shirt className="size-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold">
                {isEditing ? `Edit ${product?.name}` : "Add New Item"}
              </h3>
              <p className="text-[11px] text-white/80">
                {isEditing ? "Modify price or service details" : "Add a new garment or service to the catalog"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-bold text-[#0F4C5C]">Item Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Pant, Shirt, Saree, Blanket"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-[#0F4C5C]">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-[#0F4C5C]">Service Type *</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
              >
                {SERVICE_TYPES.map((srv) => (
                  <option key={srv} value={srv}>{srv}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-[#0F4C5C]">Price (₹) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
              <input
                type="number"
                required
                min="1"
                step="1"
                placeholder="80"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3.5 py-2 text-xs font-bold text-[#0F4C5C] focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Default rate loaded automatically when added to a bill.</p>
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-[#0F4C5C]">Status</label>
            <div className="flex rounded-xl border border-slate-300 bg-[#F7F3EE] p-1">
              <button
                type="button"
                onClick={() => setStatus("Active")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  status === "Active" ? "bg-[#0F4C5C] text-white shadow-xs" : "text-[#0F4C5C]"
                }`}
              >
                Active (In New Orders)
              </button>
              <button
                type="button"
                onClick={() => setStatus("Inactive")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  status === "Inactive" ? "bg-[#0F4C5C] text-white shadow-xs" : "text-[#0F4C5C]"
                }`}
              >
                Inactive (Hidden)
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0F4C5C] hover:bg-[#0F4C5C]/90 shadow-md transition disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {isPending ? (
                "Saving..."
              ) : (
                <>
                  <Check className="size-3.5" strokeWidth={2.5} />
                  {isEditing ? "Save Changes" : "Save Item"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
