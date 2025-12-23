import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { TopPerformer } from "@shared/schema";

interface TopPerformersProps {
  data: TopPerformer[];
  title: string;
  isLoading?: boolean;
  valueKey?: "revenue" | "profit" | "units";
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function TopPerformers({
  data,
  title,
  isLoading,
  valueKey = "revenue",
}: TopPerformersProps) {
  const maxValue = Math.max(...data.map((item) => item[valueKey]), 1);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.slice(0, 5).map((item, index) => (
          <div key={item.name || index} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate flex-1" title={item.name}>
                {item.name || "Unknown"}
              </span>
              <span className="text-sm font-semibold text-muted-foreground shrink-0">
                {valueKey === "units" 
                  ? item.units.toLocaleString() 
                  : formatCurrency(item[valueKey])}
              </span>
            </div>
            <Progress 
              value={(item[valueKey] / maxValue) * 100} 
              className="h-1.5"
            />
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
