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
import { Progress } from "@/components/ui/progress";
import { Users, DollarSign, TrendingUp, Package, AlertTriangle, Percent } from "lucide-react";
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
import type { CustomerAnalysis } from "@shared/schema";

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

export default function Customers() {
  const { data: customerData, isLoading } = useQuery<CustomerAnalysis>({
    queryKey: ["/api/insights/customers"],
  });

  const topByRevenue = customerData?.topByRevenue || [];
  const topByProfit = customerData?.topByProfit || [];
  const topByVolume = customerData?.topByVolume || [];

  const top5RevenueShare = topByRevenue.slice(0, 5).map((c, idx) => ({
    name: c.customer,
    value: c.revenue,
    fill: COLORS[idx % COLORS.length],
  }));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-customers-title">Customer Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Customer revenue, profitability, and concentration insights
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Customers"
          value={(customerData?.totalCustomers || 0).toLocaleString()}
          icon={<Users className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(customerData?.totalRevenue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Avg Revenue/Customer"
          value={formatCurrency(customerData?.averageRevenuePerCustomer || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Top 5 Concentration"
          value={formatPercent(customerData?.customerConcentration || 0)}
          icon={<Percent className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      {(customerData?.customerConcentration || 0) > 50 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Customer Concentration Risk</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Top 5 customers account for {formatPercent(customerData?.customerConcentration || 0)} of total revenue. 
                  Consider diversifying customer base to reduce dependency.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : topByRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topByRevenue.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="customer" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No customer data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Revenue Distribution (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : top5RevenueShare.length > 0 ? (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={top5RevenueShare}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={false}
                    >
                      {top5RevenueShare.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-40 space-y-1">
                  {top5RevenueShare.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span className="truncate">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No customer data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TopPerformers
          data={topByRevenue.map(c => ({ name: c.customer, revenue: c.revenue, profit: c.profit, units: 0, count: c.orders }))}
          title="Top by Revenue"
          valueKey="revenue"
          isLoading={isLoading}
        />
        <TopPerformers
          data={topByProfit.map(c => ({ name: c.customer, revenue: c.revenue, profit: c.profit, units: 0, count: c.orders }))}
          title="Top by Profit"
          valueKey="profit"
          isLoading={isLoading}
        />
        <TopPerformers
          data={topByVolume.map(c => ({ name: c.customer, revenue: c.revenue, profit: 0, units: c.units, count: c.orders }))}
          title="Top by Volume"
          valueKey="units"
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Customer Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : topByRevenue.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topByRevenue.slice(0, 15).map((c, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{c.customer}</TableCell>
                      <TableCell className="text-right">{c.orders}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(c.revenue)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${c.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(c.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.margin >= 20 ? 'default' : c.margin >= 0 ? 'secondary' : 'destructive'}>
                          {formatPercent(c.margin)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No customer data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
