import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Palette, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { themePresets, type ThemePreset, type ThemeId } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function UserMenu() {
  const { user, logout, updateTheme } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: themes } = useQuery<Record<ThemeId, ThemePreset>>({
    queryKey: ["/api/themes"],
  });

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleThemeChange = async (themeId: string) => {
    try {
      await updateTheme(themeId);
    } catch (error) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
      setLocation("/login");
    }
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const currentTheme = themes?.[user.themeId as ThemeId] || themePresets.bootstrap;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-user-menu">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {getInitials(user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.isAdmin === "true" ? "Administrator" : "User"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="button-theme-selector">
            <Palette className="mr-2 h-4 w-4" />
            <span>Theme: {currentTheme.name}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={user.themeId || "bootstrap"}
              onValueChange={handleThemeChange}
            >
              {Object.entries(themes || themePresets).map(([id, theme]) => (
                <DropdownMenuRadioItem
                  key={id}
                  value={id}
                  className="flex items-center gap-2"
                  data-testid={`theme-option-${id}`}
                >
                  <div className="flex gap-1">
                    {theme.colors.map((color: string, i: number) => (
                      <div
                        key={i}
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span>{theme.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {user.isAdmin === "true" && (
          <DropdownMenuItem
            onClick={() => setLocation("/admin")}
            data-testid="button-admin-portal"
          >
            <Shield className="mr-2 h-4 w-4" />
            Admin Portal
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
