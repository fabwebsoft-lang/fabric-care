import { useAuth } from "@/hooks/useAuth";
import { Clock, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function ContactAdminScreen({ name }: { name?: string | null }) {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#F7F3EE] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 text-center space-y-5">
        <div className="size-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Clock className="size-7" />
        </div>

        <div>
          <h1 className="font-display text-lg font-bold text-[#0F4C5C]">
            {name ? `Welcome, ${name}` : "Almost there"}
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Your account has been created but doesn't have access to Fabric Care yet. An admin needs to
            approve your account and assign you a role before you can sign in.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-left text-xs text-amber-800 flex items-start gap-2">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>Contact your shop admin and ask them to approve your account from Roles &amp; Access. This page will unlock automatically once approved.</span>
        </div>

        <button
          onClick={async () => {
            try {
              await logout();
              toast.success("Signed out");
            } catch (err) {
              toast.error("Could not sign out", { description: err instanceof Error ? err.message : "Please try again." });
            }
          }}
          className="w-full py-2.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
        >
          <LogOut className="size-3.5" /> Sign Out
        </button>
      </div>
    </div>
  );
}
