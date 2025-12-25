import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

import CommandCenter from "@/pages/command-center";
import DataTablePage from "@/pages/data-table-page";
import Reports from "@/pages/reports";
import MyCollection from "@/pages/my-collection";
import Forecasts from "@/pages/forecasts";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

function MainLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-12 items-center justify-between gap-2 border-b px-3 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="text-sm font-medium text-muted-foreground">
                Circular Analytics
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <ScrollArea className="flex-1">
            <main className="min-h-full">
              {children}
            </main>
          </ScrollArea>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (location === "/login") {
    if (user) {
      return <Redirect to="/" />;
    }
    return <Login />;
  }

  if (location === "/admin") {
    return <Admin />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={CommandCenter} />
        <Route path="/forecasts" component={Forecasts} />
        <Route path="/explore" component={DataTablePage} />
        <Route path="/reports" component={Reports} />
        <Route path="/saved" component={MyCollection} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
