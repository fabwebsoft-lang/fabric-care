import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAccessControl, UserRole, ROLE_DEFINITIONS } from "@/contexts/AccessControlContext";
import {
  ShieldCheck,
  Crown,
  Briefcase,
  UserCheck,
  Check,
  X,
  Plus,
  Trash2,
  KeyRound,
  AlertTriangle,
  Info,
  Sparkles,
  Users,
  EyeOff,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export default function RolesAndAccessView() {
  const { role: activeRole, canManageRoles, setRole, isSimulating, resetToAuthRole } = useAccessControl();
  const utils = trpc.useUtils();

  const { data: workers = [], isLoading } = trpc.workers.list.useQuery(undefined, { enabled: canManageRoles });
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerPhone, setNewWorkerPhone] = useState("");
  const [newWorkerRole, setNewWorkerRole] = useState<UserRole>("staff");

  const [pinWorkerId, setPinWorkerId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");

  const createWorkerMutation = trpc.workers.create.useMutation({
    onSuccess: async () => {
      await utils.workers.list.invalidate();
      setShowAddWorker(false);
      setNewWorkerName("");
      setNewWorkerPhone("");
      toast.success("Team member added successfully");
    },
    onError: (err) => toast.error("Failed to add worker", { description: err.message }),
  });

  const updateWorkerRoleMutation = trpc.workers.updateRole.useMutation({
    onSuccess: async () => {
      await utils.workers.list.invalidate();
      toast.success("Role updated successfully");
    },
    onError: (err) => toast.error("Failed to update role", { description: err.message }),
  });

  const deleteWorkerMutation = trpc.workers.delete.useMutation({
    onSuccess: async () => {
      await utils.workers.list.invalidate();
      toast.success("Team member removed");
    },
    onError: (err) => toast.error("Failed to remove worker", { description: err.message }),
  });

  const setPinMutation = trpc.workers.setPin.useMutation({
    onSuccess: async () => {
      await utils.workers.list.invalidate();
      setPinWorkerId(null);
      setPinInput("");
      toast.success("Worker PIN configured successfully");
    },
    onError: (err) => toast.error("Failed to set PIN", { description: err.message }),
  });

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;
    createWorkerMutation.mutate({
      name: newWorkerName.trim(),
      role: newWorkerRole,
    });
  };

  const handleSetPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinWorkerId || !pinInput) return;
    setPinMutation.mutate({
      workerId: pinWorkerId,
      pin: pinInput,
    });
  };

  const permissionsMatrix = [
    {
      feature: "Laundry Order Intake & Billing",
      description: "Create new bills, add clothes, and calculate estimates",
      admin: true,
      manager: true,
      staff: true,
    },
    {
      feature: "Active Process Workflow",
      description: "Move orders: Received ➔ Processing ➔ Ready ➔ Collected",
      admin: true,
      manager: true,
      staff: true,
    },
    {
      feature: "Customer Management",
      description: "Create & look up customer profiles and order histories",
      admin: true,
      manager: true,
      staff: true,
    },
    {
      feature: "Payment Collection & Due Settlement",
      description: "Record advance payments and mark collected dues",
      admin: true,
      manager: true,
      staff: true,
    },
    {
      feature: "Delete Records (Orders & Expenses)",
      description: "Delete erroneous bills, items, or expense entries",
      admin: true,
      manager: true,
      staff: false,
      tag: "Staff Restricted",
    },
    {
      feature: "View Financial Reports & Statements",
      description: "Daily revenue statements, profit/loss, and expense analytics",
      admin: true,
      manager: false,
      staff: false,
      tag: "Admin Only",
    },
    {
      feature: "Shop Settings & Cloud Backup",
      description: "Edit shop details, pricing tier, and download backups",
      admin: true,
      manager: false,
      staff: false,
      tag: "Admin Only",
    },
    {
      feature: "User Roles & Team Access",
      description: "Assign roles, manage staff PINs, and register counter devices",
      admin: true,
      manager: false,
      staff: false,
      tag: "Admin Only",
    },
  ];

  if (!canManageRoles) {
    return (
      <div className="max-w-2xl mx-auto my-6 sm:my-12 bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-xs text-center space-y-4">
        <div className="size-14 sm:size-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Lock className="size-7 sm:size-8" />
        </div>
        <div>
          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full uppercase">
            Access Restricted · {activeRole.toUpperCase()} Role
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-2.5">Roles & Access is Admin Only</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md mx-auto">
            Managing team roles, approving new sign-ups, and configuring staff PINs is restricted to the shop
            Admin. Contact your admin if you need a role change or a new team member approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl">
      {/* Header & Role Switcher Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#0F4C5C] flex items-center gap-2">
              <ShieldCheck className="size-5 sm:size-6 text-[#0F4C5C]" />
              User Roles & Access Control
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Configure role permissions, restrict staff deletions, hide financial reports from non-admins, and manage team access.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs self-start sm:self-auto">
            <span className="text-slate-500 font-medium">Active Mode:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] border ${ROLE_DEFINITIONS[activeRole].badgeColor}`}>
              {ROLE_DEFINITIONS[activeRole].name}
            </span>
          </div>
        </div>

        {/* Live Role Switcher */}
        <div className="bg-[#0F4C5C]/5 border border-[#0F4C5C]/20 p-3.5 sm:p-4 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#0F4C5C]" />
              <p className="text-xs font-bold text-[#0F4C5C]">
                Interactive Role Simulator (Preview App as Different Roles)
              </p>
            </div>
            {isSimulating && (
              <button
                onClick={resetToAuthRole}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium"
              >
                Reset to default
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <button
              onClick={() => {
                setRole("admin");
                toast.success("Switched to Admin Role", { description: "Full access across all reports, deletion, and settings." });
              }}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                activeRole === "admin"
                  ? "bg-white border-[#0F4C5C] ring-2 ring-[#0F4C5C]/20 shadow-xs"
                  : "bg-white/60 border-slate-200 hover:bg-white"
              }`}
            >
              <div className="size-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                <Crown className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Admin</span>
                  {activeRole === "admin" && <span className="size-2 rounded-full bg-purple-600" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Full financial reports & settings</p>
              </div>
            </button>

            <button
              onClick={() => {
                setRole("manager");
                toast.info("Switched to Manager Role", { description: "Full operations and deletion enabled. Financial reports are hidden." });
              }}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                activeRole === "manager"
                  ? "bg-white border-[#0F4C5C] ring-2 ring-[#0F4C5C]/20 shadow-xs"
                  : "bg-white/60 border-slate-200 hover:bg-white"
              }`}
            >
              <div className="size-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Briefcase className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Manager</span>
                  {activeRole === "manager" && <span className="size-2 rounded-full bg-blue-600" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Ops & deletions · Reports hidden</p>
              </div>
            </button>

            <button
              onClick={() => {
                setRole("staff");
                toast.info("Switched to Staff Role", { description: "Counter billing & status updates. Deletion restricted & reports hidden." });
              }}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                activeRole === "staff"
                  ? "bg-white border-[#0F4C5C] ring-2 ring-[#0F4C5C]/20 shadow-xs"
                  : "bg-white/60 border-slate-200 hover:bg-white"
              }`}
            >
              <div className="size-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <UserCheck className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Staff</span>
                  {activeRole === "staff" && <span className="size-2 rounded-full bg-emerald-600" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Counter billing only · Reports hidden</p>
              </div>
            </button>
          </div>

          <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg flex items-center gap-2">
            <Info className="size-4 text-[#0F4C5C] shrink-0" />
            <span className="text-[11px] leading-tight">
              <strong>Current Rule:</strong> {ROLE_DEFINITIONS[activeRole].description}
            </span>
          </div>
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#0F4C5C]" /> Feature Permissions Matrix
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500">Overview of access levels and restrictions enforced per role</p>
        </div>

        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[500px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 font-bold">
                <th className="py-2.5 px-3">Feature</th>
                <th className="py-2.5 px-3 text-center w-24 text-purple-800">
                  <div className="flex items-center justify-center gap-1">
                    <Crown className="size-3.5" /> Admin
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center w-24 text-blue-800">
                  <div className="flex items-center justify-center gap-1">
                    <Briefcase className="size-3.5" /> Manager
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center w-24 text-emerald-800">
                  <div className="flex items-center justify-center gap-1">
                    <UserCheck className="size-3.5" /> Staff
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionsMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition">
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-bold text-slate-800">{item.feature}</p>
                      {item.tag && (
                        <span className={`text-[9px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                          item.tag.includes("Admin") ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">{item.description}</p>
                  </td>

                  {/* Admin column */}
                  <td className="py-2.5 px-3 text-center">
                    {item.admin ? (
                      <span className="inline-flex size-5 sm:size-6 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center">
                        <Check className="size-3 sm:size-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="inline-flex size-5 sm:size-6 rounded-full bg-rose-100 text-rose-700 items-center justify-center">
                        <X className="size-3 sm:size-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </td>

                  {/* Manager column */}
                  <td className="py-2.5 px-3 text-center">
                    {item.manager ? (
                      <span className="inline-flex size-5 sm:size-6 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center">
                        <Check className="size-3 sm:size-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span className="inline-flex size-5 sm:size-6 rounded-full bg-rose-100 text-rose-700 items-center justify-center">
                          <EyeOff className="size-3 sm:size-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="text-[9px] text-rose-600 font-semibold">Hidden</span>
                      </div>
                    )}
                  </td>

                  {/* Staff column */}
                  <td className="py-2.5 px-3 text-center">
                    {item.staff ? (
                      <span className="inline-flex size-5 sm:size-6 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center">
                        <Check className="size-3 sm:size-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span className="inline-flex size-5 sm:size-6 rounded-full bg-rose-100 text-rose-700 items-center justify-center">
                          <Lock className="size-3 sm:size-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="text-[9px] text-rose-600 font-semibold">Blocked</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Member Role Assignments */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Users className="size-4 text-[#0F4C5C]" /> Team Member Role Assignment
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">Assign Admin, Manager, or Staff roles and counter login PINs</p>
          </div>
          <button
            onClick={() => setShowAddWorker(true)}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-[#0F4C5C] text-white text-xs font-semibold rounded-xl hover:bg-[#0F4C5C]/90 transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
          >
            <Plus className="size-3.5" /> Add Member
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-slate-400 text-xs">Loading team members...</div>
        ) : workers.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No workers added yet.</p>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {workers.map((w: any) => {
              const currentRoleKey: UserRole = w.role === "admin" ? "admin" : w.role === "manager" ? "manager" : "staff";
              const isPending = w.role === "pending";

              if (isPending) {
                return (
                  <div
                    key={w.id}
                    className="border border-amber-200 p-3.5 sm:p-4 rounded-xl flex flex-col justify-between text-xs bg-amber-50/60 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{w.name}</p>
                        <p className="text-slate-500 text-[11px]">{w.email}</p>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                        Pending Approval
                      </span>
                    </div>

                    <div className="pt-2 border-t border-amber-200/70 space-y-1.5">
                      <p className="text-[10px] font-semibold text-slate-600">Approve as:</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updateWorkerRoleMutation.mutate({ workerId: w.id, role: "admin" })}
                          className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-purple-700 hover:bg-purple-50 transition text-[11px]"
                        >
                          👑 Admin
                        </button>
                        <button
                          onClick={() => updateWorkerRoleMutation.mutate({ workerId: w.id, role: "manager" })}
                          className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-blue-700 hover:bg-blue-50 transition text-[11px]"
                        >
                          👔 Manager
                        </button>
                        <button
                          onClick={() => updateWorkerRoleMutation.mutate({ workerId: w.id, role: "staff" })}
                          className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-emerald-700 hover:bg-emerald-50 transition text-[11px]"
                        >
                          👷 Staff
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Reject and remove ${w.name}'s signup request?`)) {
                            deleteWorkerMutation.mutate({ workerId: w.id });
                          }
                        }}
                        className="w-full py-1.5 text-slate-500 hover:text-rose-600 transition text-[10px] font-semibold"
                      >
                        Reject request
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={w.id}
                  className="border border-slate-200/80 p-3.5 sm:p-4 rounded-xl flex flex-col justify-between text-xs bg-slate-50/50 hover:bg-slate-50 transition space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{w.name}</p>
                      <p className="text-slate-500 text-[11px]">{w.email || "PIN-only · no login"}</p>
                    </div>

                    <select
                      value={currentRoleKey}
                      onChange={(e) => {
                        const newRole = e.target.value as UserRole;
                        updateWorkerRoleMutation.mutate({
                          workerId: w.id,
                          role: newRole,
                        });
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
                    >
                      <option value="admin">👑 Admin</option>
                      <option value="manager">👔 Manager</option>
                      <option value="staff">👷 Staff</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                    <div className="flex items-center gap-1">
                      {w.hasPin ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="size-3" /> PIN Protected
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="size-3" /> No PIN
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPinWorkerId(w.id)}
                        className="px-2 py-1 bg-white border border-slate-200 text-[#0F4C5C] font-semibold rounded-lg hover:bg-slate-100 transition flex items-center gap-1 text-[11px]"
                      >
                        <KeyRound className="size-3" /> {w.hasPin ? "Change PIN" : "Set PIN"}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Remove ${w.name} from the team?`)) {
                            deleteWorkerMutation.mutate({ workerId: w.id });
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                        title="Remove member"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
          <form onSubmit={handleAddWorker} className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#0F4C5C]">Add Team Member</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">Configure member name, contact, and system access role</p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
              <input
                type="text"
                value={newWorkerPhone}
                onChange={(e) => setNewWorkerPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Access Role</label>
              <select
                value={newWorkerRole}
                onChange={(e) => setNewWorkerRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] font-medium"
              >
                <option value="staff">👷 Staff (Counter Ops, No Reports, No Deletions)</option>
                <option value="manager">👔 Manager (Full Ops & Deletions, No Reports)</option>
                <option value="admin">👑 Admin (Full Master Access & Reports)</option>
              </select>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddWorker(false)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createWorkerMutation.isPending}
                className="flex-1 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs"
              >
                {createWorkerMutation.isPending ? "Adding..." : "Save Member"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Set PIN Modal */}
      {pinWorkerId && (
        <div className="fixed inset-0 z-50 bg-[#0F4C5C]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen">
          <form onSubmit={handleSetPin} className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#0F4C5C]">Set Worker Security PIN</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">Enter a 4 to 6 digit security PIN for this team member</p>

            <input
              type="password"
              maxLength={6}
              required
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="e.g. 1234"
              className="w-full px-3 py-2.5 text-center font-mono text-lg tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
            />

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPinWorkerId(null);
                  setPinInput("");
                }}
                className="flex-1 py-2.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={setPinMutation.isPending}
                className="flex-1 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 transition shadow-xs"
              >
                {setPinMutation.isPending ? "Saving..." : "Save PIN"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
