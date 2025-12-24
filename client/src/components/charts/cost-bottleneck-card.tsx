import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface CostBottleneck {
  category: string;
  units: number;
  revenue: number;
  purchaseCost: number;
  partsCost: number;
  freightCost: number;
  laborCost: number;
  packagingCost: number;
  otherCosts: number;
  totalCost: number;
  margin: number;
}

interface HighCostProduct {
  product: string;
  units: number;
  revenue: number;
  totalCost: number;
  costRatio: number;
  margin: number;
}

interface Props {
  costBottlenecks?: CostBottleneck[];
  highCostProducts?: HighCostProduct[];
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function CostBottleneckCard({ costBottlenecks, highCostProducts, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = costBottlenecks?.slice(0, 8).map(c => ({
    name: c.category.length > 10 ? c.category.substring(0, 10) + '...' : c.category,
    fullName: c.category,
    purchase: c.purchaseCost,
    parts: c.partsCost,
    freight: c.freightCost,
    labor: c.laborCost,
    other: c.packagingCost + c.otherCosts,
    margin: c.margin,
  })) || [];

  const lowMarginCategories = costBottlenecks?.filter(c => c.margin < 20) || [];
  const negativeMarginProducts = highCostProducts?.filter(p => p.margin < 0) || [];

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Cost Bottleneck Analysis
            </CardTitle>
            <CardDescription>Cost breakdown by category and margin-eroding products</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {lowMarginCategories.length > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                <TrendingDown className="h-3 w-3 mr-1" />
                {lowMarginCategories.length} low margin
              </Badge>
            )}
            {negativeMarginProducts.length > 0 && (
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {negativeMarginProducts.length} losing money
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Cost Distribution by Category</h4>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="purchase" stackId="a" fill="#6366f1" name="Purchase" />
                  <Bar dataKey="parts" stackId="a" fill="#8b5cf6" name="Parts" />
                  <Bar dataKey="freight" stackId="a" fill="#a855f7" name="Freight" />
                  <Bar dataKey="labor" stackId="a" fill="#f59e0b" name="Labor" />
                  <Bar dataKey="other" stackId="a" fill="#94a3b8" name="Other" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No cost data available
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">High Cost Ratio Products</h4>
            {highCostProducts && highCostProducts.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {highCostProducts.slice(0, 8).map((product, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 rounded-md border ${product.margin < 0 ? 'border-red-500/30 bg-red-500/5' : 'border-border'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate" title={product.product}>
                          {product.product}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.units} units
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-medium ${product.margin < 0 ? 'text-red-500' : product.margin < 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {product.margin.toFixed(1)}% margin
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.costRatio.toFixed(0)}% cost ratio
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>Rev: {formatCurrency(product.revenue)}</span>
                      <span>Cost: {formatCurrency(product.totalCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No high-cost products identified
              </div>
            )}
          </div>
        </div>

        {lowMarginCategories.length > 0 && (
          <div className="mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Cost Pressure Alert
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lowMarginCategories.length} categories have margins below 20%. Top issue: {lowMarginCategories[0]?.category} at {lowMarginCategories[0]?.margin.toFixed(1)}% margin.
              Review pricing strategy or negotiate better supplier terms.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
