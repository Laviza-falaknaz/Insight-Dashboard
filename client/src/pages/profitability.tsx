import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, Percent, AlertTriangle } from "lucide-react";
import type { MarginAnalysis, FreightAnalysis } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

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

export default function Profitability() {
  const { data: marginData, isLoading: marginLoading } = useQuery<MarginAnalysis>({
    queryKey: ["/api/insights/margins"],
  });

  const { data: freightData, isLoading: freightLoading } = useQuery<FreightAnalysis>({
    queryKey: ["/api/insights/freight"],
  });

  const isLoading = marginLoading || freightLoading;

  const marginByCategory = marginData?.marginByCategory || [];
  const highMarginCategories = marginByCategory.filter(c => c.margin >= 20).slice(0, 5);
  const lowMarginCategories = marginByCategory.filter(c => c.margin < 20 && c.margin >= 0).slice(0, 5);
  const negativeMarginCategories = marginByCategory.filter(c => c.margin < 0);

  const marginTrend = marginData?.marginTrend || [];
  const marginAlerts = marginData?.alerts || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-profitability-title">Profitability Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Deep dive into profit margins, cost analysis, and margin erosion insights
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          title="Overall Margin"
          value={formatPercent(marginData?.overallMargin || 0)}
          icon={<Percent className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Negative Margin Items"
          value={(marginData?.negativeMarginItems || 0).toLocaleString()}
          icon={<TrendingDown className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Loss Value"
          value={formatCurrency(marginData?.negativeMarginValue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Freight Cost"
          value={formatCurrency(freightData?.totalFreightCost || 0)}
          icon={<TrendingDown className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Freight % of Cost"
          value={formatPercent(freightData?.freightAsPercentOfCost || 0)}
          icon={<Percent className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      {marginAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Margin Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {marginAlerts.slice(0, 6).map((alert, idx) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Margin Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : marginTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={marginTrend}>
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margin']} />
                  <Line 
                    type="monotone" 
                    dataKey="margin" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Margin by Manufacturer</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (marginData?.marginByMake || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={(marginData?.marginByMake || []).slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="make" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margin']} />
                  <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                    {(marginData?.marginByMake || []).slice(0, 8).map((entry, idx) => (
                      <Cell 
                        key={idx} 
                        fill={entry.margin >= 20 ? 'hsl(var(--chart-2))' : entry.margin >= 0 ? 'hsl(var(--chart-3))' : 'hsl(var(--destructive))'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No manufacturer data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              High Margin Categories (20%+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : highMarginCategories.length > 0 ? (
              <div className="space-y-3">
                {highMarginCategories.map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{cat.category}</span>
                      <Badge variant="default" className="shrink-0">
                        {cat.margin.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={Math.min(cat.margin, 100)} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Revenue: {formatCurrency(cat.revenue)}</span>
                      <span>Profit: {formatCurrency(cat.profit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No high margin categories found
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Low Margin Categories (0-20%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : lowMarginCategories.length > 0 ? (
              <div className="space-y-3">
                {lowMarginCategories.map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{cat.category}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {cat.margin.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={Math.max(cat.margin, 0)} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Revenue: {formatCurrency(cat.revenue)}</span>
                      <span>Profit: {formatCurrency(cat.profit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No low margin categories found
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {negativeMarginCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Negative Margin Categories - Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit/Loss</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negativeMarginCategories.slice(0, 10).map((cat, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{cat.category}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(cat.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400 font-medium">
                        {formatCurrency(cat.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">
                          {cat.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Freight Cost by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            {freightLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (freightData?.freightBySupplier || []).length > 0 ? (
              <div className="space-y-2">
                {(freightData?.freightBySupplier || []).slice(0, 8).map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <span className="text-sm truncate flex-1">{s.supplier}</span>
                    <span className="text-xs text-muted-foreground mx-2">{s.itemCount} items</span>
                    <span className="text-sm font-medium">{formatCurrency(s.cost)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No freight data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Freight Cost by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {freightLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (freightData?.freightByCategory || []).length > 0 ? (
              <div className="space-y-2">
                {(freightData?.freightByCategory || []).slice(0, 8).map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <span className="text-sm truncate flex-1">{c.category}</span>
                    <span className="text-xs text-muted-foreground mx-2">
                      ${c.avgPerUnit.toFixed(2)}/unit
                    </span>
                    <span className="text-sm font-medium">{formatCurrency(c.cost)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No freight data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
