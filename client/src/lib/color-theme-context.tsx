import { createContext, useContext, useEffect } from "react";
import { useAuth } from "./auth-context";
import { useQuery } from "@tanstack/react-query";
import { themePresets, type ThemePreset, type ThemeId } from "@shared/schema";

interface ColorThemeContextType {
  currentTheme: ThemePreset;
  themeId: ThemeId;
  themes: Record<ThemeId, ThemePreset>;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function applyThemeColors(colors: string[]) {
  const root = document.documentElement;
  const [primary, info, success, warning, danger] = colors;

  const primaryHSL = hexToHSL(primary);
  const infoHSL = hexToHSL(info);
  const successHSL = hexToHSL(success);
  const warningHSL = hexToHSL(warning);
  const dangerHSL = hexToHSL(danger);

  root.style.setProperty("--primary", `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`);
  root.style.setProperty("--primary-foreground", `${primaryHSL.h} ${primaryHSL.s}% 98%`);
  root.style.setProperty("--ring", `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`);
  root.style.setProperty("--sidebar-primary", `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`);
  root.style.setProperty("--sidebar-ring", `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`);

  root.style.setProperty("--chart-1", `${primaryHSL.h} ${primaryHSL.s}% ${Math.min(primaryHSL.l + 10, 70)}%`);
  root.style.setProperty("--chart-2", `${successHSL.h} ${successHSL.s}% ${Math.min(successHSL.l + 10, 70)}%`);
  root.style.setProperty("--chart-3", `${infoHSL.h} ${infoHSL.s}% ${Math.min(infoHSL.l + 10, 70)}%`);
  root.style.setProperty("--chart-4", `${warningHSL.h} ${warningHSL.s}% ${Math.min(warningHSL.l + 10, 70)}%`);
  root.style.setProperty("--chart-5", `${dangerHSL.h} ${dangerHSL.s}% ${Math.min(dangerHSL.l + 10, 70)}%`);

  root.style.setProperty("--destructive", `${dangerHSL.h} ${dangerHSL.s}% ${dangerHSL.l}%`);
}

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data: themes } = useQuery<Record<ThemeId, ThemePreset>>({
    queryKey: ["/api/themes"],
  });

  const themeId = (user?.themeId as ThemeId) || "bootstrap";
  const allThemes = themes || themePresets;
  const currentTheme = allThemes[themeId] || themePresets.bootstrap;

  useEffect(() => {
    if (currentTheme?.colors) {
      applyThemeColors([...currentTheme.colors]);
    }
  }, [themeId, currentTheme]);

  return (
    <ColorThemeContext.Provider value={{ currentTheme, themeId, themes: allThemes }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (context === undefined) {
    throw new Error("useColorTheme must be used within a ColorThemeProvider");
  }
  return context;
}
