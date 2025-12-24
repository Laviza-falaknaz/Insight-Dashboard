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
  AlertTriangle,
  Truck,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/kpi-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterPanel } from "@/components/filter-panel";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { StatusChart } from "@/components/charts/status-chart";
import { TopPerformers } from "@/components/charts/top-performers";
import { ConnectionError } from "@/components/connection-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { DashboardData, FilterDropdownOptions, FilterOptions, ExecutiveSummary, FreightAnalysis, InventoryAgingAnalysis, ReturnsAnalysis, MarginAnalysis } from "@shared/schema";

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

  const { data: dashboardData, isLoading: dashboardLoading, refetch, isError } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard", buildQueryParams()],
    retry: 1,
  });

  const { data: executiveSummary, isLoading: executiveLoading } = useQuery<ExecutiveSummary>({
    queryKey: ["/api/insights/executive-summary"],
    retry: 1,
  });

  const { data: freightData, isLoading: freightLoading } = useQuery<FreightAnalysis>({
    queryKey: ["/api/insights/freight"],
    retry: 1,
  });

  const { data: agingData, isLoading: agingLoading } = useQuery<InventoryAgingAnalysis>({
    queryKey: ["/api/insights/inventory-aging"],
    retry: 1,
  });

  const { data: returnsData, isLoading: returnsLoading } = useQuery<ReturnsAnalysis>({
    queryKey: ["/api/insights/returns"],
    retry: 1,
  });

  const { data: marginData, isLoading: marginLoading } = useQuery<MarginAnalysis>({
    queryKey: ["/api/insights/margins"],
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const allAlerts = [
    ...(executiveSummary?.criticalAlerts || []),
    ...(freightData?.alerts || []),
    ...(agingData?.alerts || []),
    ...(returnsData?.alerts || []),
    ...(marginData?.alerts || []),
  ].slice(0, 6);

  return (
    <div className="p-4 space-y-4 max-w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time profit insights and executive analytics
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
          title="Total Profit"
          value={formatCurrency(dashboardData?.kpis.totalProfit || 0)}
          trend={dashboardData?.kpis.profitMargin}
          trendLabel="margin"
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Profit Margin"
          value={formatPercent(dashboardData?.kpis.profitMargin || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Units Sold"
          value={(dashboardData?.kpis.unitsSold || 0).toLocaleString()}
          icon={<Package className="h-4 w-4" />}
          isLoading={dashboardLoading}
        />
        <KPICard
          title="Total Orders"
          value={(dashboardData?.kpis.totalOrders || 0).toLocaleString()}
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

      {allAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Critical Alerts & Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAlerts.map((alert, idx) => (
                <div key={idx} className="p-3 rounded-md border bg-muted/30">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium">{alert.title}</span>
                    <Badge variant={getSeverityColor(alert.severity)} className="shrink-0">
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{alert.description}</p>
                  <p className="text-xs text-primary">{alert.recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-500" />
              Freight Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {freightLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Freight</span>
                  <span className="text-sm font-medium">{formatCurrency(freightData?.totalFreightCost || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">% of Total Cost</span>
                  <span className="text-sm font-medium">{formatPercent(freightData?.freightAsPercentOfCost || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Per Unit</span>
                  <span className="text-sm font-medium">{formatCurrency(freightData?.averageFreightPerUnit || 0)}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">Concentration Risk</span>
                    <span className={`text-xs font-medium ${(freightData?.freightConcentrationRisk || 0) > 65 ? 'text-amber-500' : ''}`}>
                      {formatPercent(freightData?.freightConcentrationRisk || 0)}
                    </span>
                  </div>
                  <Progress value={freightData?.freightConcentrationRisk || 0} className="h-1.5" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Inventory Aging
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Value</span>
                  <span className="text-sm font-medium">{formatCurrency(agingData?.totalInventoryValue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Days Held</span>
                  <span className="text-sm font-medium">{agingData?.averageDaysHeld || 0} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dead Stock</span>
                  <span className={`text-sm font-medium ${(agingData?.deadStockValue || 0) > 0 ? 'text-red-500' : ''}`}>
                    {formatCurrency(agingData?.deadStockValue || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Slow Moving</span>
                  <span className={`text-sm font-medium ${(agingData?.slowMovingValue || 0) > 0 ? 'text-amber-500' : ''}`}>
                    {formatCurrency(agingData?.slowMovingValue || 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-500" />
              Returns & RMA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {returnsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Returns</span>
                  <span className="text-sm font-medium">{returnsData?.totalReturns?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Return Rate</span>
                  <span className={`text-sm font-medium ${(returnsData?.returnRate || 0) > 5 ? 'text-red-500' : ''}`}>
                    {formatPercent(returnsData?.returnRate || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last 30 Days</span>
                  <span className="text-sm font-medium">{returnsData?.returnsLast30Days || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Repeat Failures</span>
                  <span className={`text-sm font-medium ${(returnsData?.repeatFailures || 0) > 0 ? 'text-amber-500' : ''}`}>
                    {returnsData?.repeatFailures || 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Margin Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {marginLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Overall Margin</span>
                  <span className="text-sm font-medium">{formatPercent(marginData?.overallMargin || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Negative Margin Items</span>
                  <span className={`text-sm font-medium ${(marginData?.negativeMarginItems || 0) > 0 ? 'text-red-500' : ''}`}>
                    {(marginData?.negativeMarginItems || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Loss Value</span>
                  <span className={`text-sm font-medium ${(marginData?.negativeMarginValue || 0) > 0 ? 'text-red-500' : ''}`}>
                    {formatCurrency(marginData?.negativeMarginValue || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Best: </span>
                  <span className="text-xs font-medium">{executiveSummary?.quickInsights?.bestPerformingCategory || 'N/A'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
