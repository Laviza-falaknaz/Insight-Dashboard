import { useState } from "react";
import { Filter, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { FilterOptions, FilterDropdownOptions } from "@shared/schema";

interface FilterPanelProps {
  filters: FilterOptions;
  filterOptions: FilterDropdownOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  isLoading?: boolean;
}

export function FilterPanel({
  filters,
  filterOptions,
  onFiltersChange,
  isLoading,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = [
    filters.status?.length,
    filters.category?.length,
    filters.make?.length,
    filters.customer?.length,
    filters.vendor?.length,
    filters.gradeCondition?.length,
  ].filter((v) => v && v > 0).length;

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    if (value === "all") {
      const newFilters = { ...filters };
      delete newFilters[key];
      onFiltersChange(newFilters);
    } else {
      onFiltersChange({
        ...filters,
        [key]: [value],
      });
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  };

  const removeFilter = (key: keyof FilterOptions) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 flex-wrap">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-toggle-filters">
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}

          {filters.status?.map((s) => (
            <Badge key={`status-${s}`} variant="secondary" className="gap-1">
              Status: {s}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter("status")}
              />
            </Badge>
          ))}
          {filters.category?.map((c) => (
            <Badge key={`category-${c}`} variant="secondary" className="gap-1">
              Category: {c}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter("category")}
              />
            </Badge>
          ))}
          {filters.make?.map((m) => (
            <Badge key={`make-${m}`} variant="secondary" className="gap-1">
              Make: {m}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter("make")}
              />
            </Badge>
          ))}
          {filters.gradeCondition?.map((g) => (
            <Badge key={`grade-${g}`} variant="secondary" className="gap-1">
              Grade: {g}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter("gradeCondition")}
              />
            </Badge>
          ))}
        </div>

        <CollapsibleContent className="mt-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 bg-muted/30 rounded-md">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Status
              </label>
              <Select
                value={filters.status?.[0] || "all"}
                onValueChange={(v) => handleFilterChange("status", v)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8" data-testid="select-filter-status">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {filterOptions.statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Category
              </label>
              <Select
                value={filters.category?.[0] || "all"}
                onValueChange={(v) => handleFilterChange("category", v)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8" data-testid="select-filter-category">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {filterOptions.categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Make
              </label>
              <Select
                value={filters.make?.[0] || "all"}
                onValueChange={(v) => handleFilterChange("make", v)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8" data-testid="select-filter-make">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Makes</SelectItem>
                  {filterOptions.makes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Grade
              </label>
              <Select
                value={filters.gradeCondition?.[0] || "all"}
                onValueChange={(v) => handleFilterChange("gradeCondition", v)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8" data-testid="select-filter-grade">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {filterOptions.grades.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Customer
              </label>
              <Select
                value={filters.customer?.[0] || "all"}
                onValueChange={(v) => handleFilterChange("customer", v)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8" data-testid="select-filter-customer">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {filterOptions.customers.slice(0, 50).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Vendor
              </label>
              <Select
                value={filters.vendor?.[0] || "all"}
                onValueChange={(v) => handleFilterChange("vendor", v)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8" data-testid="select-filter-vendor">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {filterOptions.vendors.slice(0, 50).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
