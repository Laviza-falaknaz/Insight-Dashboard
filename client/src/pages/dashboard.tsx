import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/kpi-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterPanel } from "@/components/filter-panel";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { StatusChart } from "@/components/charts/status-chart";
import { TopPerformers } from "@/components/charts/top-performers";
import { ConnectionError } from "@/components/connection-error";
import type { DashboardData, FilterDropdownOptions, FilterOptions } from "@shared/schema";

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

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [filters, setFilters] = useState<FilterOptions>({});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateRange.from) params.append("startDate", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange.to) params.append("endDate", format(dateRange.to, "yyyy-MM-dd"));
    if (filters.status?.length) params.append("status", filters.status.join(","));
    if (filters.category?.length) params.append("category", filters.category.join(","));
    if (filters.make?.length) params.append("make", filters.make.join(","));
    if (filters.customer?.length) params.append("customer", filters.customer.join(","));
    if (filters.vendor?.length) params.append("vendor", filters.vendor.join(","));
    if (filters.gradeCondition?.length) params.append("gradeCondition", filters.gradeCondition.join(","));
    return params.toString();
  };

  const { data: dashboardData, isLoading: dashboardLoading, refetch, isError, error } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard", buildQueryParams()],
    retry: 1,
  });

  const { data: filterOptions, isLoading: filterOptionsLoading } = useQuery<FilterDropdownOptions>({
    queryKey: ["/api/filters"],
    retry: 1,
  });

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetch();
        setLastUpdated(new Date());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetch]);

  const handleRefresh = () => {
    refetch();
    setLastUpdated(new Date());
  };

  const defaultFilterOptions: FilterDropdownOptions = {
    statuses: [],
    categories: [],
    makes: [],
    customers: [],
    vendors: [],
    grades: [],
  };

  return (
    <div className="p-4 space-y-4 max-w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real-time profit insights and analytics
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              data-testid="button-auto-refresh"
            >
              {autoRefresh && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-1" />
              )}
              Auto
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={dashboardLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${dashboardLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {isError && (
        <ConnectionError onRetry={handleRefresh} isRetrying={dashboardLoading} />
      )}

      <FilterPanel
        filters={filters}
        filterOptions={filterOptions || defaultFilterOptions}
        onFiltersChange={setFilters}
        isLoading={filterOptionsLoading}
      />

      <div className="text-xs text-muted-foreground">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(dashboardData?.kpis.totalRevenue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Total Cost"
          value={formatCurrency(dashboardData?.kpis.totalCost || 0)}
          icon={<Package className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Total Profit"
          value={formatCurrency(dashboardData?.kpis.totalProfit || 0)}
          trend={dashboardData?.kpis.profitMargin}
          trendLabel="margin"
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Profit Margin"
          value={`${(dashboardData?.kpis.profitMargin || 0).toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Units Sold"
          value={(dashboardData?.kpis.unitsSold || 0).toLocaleString()}
          icon={<ShoppingCart className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Avg Order Value"
          value={formatCurrency(dashboardData?.kpis.averageOrderValue || 0)}
          icon={<Users className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <RevenueChart
          data={dashboardData?.revenueOverTime || []}
          isLoading={dashboardLoading}
        />
        <CategoryChart
          data={dashboardData?.categoryBreakdown || []}
          isLoading={dashboardLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusChart
          data={dashboardData?.statusBreakdown || []}
          isLoading={dashboardLoading}
          title="Status Distribution"
        />
        <StatusChart
          data={(dashboardData?.gradeBreakdown || []).map(g => ({ status: g.grade, count: g.count }))}
          isLoading={dashboardLoading}
          title="Grade Distribution"
        />
        <TopPerformers
          data={dashboardData?.topCustomers || []}
          title="Top Customers"
          isLoading={dashboardLoading}
        />
        <TopPerformers
          data={dashboardData?.topProducts || []}
          title="Top Products"
          isLoading={dashboardLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TopPerformers
          data={dashboardData?.topVendors || []}
          title="Top Vendors"
          isLoading={dashboardLoading}
        />
        <TopPerformers
          data={dashboardData?.topCustomers || []}
          title="Top by Profit"
          valueKey="profit"
          isLoading={dashboardLoading}
        />
        <TopPerformers
          data={dashboardData?.topProducts || []}
          title="Top by Units"
          valueKey="units"
          isLoading={dashboardLoading}
        />
      </div>
    </div>
  );
}
