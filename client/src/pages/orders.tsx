import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/date-range-picker";
import { KPICard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart, DollarSign, TrendingUp, Package, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { OrdersAnalysis } from "@shared/schema";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
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

export default function Orders() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  const { data: ordersData, isLoading } = useQuery<OrdersAnalysis>({
    queryKey: ["/api/insights/orders"],
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-orders-title">Orders Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive order insights and trends
          </p>
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          title="Total Orders"
          value={(ordersData?.totalOrders || 0).toLocaleString()}
          icon={<ShoppingCart className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(ordersData?.totalRevenue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Profit"
          value={formatCurrency(ordersData?.totalProfit || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Avg Order Value"
          value={formatCurrency(ordersData?.averageOrderValue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Items per Order"
          value={(ordersData?.itemsPerOrder || 0).toFixed(1)}
          icon={<Package className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Orders by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (ordersData?.ordersByMonth || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ordersData?.ordersByMonth || []}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'orders' ? value.toLocaleString() : formatCurrency(value),
                      name === 'orders' ? 'Orders' : name === 'revenue' ? 'Revenue' : 'Profit'
                    ]}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No monthly data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (ordersData?.ordersByMonth || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={ordersData?.ordersByMonth || []}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2} 
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2} 
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No monthly data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top Customers by Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (ordersData?.ordersByCustomer || []).length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(ordersData?.ordersByCustomer || []).slice(0, 10).map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{c.customer}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.orders} orders | Avg: {formatCurrency(c.avgValue)}
                      </span>
                    </div>
                    <span className="text-sm font-medium ml-2">{formatCurrency(c.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No customer data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (ordersData?.ordersByStatus || []).length > 0 ? (
              <div className="space-y-2">
                {(ordersData?.ordersByStatus || []).map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">{s.status}</Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{s.count.toLocaleString()} orders</span>
                      <span className="text-xs text-muted-foreground block">
                        {formatCurrency(s.revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No status data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Top Orders by Value</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (ordersData?.topOrdersByValue || []).length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Sales ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ordersData?.topOrdersByValue || []).map((o, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{o.salesId}</TableCell>
                      <TableCell className="font-medium">{o.customer}</TableCell>
                      <TableCell className="text-right">{o.items}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(o.value)}</TableCell>
                      <TableCell className="text-muted-foreground">{o.date || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No order data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
