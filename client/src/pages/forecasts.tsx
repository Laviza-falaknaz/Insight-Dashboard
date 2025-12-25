import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Target,
  Users,
  Package,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import type { PredictiveAnalyticsDashboard } from "@shared/schema";

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}

function TrendIcon({ direction }: { direction: string }) {
  switch (direction) {
    case 'increasing':
    case 'up':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'decreasing':
    case 'down':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function ImpactBadge({ impact }: { impact: string }) {
  switch (impact) {
    case 'positive':
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Positive</Badge>;
    case 'negative':
      return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Negative</Badge>;
    default:
      return <Badge variant="outline" className="bg-muted text-muted-foreground">Neutral</Badge>;
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 70) {
    return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">{confidence}% confidence</Badge>;
  } else if (confidence >= 40) {
    return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">{confidence}% confidence</Badge>;
  }
  return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">{confidence}% confidence</Badge>;
}

export default function ForecastsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: forecastData, isLoading, refetch, isFetching } = useQuery<PredictiveAnalyticsDashboard>({
    queryKey: ["/api/predictive/dashboard"],
  });

  const aiInsightsMutation = useMutation({
    mutationFn: async () => {
      if (!forecastData) return null;
      const response = await apiRequest("POST", "/api/predictive/ai-insights", {
        keyPredictions: forecastData.keyPredictions,
        revenueForecast: forecastData.revenueForecast,
        marginForecast: forecastData.marginForecast,
        returnRateForecast: forecastData.returnRateForecast,
        customerForecast: forecastData.customerForecast,
      });
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-80" /></CardContent></Card>
      </div>
    );
  }

  if (!forecastData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Unable to Load Forecasts</h3>
            <p className="text-muted-foreground mb-4">There was an issue loading the predictive analytics data.</p>
            <Button onClick={() => refetch()} data-testid="button-retry-forecast">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const revenueChartData = [
    ...forecastData.revenueForecast.historicalData.map(d => ({
      period: d.period,
      actual: d.actual,
      predicted: null as number | null,
      lowerBound: null as number | null,
      upperBound: null as number | null,
    })),
    ...forecastData.revenueForecast.forecastData.map(d => ({
      period: d.period,
      actual: null as number | null,
      predicted: d.predicted,
      lowerBound: d.lowerBound,
      upperBound: d.upperBound,
    })),
  ];

  const marginChartData = forecastData.marginForecast.historicalData.map(d => ({
    period: d.period,
    margin: d.actual,
  }));

  const volumeChartData = forecastData.salesVolumeForecast.historicalData.map(d => ({
    period: d.period,
    units: d.actual,
  }));

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Predictive Analytics</h1>
          <p className="text-muted-foreground">
            Forecasts based on {forecastData.dataQuality.historicalMonths} months of historical data
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" />
            {forecastData.dataQuality.reliabilityScore}% Model Reliability
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-forecast"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => aiInsightsMutation.mutate()}
            disabled={aiInsightsMutation.isPending}
            data-testid="button-ai-insights"
          >
            <Sparkles className={`h-4 w-4 mr-2 ${aiInsightsMutation.isPending ? 'animate-pulse' : ''}`} />
            AI Insights
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {forecastData.keyPredictions.map((prediction, index) => (
          <Card key={index} data-testid={`card-prediction-${prediction.metric.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  {prediction.metric}
                </CardDescription>
                <TrendIcon direction={prediction.direction} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" data-testid={`text-prediction-value-${index}`}>
                  {prediction.metric.includes('Margin') || prediction.metric.includes('Rate')
                    ? `${prediction.predictedValue.toFixed(1)}%`
                    : prediction.metric.includes('Revenue')
                    ? formatCurrency(prediction.predictedValue)
                    : formatNumber(prediction.predictedValue)
                  }
                </span>
                <span className={`text-sm flex items-center gap-1 ${
                  prediction.changePercent > 0 ? 'text-green-600' : prediction.changePercent < 0 ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {prediction.changePercent > 0 ? <ArrowUp className="h-3 w-3" /> : prediction.changePercent < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                  {Math.abs(prediction.changePercent).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ConfidenceBadge confidence={prediction.confidence} />
                <ImpactBadge impact={prediction.impact} />
              </div>
              <p className="text-xs text-muted-foreground">
                Current: {prediction.metric.includes('Margin') || prediction.metric.includes('Rate')
                  ? `${prediction.currentValue.toFixed(1)}%`
                  : prediction.metric.includes('Revenue')
                  ? formatCurrency(prediction.currentValue)
                  : formatNumber(prediction.currentValue)
                }
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {aiInsightsMutation.data && (
        <Card className="border-primary/20 bg-primary/5" data-testid="card-ai-insights">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI-Generated Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{(aiInsightsMutation.data as any).summary}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Opportunities
                </h4>
                <ul className="space-y-1">
                  {((aiInsightsMutation.data as any).opportunities || []).map((opp: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground">{opp}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Risks
                </h4>
                <ul className="space-y-1">
                  {((aiInsightsMutation.data as any).risks || []).map((risk: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground">{risk}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Recommendations
                </h4>
                <ul className="space-y-1">
                  {((aiInsightsMutation.data as any).recommendations || []).map((rec: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-forecast-sections">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <DollarSign className="h-4 w-4 mr-1" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="margin" data-testid="tab-margin">
            <Percent className="h-4 w-4 mr-1" />
            Margins
          </TabsTrigger>
          <TabsTrigger value="volume" data-testid="tab-volume">
            <Package className="h-4 w-4 mr-1" />
            Volume
          </TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">
            <Users className="h-4 w-4 mr-1" />
            Customers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Revenue Forecast</CardTitle>
                <CardDescription>
                  Historical data and {forecastData.forecastPeriod.toLowerCase()} projection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Legend />
                    <Area 
                      type="monotone"
                      dataKey="upperBound"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.1}
                      stroke="none"
                      name="Upper Bound"
                    />
                    <Area 
                      type="monotone"
                      dataKey="lowerBound"
                      fill="hsl(var(--background))"
                      stroke="none"
                      name="Lower Bound"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Actual Revenue"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4 }}
                      name="Predicted"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trend Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendIcon direction={forecastData.revenueForecast.trend.direction} />
                    <span className="font-medium capitalize">
                      {forecastData.revenueForecast.trend.direction}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {forecastData.revenueForecast.trend.description}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next Month</span>
                    <span className="font-medium">{formatCurrency(forecastData.revenueForecast.nextPeriodPrediction)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next Quarter</span>
                    <span className="font-medium">{formatCurrency(forecastData.revenueForecast.nextQuarterPrediction)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Model Accuracy</span>
                    <span className="font-medium">{forecastData.revenueForecast.modelAccuracy}%</span>
                  </div>
                </div>

                {forecastData.revenueForecast.seasonality.detected && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm font-medium text-amber-600 mb-1">Seasonality Detected</p>
                    <p className="text-xs text-muted-foreground">
                      {forecastData.revenueForecast.seasonality.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="margin" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Profit Margin Trend</CardTitle>
                <CardDescription>Historical margin performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={marginChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                    <Area 
                      type="monotone" 
                      dataKey="margin" 
                      stroke="hsl(var(--chart-3))" 
                      fill="hsl(var(--chart-3))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <ReferenceLine 
                      y={forecastData.marginForecast.currentMargin} 
                      stroke="hsl(var(--primary))" 
                      strokeDasharray="3 3"
                      label={{ value: "Current", position: "right", fontSize: 10 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Margin by Category</CardTitle>
                <CardDescription>Trend outlook</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastData.marginForecast.byCategory.slice(0, 6).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm truncate max-w-[120px]">{cat.category}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] ${
                            cat.trend === 'improving' ? 'text-green-600 border-green-500/30' :
                            cat.trend === 'declining' ? 'text-red-600 border-red-500/30' :
                            'text-muted-foreground'
                          }`}
                        >
                          {cat.trend}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">{cat.predictedMargin.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({cat.currentMargin > cat.predictedMargin ? '-' : '+'}{Math.abs(cat.predictedMargin - cat.currentMargin).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="volume" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Sales Volume Trend</CardTitle>
                <CardDescription>Units sold over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={volumeChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Bar 
                      dataKey="units" 
                      fill="hsl(var(--chart-1))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Forecasts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastData.salesVolumeForecast.byCategory.slice(0, 6).map((cat, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm truncate max-w-[120px]">{cat.category}</span>
                        <span className="text-sm font-medium">{formatNumber(cat.nextPeriodForecast)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${cat.growthRate >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, Math.abs(cat.growthRate) + 20)}%` }}
                          />
                        </div>
                        <span className={`text-xs ${cat.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {cat.growthRate >= 0 ? '+' : ''}{cat.growthRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{forecastData.customerForecast.totalActiveCustomers}</p>
                    <p className="text-xs text-muted-foreground">Active Customers</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-500/10">
                    <p className="text-2xl font-bold text-green-600">+{forecastData.customerForecast.predictedNewCustomers}</p>
                    <p className="text-xs text-muted-foreground">Predicted New</p>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg border">
                  <p className="text-sm font-medium mb-2">Concentration Risk</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Top 5 customers</span>
                    <span className="font-medium">{forecastData.customerForecast.revenueConcentrationRisk.top5Percentage.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {forecastData.customerForecast.revenueConcentrationRisk.recommendation}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-base">Churn Risk</CardTitle>
                </div>
                <CardDescription>
                  {forecastData.customerForecast.churnRisk.atRiskCount} customers at risk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastData.customerForecast.churnRisk.customers.slice(0, 5).map((cust, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5">
                      <div>
                        <p className="text-sm font-medium truncate max-w-[150px]">{cust.customer}</p>
                        <p className="text-xs text-muted-foreground">{cust.daysSinceLast} days since last order</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-amber-600">{(cust.churnProbability * 100).toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(cust.historicalRevenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {forecastData.customerForecast.churnRisk.atRiskRevenue > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-600">
                      {formatCurrency(forecastData.customerForecast.churnRisk.atRiskRevenue)} revenue at risk
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <CardTitle className="text-base">Growth Potential</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastData.customerForecast.topGrowthCustomers.slice(0, 5).map((cust, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium truncate max-w-[150px]">{cust.customer}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(cust.currentRevenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">+{cust.growthRate}%</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(cust.projectedRevenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
