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
import { Separator } from "@/components/ui/separator";
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
  QueryFilter, QuerySort, QueryResult, ChartType, AggregationType, FilterOperator, QueryEntity,
  JoinType, JoinCondition, QueryRelationship
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
  filterOperator?: FilterOperator;
  topN?: number;
}

function ValueFilterPopover({ 
  field, 
  selectedValues, 
  onValuesChange,
  onTopNChange,
  topN,
  operator = 'in',
  onOperatorChange,
}: { 
  field: PivotField; 
  selectedValues: string[];
  onValuesChange: (values: string[]) => void;
  onTopNChange?: (n: number | undefined) => void;
  topN?: number;
  operator?: FilterOperator;
  onOperatorChange?: (op: FilterOperator) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState(selectedValues[0] || "");
  
  const isCustomOperator = ['contains', 'starts_with', 'ends_with', 'not_equals', 'equals'].includes(operator);
  
  useEffect(() => {
    if (isCustomOperator) {
      setCustomValue(selectedValues[0] || "");
    }
  }, [operator, selectedValues, isCustomOperator]);
  
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
    enabled: open && !isCustomOperator,
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
    setCustomValue("");
  };

  const applyCustom = () => {
    if (customValue.trim()) {
      onValuesChange([customValue.trim()]);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" data-testid={`button-filter-${field.field}`}>
          <Filter className="h-3 w-3 mr-1" />
          {selectedValues.length > 0 ? `${selectedValues.length}` : 'Filter'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-16">Match:</Label>
            <Select 
              value={operator} 
              onValueChange={(v) => {
                const newOp = v as FilterOperator;
                const wasCustom = isCustomOperator;
                const willBeCustom = ['contains', 'starts_with', 'ends_with', 'not_equals', 'equals'].includes(newOp);
                onOperatorChange?.(newOp);
                if (wasCustom !== willBeCustom) {
                  onValuesChange([]);
                  setCustomValue("");
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Is one of (select below)</SelectItem>
                <SelectItem value="equals">Equals (type value)</SelectItem>
                <SelectItem value="not_equals">Not equals</SelectItem>
                <SelectItem value="contains">Contains text</SelectItem>
                <SelectItem value="starts_with">Starts with</SelectItem>
                <SelectItem value="ends_with">Ends with</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {isCustomOperator ? (
            <div className="space-y-2">
              <Input
                placeholder="Enter value..."
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="h-8 text-xs"
                data-testid={`input-custom-filter-${field.field}`}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={applyCustom}>Apply</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearAll}>Clear</Button>
              </div>
            </div>
          ) : (
            <>
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
                  All
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-xs flex-1" onClick={clearAll}>
                  Clear
                </Button>
              </div>
              {onTopNChange && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Limit:</Label>
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
            </>
          )}
        </div>
        {!isCustomOperator && (
          <ScrollArea className="h-48">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : valuesData?.values?.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No values found</p>
              ) : (
                [...(valuesData?.values || [])].sort((a, b) => a.value.localeCompare(b.value)).map((item) => (
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
        )}
      </PopoverContent>
    </Popover>
  );
}

function DateFilterPopover({
  field,
  selectedValues,
  onValuesChange,
}: {
  field: PivotField;
  selectedValues: string[];
  onValuesChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>(selectedValues[0] || '');
  const [endDate, setEndDate] = useState<string>(selectedValues[1] || '');

  const applyFilter = () => {
    const values: string[] = [];
    if (startDate) values.push(startDate);
    if (endDate) values.push(endDate);
    onValuesChange(values);
    setOpen(false);
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    onValuesChange([]);
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" data-testid={`button-date-filter-${field.field}`}>
          <Calendar className="h-3 w-3 mr-1" />
          {selectedValues.length > 0 ? 'Filtered' : 'Date Range'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="text-xs font-medium">Quick Select</div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setQuickRange(7)}>Last 7 days</Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setQuickRange(30)}>Last 30 days</Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setQuickRange(90)}>Last 90 days</Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setQuickRange(365)}>Last year</Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs"
                data-testid={`input-date-start-${field.field}`}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs"
                data-testid={`input-date-end-${field.field}`}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={applyFilter}>Apply</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearFilter}>Clear</Button>
          </div>
        </div>
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
  onFilterOperatorChange,
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
  onFilterOperatorChange?: (op: FilterOperator) => void;
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
          <SelectTrigger className="h-5 w-20 text-[10px] border-0 bg-transparent px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATIONS.map(agg => {
              const isNumericOnly = ['SUM', 'AVG', 'MIN', 'MAX'].includes(agg.value);
              const disabled = isNumericOnly && field.type !== 'numeric';
              return (
                <SelectItem 
                  key={agg.value} 
                  value={agg.value} 
                  className="text-xs"
                  disabled={disabled}
                >
                  {agg.label}
                </SelectItem>
              );
            })}
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
          operator={field.filterOperator || 'in'}
          onOperatorChange={onFilterOperatorChange}
        />
      )}
      
      {showFilter && onFilterChange && field.type === 'date' && (
        <DateFilterPopover 
          field={field} 
          selectedValues={field.filterValues || []} 
          onValuesChange={onFilterChange}
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
  joinType,
  onJoinTypeChange,
  joinConditions,
  onJoinConditionsChange,
}: {
  columnsData: { inventory: QueryColumn[]; returns: QueryColumn[]; relationships: any[] } | undefined;
  selectedEntities: QueryEntity[];
  onEntityToggle: (entity: QueryEntity) => void;
  onAddToRows: (col: QueryColumn) => void;
  onAddToColumns: (col: QueryColumn) => void;
  onAddToValues: (col: QueryColumn) => void;
  onAddToFilters: (col: QueryColumn) => void;
  joinType: JoinType | 'none';
  onJoinTypeChange: (type: JoinType | 'none') => void;
  joinConditions: JoinCondition[];
  onJoinConditionsChange: (conditions: JoinCondition[]) => void;
}) {
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [relationshipsOpen, setRelationshipsOpen] = useState(false);

  const filterColumns = (columns: QueryColumn[]) => {
    if (!searchTerm) return columns;
    return columns.filter(c => c.label.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const getFieldIcon = (col: QueryColumn) => {
    if (col.type === 'numeric') return <Hash className="h-3 w-3 text-blue-500" />;
    if (col.type === 'date') return <Calendar className="h-3 w-3 text-orange-500" />;
    return <Columns className="h-3 w-3 text-green-500" />;
  };

  const handleDragStart = (e: React.DragEvent, col: QueryColumn) => {
    e.dataTransfer.setData('application/json', JSON.stringify(col));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const ColumnItem = ({ col }: { col: QueryColumn }) => (
    <div 
      className="group flex items-center gap-1 px-2 py-1 rounded text-xs hover-elevate cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => handleDragStart(e, col)}
      data-testid={`draggable-field-${col.entity}-${col.field}`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
      {getFieldIcon(col)}
      <span className="flex-1 truncate">{col.label}</span>
      <div className="invisible group-hover:visible flex gap-0.5">
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToRows(col)} title="Add to Rows">
          <Rows3 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToColumns(col)} title="Add to Columns">
          <Columns className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToValues(col)} title="Add to Values">
          <Hash className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToFilters(col)} title="Add to Filters">
          <Filter className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full py-2">
      <div className="px-3 pb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Data Sources
        </h2>
      </div>
      <div className="px-3 space-y-3">
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

            {selectedEntities.includes('inventory') && selectedEntities.includes('returns') && (
              <Collapsible open={relationshipsOpen} onOpenChange={setRelationshipsOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 w-full text-sm font-medium hover-elevate rounded px-1 py-1">
                  {relationshipsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Layers className="h-4 w-4 text-purple-500" />
                  Join Builder
                  {joinConditions.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">{joinConditions.length}</Badge>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-2 pt-2 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Join Type</Label>
                    <Select value={joinType} onValueChange={(v) => onJoinTypeChange(v as JoinType | 'none')}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-join-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Join</SelectItem>
                        <SelectItem value="left">Left Join (All Inventory)</SelectItem>
                        <SelectItem value="inner">Inner Join (Matches Only)</SelectItem>
                        <SelectItem value="right">Right Join (All Returns)</SelectItem>
                        <SelectItem value="first">First Match (1:1)</SelectItem>
                        <SelectItem value="exists">Exists Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {joinType !== 'none' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Field Mappings</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs"
                          onClick={() => onJoinConditionsChange([...joinConditions, { leftField: '', rightField: '', comparator: '=' }])}
                          data-testid="button-add-join-condition"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                      
                      {joinConditions.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded">
                          Add field mappings to define the join
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {joinConditions.map((cond, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs">
                              <Select 
                                value={cond.leftField} 
                                onValueChange={(v) => {
                                  const updated = [...joinConditions];
                                  updated[idx] = { ...cond, leftField: v };
                                  onJoinConditionsChange(updated);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-left-field-${idx}`}>
                                  <SelectValue placeholder="Inventory field" />
                                </SelectTrigger>
                                <SelectContent>
                                  {columnsData?.inventory.map(col => (
                                    <SelectItem key={col.field} value={col.field}>{col.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              <Select 
                                value={cond.comparator} 
                                onValueChange={(v) => {
                                  const updated = [...joinConditions];
                                  updated[idx] = { ...cond, comparator: v as '=' | '!=' | '>' | '<' | '>=' | '<=' };
                                  onJoinConditionsChange(updated);
                                }}
                              >
                                <SelectTrigger className="h-7 w-12 text-xs" data-testid={`select-comparator-${idx}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="=">=</SelectItem>
                                  <SelectItem value="!=">!=</SelectItem>
                                  <SelectItem value=">">&gt;</SelectItem>
                                  <SelectItem value="<">&lt;</SelectItem>
                                  <SelectItem value=">=">&gt;=</SelectItem>
                                  <SelectItem value="<=">&lt;=</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Select 
                                value={cond.rightField} 
                                onValueChange={(v) => {
                                  const updated = [...joinConditions];
                                  updated[idx] = { ...cond, rightField: v };
                                  onJoinConditionsChange(updated);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-right-field-${idx}`}>
                                  <SelectValue placeholder="Returns field" />
                                </SelectTrigger>
                                <SelectContent>
                                  {columnsData?.returns.map(col => (
                                    <SelectItem key={col.field} value={col.field}>{col.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onJoinConditionsChange(joinConditions.filter((_, i) => i !== idx))}
                                data-testid={`button-remove-condition-${idx}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {joinConditions.length > 0 && joinConditions.every(c => c.leftField && c.rightField) && (
                        <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-2 rounded">
                          Ready: {joinConditions.length} field mapping(s) configured
                        </div>
                      )}
                      
                      {joinConditions.length > 0 && !joinConditions.every(c => c.leftField && c.rightField) && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                          Incomplete: Select fields for all mappings
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
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
  const [joinType, setJoinType] = useState<JoinType | 'none'>('none');
  const [joinConditions, setJoinConditions] = useState<JoinCondition[]>([]);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

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
      if (data.warnings && data.warnings.length > 0) {
        toast({ title: "Query executed with warnings", description: data.warnings[0], variant: "destructive" });
      } else {
        toast({ title: "Query executed", description: `${data.rowCount} rows in ${data.executionTime}ms` });
      }
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
    const defaultAgg = col.type === 'numeric' ? 'SUM' : 'COUNT_DISTINCT';
    const newField: PivotField = { ...col, id: generateId(), aggregation: defaultAgg };
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
          operator: f.filterOperator || 'in',
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
      relationships: selectedEntities.includes('returns') && joinType !== 'none' && joinConditions.length > 0 ? 
        [{
          id: 'rel-1',
          leftEntity: 'inventory' as QueryEntity,
          rightEntity: 'returns' as QueryEntity,
          joinType: joinType as JoinType,
          conditions: joinConditions,
          enabled: true
        }] : [],
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
          <div className="border rounded-md overflow-hidden w-full">
            <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]">
              <Table className="min-w-full">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {result.columns.map(col => (
                      <TableHead key={col.key} className="whitespace-nowrap text-xs px-3 py-2">{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row, i) => (
                    <TableRow key={i}>
                      {result.columns.map(col => (
                        <TableCell key={col.key} className="whitespace-nowrap text-xs px-3 py-1.5">
                          {formatValue(row[col.key], col.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
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
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card/50">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">Query Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create pivot tables and visualizations from your data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={clearAll} data-testid="button-clear-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button 
            onClick={executeQuery} 
            disabled={executeMutation.isPending}
            size="default"
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
        <div className="w-72 border-r bg-muted/20 overflow-auto">
          <DataSourcePanel
            columnsData={columnsData}
            selectedEntities={selectedEntities}
            onEntityToggle={toggleEntity}
            onAddToRows={addToRows}
            onAddToColumns={addToColumns}
            onAddToValues={addToValues}
            onAddToFilters={addToFilters}
            joinType={joinType}
            onJoinTypeChange={setJoinType}
            joinConditions={joinConditions}
            onJoinConditionsChange={setJoinConditions}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b p-4 bg-card/30">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Rows3 className="h-4 w-4" />
                  <Label className="text-xs font-medium">Rows</Label>
                  <span className="text-[10px] text-muted-foreground">(Group by)</span>
                </div>
                <div 
                  className={`min-h-[80px] p-3 border-2 border-dashed rounded-lg space-y-1.5 transition-colors ${
                    dragOverZone === 'rows' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-muted-foreground/20'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverZone('rows'); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    try {
                      const col = JSON.parse(e.dataTransfer.getData('application/json')) as QueryColumn;
                      addToRows(col);
                    } catch {}
                  }}
                  data-testid="dropzone-rows"
                >
                  {rowFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Drag fields here
                    </p>
                  ) : (
                    rowFields.map(field => (
                      <FieldPill
                        key={field.id}
                        field={field}
                        onRemove={() => removeRowField(field.id)}
                        onSortChange={(sort) => updateRowField(field.id, { sortOrder: sort })}
                        onFilterChange={(values) => updateRowField(field.id, { filterValues: values })}
                        onFilterOperatorChange={(op) => updateRowField(field.id, { filterOperator: op })}
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
                  <Label className="text-xs font-medium">Columns</Label>
                  <span className="text-[10px] text-muted-foreground">(Split by)</span>
                </div>
                <div 
                  className={`min-h-[80px] p-3 border-2 border-dashed rounded-lg space-y-1.5 transition-colors ${
                    dragOverZone === 'columns' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-muted-foreground/20'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverZone('columns'); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    try {
                      const col = JSON.parse(e.dataTransfer.getData('application/json')) as QueryColumn;
                      addToColumns(col);
                    } catch {}
                  }}
                  data-testid="dropzone-columns"
                >
                  {columnFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Drag fields here
                    </p>
                  ) : (
                    columnFields.map(field => (
                      <FieldPill
                        key={field.id}
                        field={field}
                        onRemove={() => removeColumnField(field.id)}
                        onSortChange={(sort) => updateColumnField(field.id, { sortOrder: sort })}
                        onFilterChange={(values) => updateColumnField(field.id, { filterValues: values })}
                        onFilterOperatorChange={(op) => updateColumnField(field.id, { filterOperator: op })}
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
                  <span className="text-[10px] text-muted-foreground">(Sum/Count)</span>
                </div>
                <div 
                  className={`min-h-[80px] p-3 border-2 border-dashed rounded-lg space-y-1.5 transition-colors ${
                    dragOverZone === 'values' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-muted-foreground/20'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverZone('values'); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    try {
                      const col = JSON.parse(e.dataTransfer.getData('application/json')) as QueryColumn;
                      addToValues(col);
                    } catch {}
                  }}
                  data-testid="dropzone-values"
                >
                  {valueFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Drag any field (numeric or text)
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
                  <span className="text-[10px] text-muted-foreground">(Limit data)</span>
                </div>
                <div 
                  className={`min-h-[80px] p-3 border-2 border-dashed rounded-lg space-y-1.5 transition-colors ${
                    dragOverZone === 'filters' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-muted-foreground/20'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverZone('filters'); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    try {
                      const col = JSON.parse(e.dataTransfer.getData('application/json')) as QueryColumn;
                      addToFilters(col);
                    } catch {}
                  }}
                  data-testid="dropzone-filters"
                >
                  {globalFilters.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Drag fields here
                    </p>
                  ) : (
                    globalFilters.map(field => (
                      <FieldPill
                        key={field.id}
                        field={field}
                        onRemove={() => removeGlobalFilter(field.id)}
                        onFilterChange={(values) => updateGlobalFilter(field.id, { filterValues: values })}
                        onFilterOperatorChange={(op) => updateGlobalFilter(field.id, { filterOperator: op })}
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
