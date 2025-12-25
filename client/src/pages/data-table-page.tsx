import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from "recharts";
import { 
  Database, Layers, Filter, BarChart3, Play, Save, Plus, X, 
  ArrowUpDown, ChevronRight, ChevronDown, TableIcon, PieChartIcon, LineChartIcon, 
  AreaChartIcon, Loader2, RefreshCw, GripVertical, Search, Check,
  ArrowUp, ArrowDown, Settings2, Columns, Rows3, Hash, Calendar
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  QueryColumn, QueryBuilderConfig, QueryDimension, QueryMeasure, 
  QueryFilter, QuerySort, QueryResult, ChartType, AggregationType, FilterOperator, QueryEntity
} from "@shared/schema";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
];

const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: 'SUM', label: 'Sum' },
  { value: 'AVG', label: 'Average' },
  { value: 'COUNT', label: 'Count' },
  { value: 'COUNT_DISTINCT', label: 'Count Distinct' },
  { value: 'MIN', label: 'Minimum' },
  { value: 'MAX', label: 'Maximum' },
];

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'in', label: 'In List' },
  { value: 'is_null', label: 'Is Empty' },
  { value: 'is_not_null', label: 'Is Not Empty' },
];

const CHART_TYPES: { value: ChartType; label: string; icon: any }[] = [
  { value: 'table', label: 'Data Table', icon: TableIcon },
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon },
  { value: 'area', label: 'Area Chart', icon: AreaChartIcon },
  { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
];

const SORT_OPTIONS = [
  { value: 'none', label: 'No Sort' },
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

interface ColumnValuesResponse {
  field: string;
  entity: string;
  values: { value: string; count: number }[];
}

interface PivotField extends QueryColumn {
  id: string;
  sortOrder?: 'asc' | 'desc' | 'none';
  aggregation?: AggregationType;
  filterValues?: string[];
  topN?: number;
}

function ValueFilterPopover({ 
  field, 
  selectedValues, 
  onValuesChange,
  onTopNChange,
  topN
}: { 
  field: PivotField; 
  selectedValues: string[];
  onValuesChange: (values: string[]) => void;
  onTopNChange?: (n: number | undefined) => void;
  topN?: number;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  
  const { data: valuesData, isLoading } = useQuery<ColumnValuesResponse>({
    queryKey: ["/api/query-builder/column-values", field.entity, field.field, search],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/query-builder/column-values", {
        entity: field.entity,
        field: field.field,
        search,
        limit: 200
      });
      return response.json();
    },
    enabled: open,
  });

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onValuesChange(selectedValues.filter(v => v !== value));
    } else {
      onValuesChange([...selectedValues, value]);
    }
  };

  const selectAll = () => {
    if (valuesData?.values) {
      onValuesChange(valuesData.values.map(v => v.value));
    }
  };

  const clearAll = () => {
    onValuesChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" data-testid={`button-filter-${field.field}`}>
          <Filter className="h-3 w-3 mr-1" />
          {selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Filter'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
              data-testid={`input-filter-search-${field.field}`}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-6 text-xs flex-1" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-xs flex-1" onClick={clearAll}>
              Clear
            </Button>
          </div>
          {onTopNChange && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Top N:</Label>
              <Input
                type="number"
                placeholder="All"
                value={topN || ''}
                onChange={(e) => onTopNChange(e.target.value ? parseInt(e.target.value) : undefined)}
                className="h-6 w-16 text-xs"
                min={1}
                max={100}
              />
            </div>
          )}
        </div>
        <ScrollArea className="h-48">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : valuesData?.values?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No values found</p>
            ) : (
              valuesData?.values?.map((item) => (
                <div
                  key={item.value}
                  className="flex items-center gap-2 px-2 py-1 rounded hover-elevate cursor-pointer"
                  onClick={() => toggleValue(item.value)}
                  data-testid={`checkbox-filter-value-${item.value}`}
                >
                  <Checkbox checked={selectedValues.includes(item.value)} />
                  <span className="flex-1 text-xs truncate">{item.value}</span>
                  <Badge variant="secondary" className="text-[10px]">{item.count}</Badge>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function FieldPill({ 
  field, 
  onRemove, 
  onSortChange,
  onAggregationChange,
  onFilterChange,
  onTopNChange,
  showAggregation = false,
  showSort = true,
  showFilter = true,
}: { 
  field: PivotField; 
  onRemove: () => void;
  onSortChange?: (sort: 'asc' | 'desc' | 'none') => void;
  onAggregationChange?: (agg: AggregationType) => void;
  onFilterChange?: (values: string[]) => void;
  onTopNChange?: (n: number | undefined) => void;
  showAggregation?: boolean;
  showSort?: boolean;
  showFilter?: boolean;
}) {
  const [showSettings, setShowSettings] = useState(false);
  
  return (
    <div className="flex items-center gap-1 bg-muted/50 border rounded-md px-2 py-1">
      <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
      <span className="text-xs font-medium">{field.label}</span>
      <Badge variant="outline" className="text-[9px] ml-1">{field.entity}</Badge>
      
      {showAggregation && onAggregationChange && (
        <Select value={field.aggregation || 'SUM'} onValueChange={(v) => onAggregationChange(v as AggregationType)}>
          <SelectTrigger className="h-5 w-14 text-[10px] border-0 bg-transparent px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATIONS.map(agg => (
              <SelectItem key={agg.value} value={agg.value} className="text-xs">{agg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      
      {showSort && onSortChange && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => {
            const order = field.sortOrder === 'asc' ? 'desc' : field.sortOrder === 'desc' ? 'none' : 'asc';
            onSortChange(order);
          }}
          data-testid={`button-sort-${field.id}`}
        >
          {field.sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : 
           field.sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : 
           <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
        </Button>
      )}
      
      {showFilter && onFilterChange && field.type === 'text' && (
        <ValueFilterPopover 
          field={field} 
          selectedValues={field.filterValues || []} 
          onValuesChange={onFilterChange}
          onTopNChange={onTopNChange}
          topN={field.topN}
        />
      )}
      
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 ml-auto"
        onClick={onRemove}
        data-testid={`button-remove-${field.id}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function DataSourcePanel({ 
  columnsData, 
  selectedEntities,
  onEntityToggle,
  onAddToRows,
  onAddToColumns,
  onAddToValues,
  onAddToFilters,
}: {
  columnsData: { inventory: QueryColumn[]; returns: QueryColumn[]; relationships: any[] } | undefined;
  selectedEntities: QueryEntity[];
  onEntityToggle: (entity: QueryEntity) => void;
  onAddToRows: (col: QueryColumn) => void;
  onAddToColumns: (col: QueryColumn) => void;
  onAddToValues: (col: QueryColumn) => void;
  onAddToFilters: (col: QueryColumn) => void;
}) {
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filterColumns = (columns: QueryColumn[]) => {
    if (!searchTerm) return columns;
    return columns.filter(c => c.label.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const getFieldIcon = (col: QueryColumn) => {
    if (col.type === 'numeric') return <Hash className="h-3 w-3 text-blue-500" />;
    if (col.type === 'date') return <Calendar className="h-3 w-3 text-orange-500" />;
    return <Columns className="h-3 w-3 text-green-500" />;
  };

  const ColumnItem = ({ col }: { col: QueryColumn }) => (
    <div className="group flex items-center gap-1 px-2 py-1 rounded text-xs hover-elevate">
      {getFieldIcon(col)}
      <span className="flex-1 truncate">{col.label}</span>
      <div className="invisible group-hover:visible flex gap-0.5">
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToRows(col)} title="Add to Rows">
          <Rows3 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToColumns(col)} title="Add to Columns">
          <Columns className="h-3 w-3" />
        </Button>
        {col.aggregatable && (
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToValues(col)} title="Add to Values">
            <Hash className="h-3 w-3" />
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToFilters(col)} title="Add to Filters">
          <Filter className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Data Sources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8"
            data-testid="input-search-fields"
          />
        </div>
        
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-2">
            <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="entity-inventory"
                  checked={selectedEntities.includes('inventory')}
                  onCheckedChange={() => onEntityToggle('inventory')}
                  data-testid="checkbox-entity-inventory"
                />
                <CollapsibleTrigger className="flex items-center gap-1 flex-1 text-sm font-medium hover-elevate rounded px-1">
                  {inventoryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Inventory
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {columnsData?.inventory.length || 0}
                  </Badge>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="pl-6 pt-1 space-y-0.5">
                {filterColumns(columnsData?.inventory || []).map(col => (
                  <ColumnItem key={`${col.entity}-${col.field}`} col={col} />
                ))}
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={returnsOpen} onOpenChange={setReturnsOpen}>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="entity-returns"
                  checked={selectedEntities.includes('returns')}
                  onCheckedChange={() => onEntityToggle('returns')}
                  data-testid="checkbox-entity-returns"
                />
                <CollapsibleTrigger className="flex items-center gap-1 flex-1 text-sm font-medium hover-elevate rounded px-1">
                  {returnsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Returns
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {columnsData?.returns.length || 0}
                  </Badge>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="pl-6 pt-1 space-y-0.5">
                {filterColumns(columnsData?.returns || []).map(col => (
                  <ColumnItem key={`${col.entity}-${col.field}`} col={col} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function DataTablePage() {
  const { toast } = useToast();
  
  const [selectedEntities, setSelectedEntities] = useState<QueryEntity[]>(['inventory']);
  const [rowFields, setRowFields] = useState<PivotField[]>([]);
  const [columnFields, setColumnFields] = useState<PivotField[]>([]);
  const [valueFields, setValueFields] = useState<PivotField[]>([]);
  const [globalFilters, setGlobalFilters] = useState<PivotField[]>([]);
  const [limit, setLimit] = useState(100);
  const [chartType, setChartType] = useState<ChartType>('table');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const [activeView, setActiveView] = useState<'builder' | 'results'>('builder');

  const { data: columnsData, isLoading: columnsLoading } = useQuery<{
    inventory: QueryColumn[];
    returns: QueryColumn[];
    relationships: any[];
  }>({
    queryKey: ["/api/query-builder/columns"],
  });

  const executeMutation = useMutation({
    mutationFn: async (config: QueryBuilderConfig) => {
      const response = await apiRequest("POST", "/api/query-builder/execute", config);
      return response.json();
    },
    onSuccess: (data: QueryResult) => {
      setResult(data);
      setActiveView('results');
      toast({ title: "Query executed", description: `${data.rowCount} rows in ${data.executionTime}ms` });
    },
    onError: (error: any) => {
      toast({ title: "Query failed", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config = buildConfig();
      const response = await apiRequest("POST", "/api/collections", {
        name: queryName,
        description: queryDescription,
        insightType: "custom",
        queryConfig: JSON.stringify(config),
        chartType,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Query saved to your collection" });
      setShowSaveDialog(false);
      setQueryName("");
      setQueryDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleEntity = (entity: QueryEntity) => {
    if (selectedEntities.includes(entity)) {
      setSelectedEntities(selectedEntities.filter(e => e !== entity));
    } else {
      setSelectedEntities([...selectedEntities, entity]);
    }
  };

  const addToRows = (col: QueryColumn) => {
    const exists = rowFields.some(f => f.entity === col.entity && f.field === col.field);
    if (!exists) {
      setRowFields([...rowFields, { ...col, id: generateId(), sortOrder: 'none' }]);
    }
  };

  const addToColumns = (col: QueryColumn) => {
    const exists = columnFields.some(f => f.entity === col.entity && f.field === col.field);
    if (!exists) {
      setColumnFields([...columnFields, { ...col, id: generateId(), sortOrder: 'none' }]);
    }
  };

  const addToValues = (col: QueryColumn) => {
    const newField: PivotField = { ...col, id: generateId(), aggregation: 'SUM' };
    setValueFields([...valueFields, newField]);
  };

  const addToFilters = (col: QueryColumn) => {
    const exists = globalFilters.some(f => f.entity === col.entity && f.field === col.field);
    if (!exists) {
      setGlobalFilters([...globalFilters, { ...col, id: generateId(), filterValues: [] }]);
    }
  };

  const updateRowField = (id: string, updates: Partial<PivotField>) => {
    setRowFields(rowFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateColumnField = (id: string, updates: Partial<PivotField>) => {
    setColumnFields(columnFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateValueField = (id: string, updates: Partial<PivotField>) => {
    setValueFields(valueFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateGlobalFilter = (id: string, updates: Partial<PivotField>) => {
    setGlobalFilters(globalFilters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeRowField = (id: string) => setRowFields(rowFields.filter(f => f.id !== id));
  const removeColumnField = (id: string) => setColumnFields(columnFields.filter(f => f.id !== id));
  const removeValueField = (id: string) => setValueFields(valueFields.filter(f => f.id !== id));
  const removeGlobalFilter = (id: string) => setGlobalFilters(globalFilters.filter(f => f.id !== id));

  const buildConfig = (): QueryBuilderConfig => {
    const dimensions: QueryDimension[] = rowFields.map(f => ({
      id: f.id,
      column: { entity: f.entity, field: f.field, label: f.label, type: f.type, aggregatable: f.aggregatable },
      alias: f.label,
    }));

    const columnDimensions: QueryDimension[] = columnFields.map(f => ({
      id: f.id,
      column: { entity: f.entity, field: f.field, label: f.label, type: f.type, aggregatable: f.aggregatable },
      alias: f.label,
    }));

    const measures: QueryMeasure[] = valueFields.map(f => ({
      id: f.id,
      column: { entity: f.entity, field: f.field, label: f.label, type: f.type, aggregatable: f.aggregatable },
      aggregation: f.aggregation || 'SUM',
      alias: `${f.aggregation || 'SUM'} of ${f.label}`,
    }));

    const filters: QueryFilter[] = [];
    
    [...rowFields, ...columnFields, ...globalFilters].forEach(f => {
      if (f.filterValues && f.filterValues.length > 0) {
        filters.push({
          id: generateId(),
          column: { entity: f.entity, field: f.field, label: f.label, type: f.type, aggregatable: f.aggregatable },
          operator: 'in',
          value: f.filterValues.join(','),
        });
      }
    });

    const sorts: QuerySort[] = [...rowFields, ...columnFields]
      .filter(f => f.sortOrder && f.sortOrder !== 'none')
      .map(f => ({
        columnId: f.label,
        direction: f.sortOrder as 'asc' | 'desc',
      }));

    return {
      name: queryName || "Pivot Query",
      description: queryDescription,
      entities: selectedEntities,
      dimensions,
      columnDimensions: columnDimensions.length > 0 ? columnDimensions : undefined,
      measures,
      filters,
      sorts,
      relationships: selectedEntities.includes('returns') && columnsData?.relationships ? 
        [{ ...columnsData.relationships[0], type: 'left' as const }] : [],
      limit,
    };
  };

  const executeQuery = () => {
    if (rowFields.length === 0 && columnFields.length === 0 && valueFields.length === 0) {
      toast({ title: "Add fields", description: "Add at least one row, column, or value field", variant: "destructive" });
      return;
    }
    executeMutation.mutate(buildConfig());
  };

  const clearAll = () => {
    setRowFields([]);
    setColumnFields([]);
    setValueFields([]);
    setGlobalFilters([]);
    setResult(null);
  };

  const formatValue = (value: unknown, type?: string) => {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (!isNaN(num) && type === 'numeric') {
      if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
      if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(1)}K`;
      return `$${num.toFixed(0)}`;
    }
    return String(value);
  };

  const renderChart = () => {
    if (!result || result.data.length === 0) return null;
    
    const chartData = result.data.slice(0, 50);
    const xAxisKey = result.columns[0]?.key;
    const measureKeys = result.columns.filter(c => c.type === 'numeric').map(c => c.key);

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatValue(v, 'numeric')} />
              <Tooltip formatter={(value: any) => formatValue(value, 'numeric')} />
              <Legend />
              {measureKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatValue(v, 'numeric')} />
              <Tooltip formatter={(value: any) => formatValue(value, 'numeric')} />
              <Legend />
              {measureKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatValue(v, 'numeric')} />
              <Tooltip formatter={(value: any) => formatValue(value, 'numeric')} />
              <Legend />
              {measureKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = chartData.slice(0, 10).map((row, i) => ({
          name: String(row[xAxisKey] || `Item ${i + 1}`),
          value: Number(row[measureKeys[0]] || 0),
        }));
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatValue(value, 'numeric')} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'table':
      default:
        return (
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {result.columns.map(col => (
                      <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row, i) => (
                    <TableRow key={i}>
                      {result.columns.map(col => (
                        <TableCell key={col.key} className="whitespace-nowrap">
                          {formatValue(row[col.key], col.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
    }
  };

  if (columnsLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Pivot Table Builder</h1>
          <p className="text-sm text-muted-foreground">
            Build dynamic reports like Excel pivot tables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearAll} data-testid="button-clear-all">
            <RefreshCw className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button 
            onClick={executeQuery} 
            disabled={executeMutation.isPending}
            data-testid="button-execute-query"
          >
            {executeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run Query
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowSaveDialog(true)}
            disabled={!result}
            data-testid="button-save-query"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r p-3 overflow-auto">
          <DataSourcePanel
            columnsData={columnsData}
            selectedEntities={selectedEntities}
            onEntityToggle={toggleEntity}
            onAddToRows={addToRows}
            onAddToColumns={addToColumns}
            onAddToValues={addToValues}
            onAddToFilters={addToFilters}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Rows3 className="h-4 w-4" />
                  <Label className="text-xs font-medium">Primary Grouping</Label>
                </div>
                <div className="min-h-[80px] p-2 border rounded-md bg-muted/30 space-y-1">
                  {rowFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Main row labels
                    </p>
                  ) : (
                    rowFields.map(field => (
                      <FieldPill
                        key={field.id}
                        field={field}
                        onRemove={() => removeRowField(field.id)}
                        onSortChange={(sort) => updateRowField(field.id, { sortOrder: sort })}
                        onFilterChange={(values) => updateRowField(field.id, { filterValues: values })}
                        onTopNChange={(n) => updateRowField(field.id, { topN: n })}
                        showAggregation={false}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Columns className="h-4 w-4" />
                  <Label className="text-xs font-medium">Secondary Grouping</Label>
                </div>
                <div className="min-h-[80px] p-2 border rounded-md bg-muted/30 space-y-1">
                  {columnFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Additional breakdown
                    </p>
                  ) : (
                    columnFields.map(field => (
                      <FieldPill
                        key={field.id}
                        field={field}
                        onRemove={() => removeColumnField(field.id)}
                        onSortChange={(sort) => updateColumnField(field.id, { sortOrder: sort })}
                        onFilterChange={(values) => updateColumnField(field.id, { filterValues: values })}
                        showAggregation={false}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  <Label className="text-xs font-medium">Values</Label>
                </div>
                <div className="min-h-[80px] p-2 border rounded-md bg-muted/30 space-y-1">
                  {valueFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Add measures
                    </p>
                  ) : (
                    valueFields.map(field => (
                      <FieldPill
                        key={field.id}
                        field={field}
                        onRemove={() => removeValueField(field.id)}
                        onAggregationChange={(agg) => updateValueField(field.id, { aggregation: agg })}
                        showAggregation={true}
                        showSort={false}
                        showFilter={false}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <Label className="text-xs font-medium">Filters</Label>
                </div>
                <div className="min-h-[80px] p-2 border rounded-md bg-muted/30 space-y-1">
                  {globalFilters.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Add filters
                    </p>
                  ) : (
                    globalFilters.map(field => (
                      <FieldPill
                        key={field.id}
                        field={field}
                        onRemove={() => removeGlobalFilter(field.id)}
                        onFilterChange={(values) => updateGlobalFilter(field.id, { filterValues: values })}
                        showSort={false}
                        showAggregation={false}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Chart Type:</Label>
                <div className="flex gap-1">
                  {CHART_TYPES.map(ct => (
                    <Button
                      key={ct.value}
                      variant={chartType === ct.value ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setChartType(ct.value)}
                      data-testid={`button-chart-${ct.value}`}
                    >
                      <ct.icon className="h-3 w-3 mr-1" />
                      {ct.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Limit:</Label>
                <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v))}>
                  <SelectTrigger className="h-7 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100, 250, 500, 1000].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {result ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      Query Results
                      <Badge variant="secondary" className="ml-2">
                        {result.rowCount} rows
                      </Badge>
                      <Badge variant="outline" className="ml-2">
                        {result.executionTime}ms
                      </Badge>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {renderChart()}
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">Build Your Pivot Table</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Select data sources, add fields to rows and values, 
                      apply filters, and run your query to see results.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Query to Collection</DialogTitle>
            <DialogDescription>
              Save this query configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="query-name">Name</Label>
              <Input
                id="query-name"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="My Sales Analysis"
                data-testid="input-query-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="query-desc">Description (optional)</Label>
              <Textarea
                id="query-desc"
                value={queryDescription}
                onChange={(e) => setQueryDescription(e.target.value)}
                placeholder="Describe what this query shows..."
                data-testid="input-query-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => saveMutation.mutate()} 
              disabled={!queryName || saveMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Query
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
