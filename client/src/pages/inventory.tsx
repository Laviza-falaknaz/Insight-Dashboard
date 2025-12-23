import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterPanel } from "@/components/filter-panel";
import { KPICard } from "@/components/kpi-card";
import { StatusChart } from "@/components/charts/status-chart";
import { Boxes, Package, TrendingUp, DollarSign } from "lucide-react";
import type { InventoryItem, FilterDropdownOptions, FilterOptions } from "@shared/schema";

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

  const { data: filterOptions } = useQuery<FilterDropdownOptions>({
    queryKey: ["/api/filters"],
  });

  const items = inventoryData || [];
  
  const totalValue = items.reduce((sum, i) => sum + (i.TotalCostCurUSD || 0), 0);
  const totalSalesValue = items.reduce((sum, i) => sum + (i.FinalSalesPriceUSD || 0), 0);
  const avgItemValue = items.length > 0 ? totalValue / items.length : 0;

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

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            View and manage inventory items
          </p>
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <FilterPanel
        filters={filters}
        filterOptions={filterOptions || defaultFilterOptions}
        onFiltersChange={setFilters}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Items"
          value={items.length.toLocaleString()}
          icon={<Boxes className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Cost Value"
          value={formatCurrency(totalValue)}
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Sales Value"
          value={formatCurrency(totalSalesValue)}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Avg Item Cost"
          value={formatCurrency(avgItemValue)}
          icon={<Package className="h-4 w-4" />}
          isLoading={isLoading}
        />
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
