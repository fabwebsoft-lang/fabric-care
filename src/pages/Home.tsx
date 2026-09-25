import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthScreen from "@/components/AuthScreen";
import ContactAdminScreen from "@/components/ContactAdminScreen";

const AuthenticatedHome = lazy(() => import("./AuthenticatedHome"));

function PageLoadingSpinner() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-9 animate-spin rounded-full border-3 border-[#0F4C5C] border-t-transparent" />
        <span className="text-xs font-semibold text-[#0F4C5C]">Fabric Care</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) {
    return <PageLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (user?.role === "pending") {
    return <ContactAdminScreen name={user?.name} />;
  }

  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <AuthenticatedHome user={user} logout={logout} />
    </Suspense>
  );
}
