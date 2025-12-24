import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Globe, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface RegionData {
  region: string;
  revenue: number;
  profit: number;
  returnRate: number;
}

interface RegionalPerformanceProps {
  regions: RegionData[];
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

export function RegionalPerformance({ regions, isLoading }: RegionalPerformanceProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Regional Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = regions.reduce((sum, r) => sum + r.revenue, 0);
  const totalProfit = regions.reduce((sum, r) => sum + r.profit, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-500" />
          Regional Performance
        </CardTitle>
        <CardDescription>Revenue and profitability by region</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {regions.map((region) => {
          const revenueShare = totalRevenue > 0 ? (region.revenue / totalRevenue) * 100 : 0;
          const profitShare = totalProfit > 0 ? (region.profit / totalProfit) * 100 : 0;
          const margin = region.revenue > 0 ? (region.profit / region.revenue) * 100 : 0;
          const isHighReturn = region.returnRate > 10;
          
          return (
            <div key={region.region} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {region.region || 'Unknown'}
                  </Badge>
                  {isHighReturn && (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {margin > 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={margin > 0 ? 'text-emerald-600' : 'text-red-500'}>
                    {margin.toFixed(1)}% margin
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="font-medium">{formatCurrency(region.revenue)}</div>
                  <div className="text-muted-foreground">{revenueShare.toFixed(0)}% share</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Profit</div>
                  <div className={`font-medium ${region.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(region.profit)}
                  </div>
                  <div className="text-muted-foreground">{profitShare.toFixed(0)}% share</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Return Rate</div>
                  <div className={`font-medium ${region.returnRate > 10 ? 'text-red-500' : region.returnRate > 5 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {region.returnRate.toFixed(1)}%
                  </div>
                  <Progress value={Math.min(region.returnRate * 5, 100)} className="h-1 mt-1" />
                </div>
              </div>
            </div>
          );
        })}
        
        {regions.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-4">
            No regional data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
