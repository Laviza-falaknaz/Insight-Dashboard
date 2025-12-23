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
import { Users, DollarSign, TrendingUp, Package } from "lucide-react";
import type { TopPerformer } from "@shared/schema";

interface CustomerAnalytics {
  topCustomers: TopPerformer[];
  totalCustomers: number;
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

export default function Customers() {
  const { data, isLoading } = useQuery<CustomerAnalytics>({
    queryKey: ["/api/analytics/customers"],
  });

  const customers = data?.topCustomers || [];

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Customer Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Customer performance and profitability insights
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Customers"
          value={(data?.totalCustomers || 0).toLocaleString()}
          icon={<Users className="h-4 w-4" />}
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
          icon={<Package className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TopPerformers
          data={customers}
          title="Top Customers by Revenue"
          valueKey="revenue"
          isLoading={isLoading}
        />
        <TopPerformers
          data={customers}
          title="Top Customers by Profit"
          valueKey="profit"
          isLoading={isLoading}
        />
        <TopPerformers
          data={customers}
          title="Top Customers by Units"
          valueKey="units"
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.slice(0, 20).map((customer, idx) => {
                    const margin = customer.revenue > 0 
                      ? ((customer.profit / customer.revenue) * 100).toFixed(1) 
                      : "0.0";
                    return (
                      <TableRow key={customer.name || idx}>
                        <TableCell className="font-medium">
                          {customer.name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(customer.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(customer.revenue - customer.profit)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm font-medium ${
                          customer.profit > 0 
                            ? "text-emerald-600 dark:text-emerald-400" 
                            : customer.profit < 0 
                            ? "text-red-600 dark:text-red-400" 
                            : ""
                        }`}>
                          {formatCurrency(customer.profit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(margin) >= 20 ? "default" : "secondary"}>
                            {margin}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {customer.units.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {customer.count.toLocaleString()}
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
