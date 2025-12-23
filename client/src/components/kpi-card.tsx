import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  isLoading,
  className,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <Minus className="h-3 w-3" />;
    if (trend > 0) return <TrendingUp className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return "text-muted-foreground";
    if (trend > 0) return "text-emerald-600 dark:text-emerald-400";
    return "text-red-600 dark:text-red-400";
  };

  if (isLoading) {
    return (
      <Card className={cn("p-4", className)}>
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1 truncate" data-testid={`kpi-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {trend !== undefined && (
                <span className={cn("flex items-center gap-0.5 text-xs font-medium", getTrendColor())}>
                  {getTrendIcon()}
                  {Math.abs(trend).toFixed(1)}%
                </span>
              )}
              {(subtitle || trendLabel) && (
                <span className="text-xs text-muted-foreground truncate">
                  {subtitle || trendLabel}
                </span>
              )}
            </div>
          </div>
          {icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
