import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterPanel } from "@/components/filter-panel";
import type { InventoryItem, FilterDropdownOptions, FilterOptions } from "@shared/schema";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export default function DataTablePage() {
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
    if (filters.customer?.length) params.append("customer", filters.customer.join(","));
    if (filters.vendor?.length) params.append("vendor", filters.vendor.join(","));
    if (filters.gradeCondition?.length) params.append("gradeCondition", filters.gradeCondition.join(","));
    return params.toString();
  };

  const { data: inventoryData, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory", buildQueryParams()],
  });

  const { data: filterOptions } = useQuery<FilterDropdownOptions>({
    queryKey: ["/api/filters"],
  });

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
          <h1 className="text-2xl font-bold">Data Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and export inventory data
          </p>
        </div>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <FilterPanel
        filters={filters}
        filterOptions={filterOptions || defaultFilterOptions}
        onFiltersChange={setFilters}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Inventory Data
            {inventoryData && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({inventoryData.length.toLocaleString()} records)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={inventoryData || []} isLoading={isLoading} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
}
