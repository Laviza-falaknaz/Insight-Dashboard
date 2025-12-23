import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/kpi-card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { TopPerformers } from "@/components/charts/top-performers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react";
import type { DashboardData, CategoryBreakdown } from "@shared/schema";

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export default function Profitability() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  const categories = data?.categoryBreakdown || [];
  const sortedByMargin = [...categories]
    .map(c => ({
      ...c,
      margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0
    }))
    .sort((a, b) => b.margin - a.margin);

  const highMarginCategories = sortedByMargin.filter(c => c.margin >= 20).slice(0, 5);
  const lowMarginCategories = sortedByMargin.filter(c => c.margin < 20 && c.margin >= 0).slice(-5).reverse();
  const negativeMarginCategories = sortedByMargin.filter(c => c.margin < 0);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Profitability Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Deep dive into profit margins and cost analysis
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(data?.kpis.totalRevenue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Cost"
          value={formatCurrency(data?.kpis.totalCost || 0)}
          icon={<TrendingDown className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Gross Profit"
          value={formatCurrency(data?.kpis.totalProfit || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Profit Margin"
          value={`${(data?.kpis.profitMargin || 0).toFixed(1)}%`}
          icon={<Percent className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      <RevenueChart data={data?.revenueOverTime || []} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              High Margin Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {highMarginCategories.map((cat, idx) => (
                  <div key={cat.category || idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{cat.category}</span>
                      <Badge variant="default" className="shrink-0">
                        {cat.margin.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={cat.margin} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Revenue: {formatCurrency(cat.revenue)}</span>
                      <span>Profit: {formatCurrency(cat.profit)}</span>
                    </div>
                  </div>
                ))}
                {highMarginCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No high margin categories found
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Low Margin Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {lowMarginCategories.map((cat, idx) => (
                  <div key={cat.category || idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{cat.category}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {cat.margin.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={Math.max(cat.margin, 0)} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Revenue: {formatCurrency(cat.revenue)}</span>
                      <span>Profit: {formatCurrency(cat.profit)}</span>
                    </div>
                  </div>
                ))}
                {lowMarginCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No low margin categories found
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {negativeMarginCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Negative Margin Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Loss</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negativeMarginCategories.slice(0, 10).map((cat, idx) => (
                    <TableRow key={cat.category || idx}>
                      <TableCell className="font-medium">{cat.category}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(cat.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(cat.revenue - cat.profit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400 font-medium">
                        {formatCurrency(cat.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">
                          {cat.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TopPerformers
          data={data?.topCustomers || []}
          title="Most Profitable Customers"
          valueKey="profit"
          isLoading={isLoading}
        />
        <TopPerformers
          data={data?.topProducts || []}
          title="Most Profitable Products"
          valueKey="profit"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
