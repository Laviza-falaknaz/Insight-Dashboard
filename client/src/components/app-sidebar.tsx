import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Search,
  FileBarChart,
  BookmarkCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Command Center",
    icon: LayoutDashboard,
    url: "/",
    description: "Executive overview",
  },
  {
    title: "Explore Data",
    icon: Search,
    url: "/explore",
    description: "Deep dive analysis",
  },
  {
    title: "Reports",
    icon: FileBarChart,
    url: "/reports",
    description: "Export & share",
  },
  {
    title: "Saved Queries",
    icon: BookmarkCheck,
    url: "/saved",
    description: "Your collections",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">Circular Analytics</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Executive Suite</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    tooltip={item.title}
                    className="h-11"
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground">{item.description}</span>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="text-[10px] text-muted-foreground text-center">
          <span className="block">Circular Inventory System</span>
          <span className="block opacity-60">v2.0 Executive Edition</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
