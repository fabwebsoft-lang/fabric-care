import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AccessControlProvider } from "./contexts/AccessControlContext";
import Home from "./pages/Home";

const NotFound = lazy(() => import("@/pages/NotFound"));

function Router() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-white">
          <div className="size-8 animate-spin rounded-full border-3 border-[#0F4C5C] border-t-transparent" />
        </div>
      }
    >
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AccessControlProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AccessControlProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
