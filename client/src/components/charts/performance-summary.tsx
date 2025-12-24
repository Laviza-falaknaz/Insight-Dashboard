import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Star, AlertTriangle, Users, Package } from "lucide-react";

interface PerformanceSummaryProps {
  topCategory: { name: string; profit: number; margin: number };
  worstCategory: { name: string; profit: number; margin: number };
  topCustomer: { name: string; revenue: number; margin: number };
  highestReturnProduct: { name: string; returnRate: number; lostProfit: number };
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function PerformanceSummary({
  topCategory,
  worstCategory,
  topCustomer,
  highestReturnProduct,
  isLoading,
}: PerformanceSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Performance Highlights</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Performance Highlights</CardTitle>
        <CardDescription>Key performers and areas of concern</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-200/50">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">Top Category</span>
            </div>
            <div className="text-sm font-semibold truncate" title={topCategory.name}>
              {topCategory.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-muted-foreground">
                {formatCurrency(topCategory.profit)} profit
              </span>
              <Badge variant="secondary" className="text-xs">
                {topCategory.margin.toFixed(1)}%
              </Badge>
            </div>
          </div>
          
          <div className="p-3 rounded-md bg-red-500/5 border border-red-200/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-red-700">Lowest Category</span>
            </div>
            <div className="text-sm font-semibold truncate" title={worstCategory.name}>
              {worstCategory.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formatCurrency(worstCategory.profit)} profit
              </span>
              <Badge variant={worstCategory.margin < 0 ? 'destructive' : 'secondary'} className="text-xs">
                {worstCategory.margin.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="pt-2 border-t space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-xs text-muted-foreground">Top Customer</div>
                <div className="text-sm font-medium truncate max-w-[150px]" title={topCustomer.name}>
                  {topCustomer.name}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{formatCurrency(topCustomer.revenue)}</div>
              <div className="text-xs text-muted-foreground">{topCustomer.margin.toFixed(1)}% margin</div>
            </div>
          </div>
          
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <div>
                <div className="text-xs text-muted-foreground">Highest Return Product</div>
                <div className="text-sm font-medium truncate max-w-[150px]" title={highestReturnProduct.name}>
                  {highestReturnProduct.name || 'N/A'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-amber-600">{highestReturnProduct.returnRate.toFixed(1)}% return</div>
              <div className="text-xs text-red-500">-{formatCurrency(highestReturnProduct.lostProfit)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
