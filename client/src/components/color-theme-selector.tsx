import { useAuth } from "@/lib/auth-context";
import { useColorTheme } from "@/lib/color-theme-context";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ColorThemeSelector() {
  const { user, updateTheme } = useAuth();
  const { themes, themeId, currentTheme } = useColorTheme();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (!user) return null;

  const handleThemeChange = async (newThemeId: string) => {
    try {
      await updateTheme(newThemeId);
    } catch (error) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
      setLocation("/login");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-1.5 px-2"
          data-testid="button-color-theme-selector"
        >
          <div className="flex gap-0.5">
            {currentTheme.colors.slice(0, 3).map((color, i) => (
              <div
                key={i}
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup
          value={themeId}
          onValueChange={handleThemeChange}
        >
          {Object.entries(themes).map(([id, theme]) => (
            <DropdownMenuRadioItem
              key={id}
              value={id}
              className="flex items-center gap-2 cursor-pointer"
              data-testid={`color-theme-option-${id}`}
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
              <span className="text-sm">{theme.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
