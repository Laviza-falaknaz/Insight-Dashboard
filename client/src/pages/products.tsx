import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopPerformers } from "@/components/charts/top-performers";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ProductAnalysis } from "@shared/schema";

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Products() {
  const { data: productData, isLoading } = useQuery<ProductAnalysis>({
    queryKey: ["/api/insights/products"],
  });

  const topByRevenue = productData?.topByRevenue || [];
  const topByProfit = productData?.topByProfit || [];
  const productsByCategory = productData?.productsByCategory || [];

  const categoryRevenueData = productsByCategory.slice(0, 6).map((c, idx) => ({
    name: c.category,
    value: c.revenue,
    fill: COLORS[idx % COLORS.length],
  }));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-products-title">Product Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Product performance, profitability, and category insights
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Unique Products"
          value={(productData?.totalProducts || 0).toLocaleString()}
          icon={<Package className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(productData?.totalRevenue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Categories"
          value={(productsByCategory.length).toLocaleString()}
          icon={<Boxes className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Top Product Margin"
          value={formatPercent(topByRevenue[0]?.margin || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : topByRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topByRevenue.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="product" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No product data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : categoryRevenueData.length > 0 ? (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryRevenueData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={false}
                    >
                      {categoryRevenueData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-40 space-y-1">
                  {categoryRevenueData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span className="truncate">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TopPerformers
          data={topByRevenue.map(p => ({ name: p.product, revenue: p.revenue, profit: p.profit, units: p.units, count: p.units }))}
          title="Top by Revenue"
          valueKey="revenue"
          isLoading={isLoading}
        />
        <TopPerformers
          data={topByProfit.map(p => ({ name: p.product, revenue: p.revenue, profit: p.profit, units: p.units, count: p.units }))}
          title="Top by Profit"
          valueKey="profit"
          isLoading={isLoading}
        />
        <TopPerformers
          data={(productData?.topByVolume || []).map(p => ({ name: p.product, revenue: p.revenue, profit: 0, units: p.units, count: p.units }))}
          title="Top by Volume"
          valueKey="units"
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Category Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : productsByCategory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsByCategory.slice(0, 15).map((cat, idx) => {
                    const avgPrice = cat.units > 0 ? cat.revenue / cat.units : 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{cat.category}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {cat.products.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(cat.revenue)}
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
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No category data available
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Top Products Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : topByRevenue.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Product</TableHead>
                    <TableHead>Make</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topByRevenue.slice(0, 15).map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{p.product}</TableCell>
                      <TableCell className="text-muted-foreground">{p.make}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(p.revenue)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${p.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(p.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.margin >= 20 ? 'default' : p.margin >= 0 ? 'secondary' : 'destructive'}>
                          {formatPercent(p.margin)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {p.units.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No product data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
