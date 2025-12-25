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
  AlertTriangle,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  RotateCcw,
  Truck,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterPanel } from "@/components/filter-panel";
import { ConnectionError } from "@/components/connection-error";
import { DashboardToolbar } from "@/components/DashboardToolbar";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import type { FilterDropdownOptions, FilterOptions, StrategicDashboardData, ProductAnalysis } from "@shared/schema";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function HeroKPI({ title, value, subValue, icon, trend, isLoading, accent }: {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  isLoading?: boolean;
  accent?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const accentStyles = {
    default: {
      gradient: 'from-primary/10 to-primary/5 border-primary/20',
      icon: 'text-primary',
    },
    success: {
      gradient: 'from-[hsl(var(--chart-2))]/10 to-[hsl(var(--chart-2))]/5 border-[hsl(var(--chart-2))]/20',
      icon: 'text-[hsl(var(--chart-2))]',
    },
    warning: {
      gradient: 'from-[hsl(var(--chart-4))]/10 to-[hsl(var(--chart-4))]/5 border-[hsl(var(--chart-4))]/20',
      icon: 'text-[hsl(var(--chart-4))]',
    },
    danger: {
      gradient: 'from-destructive/10 to-destructive/5 border-destructive/20',
      icon: 'text-destructive',
    },
  };

  const currentAccent = accentStyles[accent || 'default'];

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${currentAccent.gradient} border`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.value >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-[hsl(var(--chart-2))]" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-[hsl(var(--chart-2))]' : 'text-destructive'}`}>
                  {formatPercent(Math.abs(trend.value))}
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg bg-background/50 ${currentAccent.icon}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionAlert({ severity, title, description, impact, recommendation }: {
  severity: string;
  title: string;
  description: string;
  impact?: number;
  recommendation?: string;
}) {
  const severityStyles = {
    critical: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
    high: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
    medium: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
    low: 'bg-muted border-border',
  };

  return (
    <div className={`p-3 rounded-lg border ${severityStyles[severity as keyof typeof severityStyles] || severityStyles.low}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs opacity-80 mt-0.5">{description}</p>
          {impact !== undefined && (
            <p className="text-xs font-medium mt-1">Impact: {formatCurrency(Math.abs(impact))}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [filters, setFilters] = useState<FilterOptions>({});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateRange.from) params.append("startDate", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange.to) params.append("endDate", format(dateRange.to, "yyyy-MM-dd"));
    if (filters.category?.length) params.append("category", filters.category.join(","));
    if (filters.make?.length) params.append("make", filters.make.join(","));
    if (filters.customer?.length) params.append("customer", filters.customer.join(","));
    if (filters.vendor?.length) params.append("vendor", filters.vendor.join(","));
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: strategicData, isLoading, refetch, isError } = useQuery<StrategicDashboardData>({
    queryKey: ["/api/strategic/dashboard", queryParams],
    queryFn: async () => {
      const url = queryParams ? `/api/strategic/dashboard?${queryParams}` : "/api/strategic/dashboard";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    retry: 1,
  });

  const { data: productData, isLoading: productsLoading } = useQuery<ProductAnalysis>({
    queryKey: ["/api/insights/products", queryParams],
    queryFn: async () => {
      const url = queryParams ? `/api/insights/products?${queryParams}` : "/api/insights/products";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: filterOptions } = useQuery<FilterDropdownOptions>({
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

  if (isError) {
    return <ConnectionError onRetry={handleRefresh} />;
  }

  const profitWaterfall = strategicData?.profitabilityWaterfall;
  const alerts = strategicData?.criticalAlerts || [];
  const monthlyTrends = strategicData?.monthlyTrends || [];
  const regionPerformance = strategicData?.regionPerformance || [];
  const costBottlenecks = strategicData?.costBottlenecks || [];
  const returnsAnalysis = strategicData?.returnsAnalysis;

  const topProducts = productData?.topByProfit?.slice(0, 5) || [];
  const negativeMarginProducts = productData?.negativeMarginProducts || [];
  const returnProneProducts = productData?.returnProneProducts || [];

  const regionPieData = regionPerformance.map((r, i) => ({
    name: r.region,
    value: r.revenue,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const costBreakdown = costBottlenecks.slice(0, 5).map((c, i) => ({
    category: c.category?.slice(0, 12) || 'Unknown',
    margin: c.margin,
    revenue: c.revenue,
    fill: c.margin < 15 ? 'hsl(var(--destructive))' : c.margin < 30 ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-2))',
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="px-6 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-command-center-title">
                Executive Command Center
              </h1>
              <p className="text-xs text-muted-foreground">
                Last updated: {format(lastUpdated, "MMM d, yyyy h:mm a")}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={(range) => setDateRange(range)}
              />
              <FilterPanel
                filterOptions={filterOptions || { statuses: [], categories: [], makes: [], customers: [], vendors: [], grades: [] }}
                filters={filters}
                onFiltersChange={setFilters}
                isLoading={false}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <DashboardToolbar pageName="Command Center" chartElementIds={["trend-chart", "region-chart"]} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <HeroKPI
            title="Net Revenue"
            value={formatCurrency(strategicData?.salesRevenue || 0)}
            subValue={`${strategicData?.unitsSold?.toLocaleString() || 0} units`}
            icon={<DollarSign className="h-5 w-5" />}
            isLoading={isLoading}
            accent="default"
          />
          <HeroKPI
            title="Gross Profit"
            value={formatCurrency(strategicData?.grossProfit || 0)}
            subValue={`${formatPercent(strategicData?.grossMargin || 0)} margin`}
            icon={<TrendingUp className="h-5 w-5" />}
            isLoading={isLoading}
            accent="success"
          />
          <HeroKPI
            title="Net Profit"
            value={formatCurrency(strategicData?.netProfit || 0)}
            subValue={`After ${formatCurrency(Math.abs(strategicData?.returnImpact || 0))} returns`}
            icon={<Target className="h-5 w-5" />}
            isLoading={isLoading}
            accent={strategicData?.netMargin && strategicData.netMargin > 30 ? 'success' : 'warning'}
          />
          <HeroKPI
            title="Return Rate"
            value={formatPercent(strategicData?.returnRate || 0)}
            subValue={`${strategicData?.unitsReturned || 0} units returned`}
            icon={<RotateCcw className="h-5 w-5" />}
            isLoading={isLoading}
            accent={(strategicData?.returnRate || 0) > 5 ? 'danger' : 'warning'}
          />
          <HeroKPI
            title="Active Customers"
            value={(strategicData?.uniqueCustomers || 0).toLocaleString()}
            subValue={`${strategicData?.uniqueProducts || 0} products`}
            icon={<Users className="h-5 w-5" />}
            isLoading={isLoading}
            accent="default"
          />
        </div>

        {alerts.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Action Required ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {alerts.slice(0, 3).map((alert, idx) => (
                  <ActionAlert
                    key={idx}
                    severity={alert.severity}
                    title={alert.title}
                    description={alert.description}
                    impact={alert.impact}
                    recommendation={alert.recommendation}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
            <TabsTrigger value="products" className="text-xs">Products</TabsTrigger>
            <TabsTrigger value="costs" className="text-xs">Costs</TabsTrigger>
            <TabsTrigger value="returns" className="text-xs">Returns</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Revenue & Margin Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : monthlyTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280} id="trend-chart">
                      <AreaChart data={monthlyTrends.slice(-12)}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            name === 'margin' ? `${value.toFixed(1)}%` : formatCurrency(value),
                            name === 'margin' ? 'Margin' : name === 'revenue' ? 'Revenue' : 'Profit'
                          ]}
                        />
                        <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revenueGradient)" />
                        <Line yAxisId="left" type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="margin" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      No trend data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Revenue by Region</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : regionPieData.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={180} id="region-chart">
                        <PieChart>
                          <Pie
                            data={regionPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                          >
                            {regionPieData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {regionPerformance.map((r, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                              <span>{r.region}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono">{formatCurrency(r.revenue)}</span>
                              <Badge variant={r.profit > 0 ? 'secondary' : 'destructive'} className="text-xs">
                                {formatPercent((r.profit / r.revenue) * 100)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      No region data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Performing Products</CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : topProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {topProducts.map((p, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-muted/30 border">
                        <p className="text-xs font-medium truncate mb-1" title={p.product}>{p.product}</p>
                        <p className="text-lg font-bold">{formatCurrency(p.profit)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={p.margin >= 30 ? 'default' : 'secondary'} className="text-xs">
                            {formatPercent(p.margin)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{p.units} units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No product data</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Negative Margin Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {negativeMarginProducts.length > 0 ? (
                    <div className="space-y-2">
                      {negativeMarginProducts.slice(0, 8).map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-red-500/5 border border-red-500/20">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.product}</p>
                            <p className="text-xs text-muted-foreground">{p.units} units sold</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-600">{formatCurrency(p.profit)}</p>
                            <Badge variant="destructive" className="text-xs">{formatPercent(p.margin)}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                        All products profitable
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-amber-500" />
                    High Return Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {returnProneProducts.length > 0 ? (
                    <div className="space-y-2">
                      {returnProneProducts.slice(0, 8).map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-amber-500/5 border border-amber-500/20">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.product}</p>
                            <p className="text-xs text-muted-foreground">{p.unitsSold} sold / {p.returnCount} returned</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-amber-600">{formatPercent(p.returnRate)}</p>
                            <p className="text-xs text-muted-foreground">-{formatCurrency(Math.abs(p.profitLost))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No return data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Margin by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : costBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={costBreakdown} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                        <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Margin']} />
                        <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                          {costBreakdown.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      No category data
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {profitWaterfall ? (
                    <div className="space-y-3">
                      {[
                        { label: 'Purchase Cost', value: profitWaterfall.purchaseCost, pct: (profitWaterfall.purchaseCost / profitWaterfall.grossRevenue) * 100 },
                        { label: 'Parts Cost', value: profitWaterfall.partsCost, pct: (profitWaterfall.partsCost / profitWaterfall.grossRevenue) * 100 },
                        { label: 'Freight', value: profitWaterfall.freightCost, pct: (profitWaterfall.freightCost / profitWaterfall.grossRevenue) * 100 },
                        { label: 'Labor', value: profitWaterfall.laborCost, pct: (profitWaterfall.laborCost / profitWaterfall.grossRevenue) * 100 },
                      ].map((item, idx) => (
                        <div key={idx}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>{item.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{formatCurrency(item.value)}</span>
                              <span className="text-muted-foreground">({item.pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <Progress value={Math.min(item.pct, 100)} className="h-2" />
                        </div>
                      ))}
                      <div className="pt-3 border-t mt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Gross Margin</span>
                          <Badge variant={profitWaterfall.grossMargin >= 30 ? 'default' : 'secondary'}>
                            {formatPercent(profitWaterfall.grossMargin)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Skeleton className="h-64 w-full" />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="returns" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Return Reasons</CardTitle>
                </CardHeader>
                <CardContent>
                  {returnsAnalysis?.reasonsBreakdown?.length ? (
                    <div className="space-y-2">
                      {returnsAnalysis.reasonsBreakdown.slice(0, 8).map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            <span className="text-xs font-medium">{r.reason}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">{r.count}</Badge>
                            <span className="text-xs font-mono text-red-500">-{formatCurrency(Math.abs(r.profitImpact))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No return data</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Returns by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {returnsAnalysis?.byCategory?.length ? (
                    <div className="space-y-2">
                      {returnsAnalysis.byCategory.map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div>
                            <p className="text-xs font-medium">{c.category}</p>
                            <p className="text-xs text-muted-foreground">{c.returnCount} returns</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono">{formatCurrency(c.revenueAtRisk)} at risk</p>
                            <p className="text-xs text-red-500">-{formatCurrency(Math.abs(c.profitLost))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No category return data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <AIInsightsPanel 
          context="executive_summary" 
          data={{
            revenue: strategicData?.salesRevenue,
            profit: strategicData?.netProfit,
            margin: strategicData?.netMargin,
            returnRate: strategicData?.returnRate,
            alerts: alerts.length,
          }}
        />
      </div>
    </div>
  );
}
