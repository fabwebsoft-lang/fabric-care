import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Lock, Mail, LogIn, Eye, EyeOff } from "lucide-react";

export default function LoginScreen({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onError: (err) => toast.error("Could not sign in", { description: err.message }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#0F4C5C]">
            <img
              src="/fabric-care-logo.png"
              alt="Fabric Care logo"
              width="28"
              height="28"
              fetchPriority="high"
              loading="eager"
              className="size-7 object-contain"
            />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-[#0F4C5C]">Fabric Care</h1>
            <p className="text-xs text-slate-500 mt-0.5">Sign in to manage your shop</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3 py-3 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-[#0F4C5C] transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-[#0F4C5C] transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] grid place-items-center text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C5C] rounded-lg transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full min-h-[44px] py-3 bg-[#0F4C5C] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#0F4C5C]/90 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] focus-visible:ring-offset-2 transition shadow-xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <LogIn className="size-4" aria-hidden="true" />
            {loginMutation.isPending ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <button
          type="button"
          onClick={onSwitchToSignup}
          className="w-full min-h-[44px] py-2 text-center text-xs font-semibold text-[#0F4C5C] hover:underline focus-visible:ring-2 focus-visible:ring-[#0F4C5C] rounded-lg cursor-pointer"
        >
          Don't have an account? Sign up
        </button>
      </div>
    </main>
  );
}
