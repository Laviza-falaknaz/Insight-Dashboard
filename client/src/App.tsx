import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import Customers from "@/pages/customers";
import Products from "@/pages/products";
import Inventory from "@/pages/inventory";
import Profitability from "@/pages/profitability";
import Reports from "@/pages/reports";
import DataTablePage from "@/pages/data-table-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/customers" component={Customers} />
      <Route path="/products" component={Products} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/profitability" component={Profitability} />
      <Route path="/reports" component={Reports} />
      <Route path="/data-table" component={DataTablePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
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
                  <ThemeToggle />
                </header>
                <ScrollArea className="flex-1">
                  <main className="min-h-full">
                    <Router />
                  </main>
                </ScrollArea>
              </SidebarInset>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
