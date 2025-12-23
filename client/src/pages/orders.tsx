import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { KPICard } from "@/components/kpi-card";
import { ShoppingCart, DollarSign, TrendingUp, Package } from "lucide-react";
import type { InventoryItem } from "@shared/schema";

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

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateRange.from) params.append("startDate", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange.to) params.append("endDate", format(dateRange.to, "yyyy-MM-dd"));
    return params.toString();
  };

  const { data: ordersData, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory", buildQueryParams()],
  });

  const orders = ordersData || [];
  
  const totalRevenue = orders.reduce((sum, o) => sum + (o.FinalSalesPriceUSD || 0), 0);
  const totalCost = orders.reduce((sum, o) => sum + (o.FinalTotalCostUSD || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const uniqueOrders = new Set(orders.filter(o => o.SalesId).map(o => o.SalesId)).size;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            View and analyze order data
          </p>
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Orders"
          value={uniqueOrders.toLocaleString()}
          icon={<ShoppingCart className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Profit"
          value={formatCurrency(totalProfit)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Items Sold"
          value={orders.length.toLocaleString()}
          icon={<Package className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={orders} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
