import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  RefreshCw,
  RotateCcw,
  Target,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/kpi-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterPanel } from "@/components/filter-panel";
import { ConnectionError } from "@/components/connection-error";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardToolbar } from "@/components/DashboardToolbar";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { ProfitabilityWaterfall } from "@/components/charts/profitability-waterfall";
import { ReturnImpactCard } from "@/components/charts/return-impact-card";
import { RegionalPerformance } from "@/components/charts/regional-performance";
import { CriticalAlerts } from "@/components/charts/critical-alerts";
import { PerformanceSummary } from "@/components/charts/performance-summary";
import { MonthlyTrendsChart } from "@/components/charts/monthly-trends-chart";
import type { FilterDropdownOptions, FilterOptions, StrategicDashboardData } from "@shared/schema";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
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

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

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

  const queryParams = buildQueryParams();
  const { data: strategicData, isLoading: strategicLoading, refetch, isError } = useQuery<StrategicDashboardData>({
    queryKey: ["/api/strategic/dashboard", queryParams],
    queryFn: async () => {
      const url = queryParams ? `/api/strategic/dashboard?${queryParams}` : "/api/strategic/dashboard";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch strategic dashboard");
      return res.json();
    },
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
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Strategic Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time profitability insights with return impact analysis
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DashboardToolbar 
            pageName="Strategic Dashboard" 
            chartElementIds={["dashboard-kpis", "dashboard-waterfall", "dashboard-trends"]}
            insightType="category"
          />
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
              disabled={strategicLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${strategicLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {isError && (
        <ConnectionError onRetry={handleRefresh} isRetrying={strategicLoading} />
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

      <div id="dashboard-kpis" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KPICard
          title="Sales Revenue"
          value={formatCurrency(strategicData?.salesRevenue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={strategicLoading}
        />
        <KPICard
          title="Gross Profit"
          value={formatCurrency(strategicData?.grossProfit || 0)}
          trend={strategicData?.grossMargin}
          trendLabel="margin"
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={strategicLoading}
        />
        <KPICard
          title="Return Impact"
          value={`-${formatCurrency(strategicData?.returnImpact || 0)}`}
          icon={<RotateCcw className="h-4 w-4 text-red-500" />}
          isLoading={strategicLoading}
        />
        <KPICard
          title="Net Profit"
          value={formatCurrency(strategicData?.netProfit || 0)}
          trend={strategicData?.netMargin}
          trendLabel="net margin"
          icon={(strategicData?.netProfit || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          isLoading={strategicLoading}
        />
        <KPICard
          title="Units Sold"
          value={(strategicData?.unitsSold || 0).toLocaleString()}
          icon={<Package className="h-4 w-4" />}
          isLoading={strategicLoading}
        />
        <KPICard
          title="Units Returned"
          value={(strategicData?.unitsReturned || 0).toLocaleString()}
          trend={strategicData?.returnRate}
          trendLabel="return rate"
          icon={<RotateCcw className="h-4 w-4" />}
          isLoading={strategicLoading}
        />
        <KPICard
          title="Customers"
          value={(strategicData?.uniqueCustomers || 0).toLocaleString()}
          icon={<Users className="h-4 w-4" />}
          isLoading={strategicLoading}
        />
        <KPICard
          title="Products"
          value={(strategicData?.uniqueProducts || 0).toLocaleString()}
          icon={<Target className="h-4 w-4" />}
          isLoading={strategicLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="md:col-span-2 bg-gradient-to-r from-emerald-500/5 to-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Profitability Summary</CardTitle>
            <CardDescription>Revenue to net profit with return impact</CardDescription>
          </CardHeader>
          <CardContent>
            {strategicLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Gross Margin</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatPercent(strategicData?.grossMargin || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(strategicData?.grossProfit || 0)} gross profit
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Return Rate</div>
                  <div className={`text-2xl font-bold ${(strategicData?.returnRate || 0) > 10 ? 'text-red-500' : (strategicData?.returnRate || 0) > 5 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {formatPercent(strategicData?.returnRate || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(strategicData?.unitsReturned || 0).toLocaleString()} units returned
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Profit Lost</div>
                  <div className="text-2xl font-bold text-red-500">
                    -{formatCurrency(strategicData?.returnImpact || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {strategicData?.grossProfit ? ((strategicData.returnImpact / strategicData.grossProfit) * 100).toFixed(1) : 0}% of gross profit
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Net Margin</div>
                  <div className={`text-2xl font-bold ${(strategicData?.netMargin || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatPercent(strategicData?.netMargin || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(strategicData?.netProfit || 0)} net profit
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div id="dashboard-waterfall" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ProfitabilityWaterfall 
          data={strategicData?.profitabilityWaterfall} 
          isLoading={strategicLoading} 
        />
        <ReturnImpactCard
          unitsSold={strategicData?.unitsSold || 0}
          unitsReturned={strategicData?.unitsReturned || 0}
          returnRate={strategicData?.returnRate || 0}
          revenueAtRisk={0}
          profitLost={strategicData?.returnImpact || 0}
          grossProfit={strategicData?.grossProfit || 0}
          netProfit={strategicData?.netProfit || 0}
          isLoading={strategicLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CriticalAlerts 
          alerts={strategicData?.criticalAlerts || []} 
          isLoading={strategicLoading} 
        />
        <PerformanceSummary
          topCategory={strategicData?.topPerformingCategory || { name: 'N/A', profit: 0, margin: 0 }}
          worstCategory={strategicData?.worstPerformingCategory || { name: 'N/A', profit: 0, margin: 0 }}
          topCustomer={strategicData?.topCustomer || { name: 'N/A', revenue: 0, margin: 0 }}
          highestReturnProduct={strategicData?.highestReturnProduct || { name: 'N/A', returnRate: 0, lostProfit: 0 }}
          isLoading={strategicLoading}
        />
        <RegionalPerformance 
          regions={strategicData?.regionPerformance || []} 
          isLoading={strategicLoading} 
        />
      </div>

      <div id="dashboard-trends">
        <MonthlyTrendsChart 
          data={strategicData?.monthlyTrends || []} 
          isLoading={strategicLoading} 
        />
      </div>

      {strategicData && (
        <AIInsightsPanel
          context="strategic_dashboard"
          data={strategicData}
          title="AI Strategic Insights"
        />
      )}
    </div>
  );
}
