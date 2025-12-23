import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopPerformers } from "@/components/charts/top-performers";
import { CategoryChart } from "@/components/charts/category-chart";
import { KPICard } from "@/components/kpi-card";
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
import { Package, DollarSign, TrendingUp, Boxes } from "lucide-react";
import type { TopPerformer, CategoryBreakdown } from "@shared/schema";

interface ProductAnalytics {
  topProducts: TopPerformer[];
  categoryBreakdown: CategoryBreakdown[];
  totalProducts: number;
  totalRevenue: number;
  totalProfit: number;
  totalUnits: number;
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

export default function Products() {
  const { data, isLoading } = useQuery<ProductAnalytics>({
    queryKey: ["/api/analytics/products"],
  });

  const products = data?.topProducts || [];
  const categories = data?.categoryBreakdown || [];

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Product Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Product performance and category insights
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Unique Products"
          value={(data?.totalProducts || 0).toLocaleString()}
          icon={<Package className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(data?.totalRevenue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Profit"
          value={formatCurrency(data?.totalProfit || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Units"
          value={(data?.totalUnits || 0).toLocaleString()}
          icon={<Boxes className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CategoryChart data={categories} isLoading={isLoading} />
        <div className="grid grid-cols-1 gap-3">
          <TopPerformers
            data={products}
            title="Top Products by Revenue"
            valueKey="revenue"
            isLoading={isLoading}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Category Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.slice(0, 15).map((cat, idx) => {
                    const margin = cat.revenue > 0 
                      ? ((cat.profit / cat.revenue) * 100).toFixed(1) 
                      : "0.0";
                    const avgPrice = cat.units > 0 ? cat.revenue / cat.units : 0;
                    return (
                      <TableRow key={cat.category || idx}>
                        <TableCell className="font-medium">
                          {cat.category || "Unknown"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(cat.revenue)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm font-medium ${
                          cat.profit > 0 
                            ? "text-emerald-600 dark:text-emerald-400" 
                            : cat.profit < 0 
                            ? "text-red-600 dark:text-red-400" 
                            : ""
                        }`}>
                          {formatCurrency(cat.profit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(margin) >= 20 ? "default" : "secondary"}>
                            {margin}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {cat.units.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(avgPrice)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
