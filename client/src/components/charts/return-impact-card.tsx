import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingDown, Package, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReturnImpactCardProps {
  unitsSold: number;
  unitsReturned: number;
  returnRate: number;
  revenueAtRisk: number;
  profitLost: number;
  grossProfit: number;
  netProfit: number;
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

export function ReturnImpactCard({
  unitsSold,
  unitsReturned,
  returnRate,
  profitLost,
  grossProfit,
  netProfit,
  isLoading,
}: ReturnImpactCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Return Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const profitErosion = grossProfit > 0 ? (profitLost / grossProfit) * 100 : 0;
  const severity = returnRate > 10 ? 'critical' : returnRate > 5 ? 'warning' : 'good';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${severity === 'critical' ? 'text-red-500' : severity === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`} />
            Return Impact Analysis
          </CardTitle>
          <Badge variant={severity === 'critical' ? 'destructive' : severity === 'warning' ? 'secondary' : 'default'} className="text-xs">
            {severity === 'critical' ? 'High Risk' : severity === 'warning' ? 'Monitor' : 'Healthy'}
          </Badge>
        </div>
        <CardDescription>How returns affect your profitability</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              Units Returned
            </div>
            <div className="text-lg font-semibold">{unitsReturned.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              of {unitsSold.toLocaleString()} sold
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3" />
              Return Rate
            </div>
            <div className={`text-lg font-semibold ${returnRate > 10 ? 'text-red-500' : returnRate > 5 ? 'text-amber-500' : 'text-emerald-600'}`}>
              {returnRate.toFixed(1)}%
            </div>
            <Progress 
              value={Math.min(returnRate * 5, 100)} 
              className="h-1.5"
            />
          </div>
        </div>
        
        <div className="pt-2 border-t space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Profit Lost to Returns
            </span>
            <span className="text-sm font-medium text-red-500">
              -{formatCurrency(profitLost)}
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Profit Erosion</span>
              <span className={profitErosion > 20 ? 'text-red-500' : 'text-muted-foreground'}>
                {profitErosion.toFixed(1)}% of gross profit
              </span>
            </div>
            <Progress value={Math.min(profitErosion, 100)} className="h-1.5" />
          </div>
          
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Net Profit After Returns</span>
            <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(netProfit)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
