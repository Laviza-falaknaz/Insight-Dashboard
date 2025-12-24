import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterPanel } from "@/components/filter-panel";
import { KPICard } from "@/components/kpi-card";
import { StatusChart } from "@/components/charts/status-chart";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Boxes, Package, TrendingUp, DollarSign, Clock, AlertTriangle } from "lucide-react";
import type { InventoryItem, FilterDropdownOptions, FilterOptions, InventoryAgingAnalysis } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

export default function Inventory() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [filters, setFilters] = useState<FilterOptions>({});

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateRange.from) params.append("startDate", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange.to) params.append("endDate", format(dateRange.to, "yyyy-MM-dd"));
    if (filters.status?.length) params.append("status", filters.status.join(","));
    if (filters.category?.length) params.append("category", filters.category.join(","));
    if (filters.make?.length) params.append("make", filters.make.join(","));
    if (filters.gradeCondition?.length) params.append("gradeCondition", filters.gradeCondition.join(","));
    return params.toString();
  };

  const { data: inventoryData, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory", buildQueryParams()],
  });

  const { data: agingData, isLoading: agingLoading } = useQuery<InventoryAgingAnalysis>({
    queryKey: ["/api/insights/inventory-aging"],
  });

  const { data: filterOptions } = useQuery<FilterDropdownOptions>({
    queryKey: ["/api/filters"],
  });

  const items = inventoryData || [];
  
  const statusCounts: Record<string, number> = {};
  items.forEach(item => {
    const status = item.Status || "Unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  const gradeCounts: Record<string, number> = {};
  items.forEach(item => {
    const grade = item.GradeCondition || "Unknown";
    gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
  });
  const gradeData = Object.entries(gradeCounts).map(([grade, count]) => ({ status: grade, count }));

  const defaultFilterOptions: FilterDropdownOptions = {
    statuses: [],
    categories: [],
    makes: [],
    customers: [],
    vendors: [],
    grades: [],
  };

  const agingAlerts = agingData?.alerts || [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-inventory-title">Inventory Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Inventory aging, status, and value insights
          </p>
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <FilterPanel
        filters={filters}
        filterOptions={filterOptions || defaultFilterOptions}
        onFiltersChange={setFilters}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          title="Total Items"
          value={items.length.toLocaleString()}
          icon={<Boxes className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Value"
          value={formatCurrency(agingData?.totalInventoryValue || 0)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={agingLoading}
        />
        <KPICard
          title="Avg Days Held"
          value={`${agingData?.averageDaysHeld || 0} days`}
          icon={<Clock className="h-4 w-4" />}
          isLoading={agingLoading}
        />
        <KPICard
          title="Dead Stock"
          value={formatCurrency(agingData?.deadStockValue || 0)}
          icon={<AlertTriangle className="h-4 w-4" />}
          isLoading={agingLoading}
        />
        <KPICard
          title="Slow Moving"
          value={formatCurrency(agingData?.slowMovingValue || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={agingLoading}
        />
      </div>

      {agingAlerts.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="space-y-3">
              {agingAlerts.map((alert, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${alert.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <h3 className="font-medium text-sm">{alert.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                    <p className="text-xs text-primary mt-1">{alert.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Inventory Aging Buckets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agingLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (agingData?.agingBuckets || []).length > 0 ? (
              <div className="space-y-3">
                {(agingData?.agingBuckets || []).map((bucket, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{bucket.range}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{bucket.count} items</span>
                        <Badge variant={idx < 2 ? 'default' : idx < 4 ? 'secondary' : 'destructive'}>
                          {formatPercent(bucket.percentOfTotal)}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={bucket.percentOfTotal} className="h-1.5" />
                    <span className="text-xs text-muted-foreground">{formatCurrency(bucket.value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No aging data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Capital Lockup by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {agingLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (agingData?.capitalLockupByCategory || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={(agingData?.capitalLockupByCategory || []).slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'value' ? formatCurrency(value) : `${value} days`,
                      name === 'value' ? 'Value' : 'Avg Days'
                    ]}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatusChart data={statusData} isLoading={isLoading} title="Status Distribution" />
        <StatusChart data={gradeData} isLoading={isLoading} title="Grade Distribution" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={items} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
