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
  ArrowUp, ArrowDown, Settings2, Columns, Rows3, Hash, Calendar,
  RotateCcw, ArrowLeftRight
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

interface EntityMeta {
  id: QueryEntity;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface RelationshipMeta {
  id: string;
  sourceEntity: QueryEntity;
  targetEntity: QueryEntity;
  sourceField: string;
  targetField: string;
  label?: string;
  bidirectional: boolean;
  defaultJoinType: JoinType;
  supportedJoinTypes: JoinType[];
  joinFields: Array<{ from: string; to: string }>;
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
  primaryEntity,
  onPrimaryEntityChange,
}: {
  columnsData: { 
    inventory: QueryColumn[]; 
    returns: QueryColumn[]; 
    entities: EntityMeta[];
    relationships: RelationshipMeta[];
  } | undefined;
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
  primaryEntity: QueryEntity;
  onPrimaryEntityChange: (entity: QueryEntity) => void;
}) {
  const [activeSource, setActiveSource] = useState<QueryEntity>('inventory');
  const [searchTerm, setSearchTerm] = useState("");
  const [showJoinConfig, setShowJoinConfig] = useState(false);

  const entities = columnsData?.entities || [
    { id: 'inventory' as QueryEntity, name: 'Inventory', icon: 'Package', color: '#3b82f6' },
    { id: 'returns' as QueryEntity, name: 'Returns', icon: 'RotateCcw', color: '#f59e0b' },
  ];

  const relationships = columnsData?.relationships || [];

  const filterColumns = (columns: QueryColumn[]) => {
    if (!searchTerm) return columns;
    return columns.filter(c => c.label.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const getFieldIcon = (col: QueryColumn) => {
    if (col.type === 'numeric') return <Hash className="h-3 w-3 text-blue-500" />;
    if (col.type === 'date') return <Calendar className="h-3 w-3 text-orange-500" />;
    return <Columns className="h-3 w-3 text-green-500" />;
  };

  const getEntityIcon = (iconName?: string) => {
    if (iconName === 'RotateCcw') return <RotateCcw className="h-3.5 w-3.5 mx-auto mb-1" />;
    return <Database className="h-3.5 w-3.5 mx-auto mb-1" />;
  };

  const handleDragStart = (e: React.DragEvent, col: QueryColumn) => {
    e.dataTransfer.setData('application/json', JSON.stringify(col));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const hasValidJoin = joinType !== 'none' && joinConditions.some(c => c.leftField && c.rightField);
  const hasMultipleEntities = selectedEntities.length > 1;

  const getActiveRelationship = (): RelationshipMeta | undefined => {
    if (selectedEntities.length < 2) return undefined;
    return relationships.find(r => 
      (selectedEntities.includes(r.sourceEntity) && selectedEntities.includes(r.targetEntity)) ||
      (r.bidirectional && selectedEntities.includes(r.targetEntity) && selectedEntities.includes(r.sourceEntity))
    );
  };

  const activeRelationship = getActiveRelationship();

  const getColumnsForEntity = (entity: QueryEntity): QueryColumn[] => {
    if (!columnsData) return [];
    const columnsByEntity: Record<string, QueryColumn[]> = {
      inventory: columnsData.inventory || [],
      returns: columnsData.returns || [],
    };
    return columnsByEntity[entity] || [];
  };

  const getSecondaryEntity = (): QueryEntity | undefined => {
    return selectedEntities.find(e => e !== primaryEntity);
  };

  const secondaryEntity = getSecondaryEntity();

  const ColumnItem = ({ col }: { col: QueryColumn }) => (
    <div 
      className="group flex items-center gap-1.5 px-2 py-1.5 rounded text-xs hover-elevate cursor-grab active:cursor-grabbing border border-transparent hover:border-border/50"
      draggable
      onDragStart={(e) => handleDragStart(e, col)}
      data-testid={`draggable-field-${col.entity}-${col.field}`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
      {getFieldIcon(col)}
      <span className="flex-1 truncate">{col.label}</span>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToRows(col)} title="Add to Rows" aria-label="Add to Rows">
          <Rows3 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToColumns(col)} title="Add to Columns" aria-label="Add to Columns">
          <Columns className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToValues(col)} title="Add to Values" aria-label="Add to Values">
          <Hash className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onAddToFilters(col)} title="Add to Filters" aria-label="Add to Filters">
          <Filter className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  const activeColumns = filterColumns(getColumnsForEntity(activeSource));

  const getJoinLabel = (type: JoinType | 'none'): string => {
    const primaryName = entities.find(e => e.id === primaryEntity)?.name || 'Primary';
    const secondaryName = secondaryEntity ? (entities.find(e => e.id === secondaryEntity)?.name || 'Secondary') : 'Secondary';
    
    switch (type) {
      case 'none': return 'No Link';
      case 'left': return `Include All ${primaryName}`;
      case 'inner': return 'Only Matching Records';
      case 'right': return `Include All ${secondaryName}`;
      case 'first': return 'First Match Only';
      case 'exists': return 'Check If Exists';
      default: return type;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Sources</h2>
        </div>
        
        <div className="flex gap-2">
          {entities.map((entity) => {
            const isSelected = selectedEntities.includes(entity.id);
            const isActive = activeSource === entity.id;
            const isPrimary = primaryEntity === entity.id;
            
            return (
              <div key={entity.id} className="flex-1 flex flex-col">
                <button
                  onClick={() => { 
                    setActiveSource(entity.id); 
                    if (!isSelected) onEntityToggle(entity.id);
                  }}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors relative ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                  style={isActive ? {} : { borderLeft: `3px solid ${entity.color}` }}
                  data-testid={`button-source-${entity.id}`}
                >
                  {getEntityIcon(entity.icon)}
                  {entity.name}
                  {isPrimary && hasMultipleEntities && (
                    <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground px-1 rounded">
                      Primary
                    </span>
                  )}
                </button>
                {isSelected && entity.id !== 'inventory' && (
                  <button
                    onClick={() => { 
                      onEntityToggle(entity.id); 
                      if (activeSource === entity.id) setActiveSource('inventory');
                      if (primaryEntity === entity.id) onPrimaryEntityChange('inventory');
                    }}
                    className="text-[9px] text-muted-foreground hover:text-foreground mt-0.5"
                    data-testid={`button-remove-${entity.id}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {hasMultipleEntities && activeRelationship && (
          <div 
            className={`p-2 rounded-md border cursor-pointer transition-colors ${
              hasValidJoin 
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            }`}
            onClick={() => setShowJoinConfig(!showJoinConfig)}
            data-testid="button-toggle-join-config"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${hasValidJoin ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className="text-xs font-medium flex items-center gap-1">
                  {entities.find(e => e.id === primaryEntity)?.name}
                  <ArrowLeftRight className="h-3 w-3" />
                  {entities.find(e => e.id === secondaryEntity)?.name}
                  {activeRelationship.bidirectional && (
                    <span className="text-[9px] text-muted-foreground">(bidirectional)</span>
                  )}
                </span>
              </div>
              {showJoinConfig ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </div>
            
            {showJoinConfig && (
              <div className="mt-3 space-y-3" onClick={e => e.stopPropagation()}>
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-muted-foreground">Direction:</span>
                  <Button 
                    variant={primaryEntity === activeRelationship.sourceEntity ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => onPrimaryEntityChange(activeRelationship.sourceEntity)}
                  >
                    {entities.find(e => e.id === activeRelationship.sourceEntity)?.name} First
                  </Button>
                  {activeRelationship.bidirectional && (
                    <Button 
                      variant={primaryEntity === activeRelationship.targetEntity ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => onPrimaryEntityChange(activeRelationship.targetEntity)}
                    >
                      {entities.find(e => e.id === activeRelationship.targetEntity)?.name} First
                    </Button>
                  )}
                </div>

                <Select value={joinType} onValueChange={(v) => onJoinTypeChange(v as JoinType | 'none')}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-join-type">
                    <SelectValue placeholder="Select join type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Link</SelectItem>
                    {activeRelationship.supportedJoinTypes.map(type => (
                      <SelectItem key={type} value={type}>{getJoinLabel(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {joinType !== 'none' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Match Fields</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => onJoinConditionsChange([...joinConditions, { leftField: '', rightField: '', comparator: '=' }])}
                        data-testid="button-add-join-condition"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {joinConditions.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Add fields to match {entities.find(e => e.id === primaryEntity)?.name} with {entities.find(e => e.id === secondaryEntity)?.name}
                      </p>
                    )}
                    
                    {joinConditions.map((cond, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <Select value={cond.leftField} onValueChange={(v) => {
                          const updated = [...joinConditions];
                          updated[idx] = { ...cond, leftField: v };
                          onJoinConditionsChange(updated);
                        }}>
                          <SelectTrigger className="h-6 text-[10px] flex-1" data-testid={`select-left-field-${idx}`}>
                            <SelectValue placeholder={entities.find(e => e.id === primaryEntity)?.name} />
                          </SelectTrigger>
                          <SelectContent>
                            {getColumnsForEntity(primaryEntity).map(col => (
                              <SelectItem key={col.field} value={col.field} className="text-xs">{col.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground">=</span>
                        <Select value={cond.rightField} onValueChange={(v) => {
                          const updated = [...joinConditions];
                          updated[idx] = { ...cond, rightField: v };
                          onJoinConditionsChange(updated);
                        }}>
                          <SelectTrigger className="h-6 text-[10px] flex-1" data-testid={`select-right-field-${idx}`}>
                            <SelectValue placeholder={entities.find(e => e.id === secondaryEntity)?.name} />
                          </SelectTrigger>
                          <SelectContent>
                            {secondaryEntity && getColumnsForEntity(secondaryEntity).map(col => (
                              <SelectItem key={col.field} value={col.field} className="text-xs">{col.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => onJoinConditionsChange(joinConditions.filter((_, i) => i !== idx))}
                          data-testid={`button-remove-condition-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 h-7 text-xs"
            data-testid="input-search-fields"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-1">
        <div className="space-y-0.5 pb-2">
          {activeColumns.map(col => (
            <ColumnItem key={`${col.entity}-${col.field}`} col={col} />
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t text-[10px] text-muted-foreground text-center">
        Drag fields to workspace or click icons
      </div>
    </div>
  );
}

export default function DataTablePage() {
  const { toast } = useToast();
  
  const [selectedEntities, setSelectedEntities] = useState<QueryEntity[]>(['inventory']);
  const [primaryEntity, setPrimaryEntity] = useState<QueryEntity>('inventory');
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
    entities: Array<{ id: QueryEntity; name: string; description?: string; icon?: string; color?: string }>;
    relationships: Array<{
      id: string;
      sourceEntity: QueryEntity;
      targetEntity: QueryEntity;
      sourceField: string;
      targetField: string;
      label?: string;
      bidirectional: boolean;
      defaultJoinType: JoinType;
      supportedJoinTypes: JoinType[];
      joinFields: Array<{ from: string; to: string }>;
    }>;
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

  // Auto-enable entity when its column is used
  const ensureEntityEnabled = (entity: QueryEntity) => {
    if (!selectedEntities.includes(entity)) {
      setSelectedEntities(prev => [...prev, entity]);
    }
  };

  const addToRows = (col: QueryColumn) => {
    const exists = rowFields.some(f => f.entity === col.entity && f.field === col.field);
    if (!exists) {
      ensureEntityEnabled(col.entity);
      setRowFields([...rowFields, { ...col, id: generateId(), sortOrder: 'none' }]);
    }
  };

  const addToColumns = (col: QueryColumn) => {
    const exists = columnFields.some(f => f.entity === col.entity && f.field === col.field);
    if (!exists) {
      ensureEntityEnabled(col.entity);
      setColumnFields([...columnFields, { ...col, id: generateId(), sortOrder: 'none' }]);
    }
  };

  const addToValues = (col: QueryColumn) => {
    ensureEntityEnabled(col.entity);
    const defaultAgg = col.type === 'numeric' ? 'SUM' : 'COUNT_DISTINCT';
    const newField: PivotField = { ...col, id: generateId(), aggregation: defaultAgg };
    setValueFields([...valueFields, newField]);
  };

  const addToFilters = (col: QueryColumn) => {
    const exists = globalFilters.some(f => f.entity === col.entity && f.field === col.field);
    if (!exists) {
      ensureEntityEnabled(col.entity);
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

  // Check if any fields reference an entity
  const isEntityUsed = (entity: QueryEntity): boolean => {
    return rowFields.some(f => f.entity === entity) ||
           columnFields.some(f => f.entity === entity) ||
           valueFields.some(f => f.entity === entity) ||
           globalFilters.some(f => f.entity === entity);
  };

  // Auto-disable entity when no columns reference it (except inventory which is always required)
  const checkAndDisableEntity = (entity: QueryEntity, newFields: { row: PivotField[], col: PivotField[], val: PivotField[], filter: PivotField[] }) => {
    if (entity === 'inventory') return; // Always keep inventory
    const stillUsed = 
      newFields.row.some(f => f.entity === entity) ||
      newFields.col.some(f => f.entity === entity) ||
      newFields.val.some(f => f.entity === entity) ||
      newFields.filter.some(f => f.entity === entity);
    
    if (!stillUsed && selectedEntities.includes(entity)) {
      setSelectedEntities(prev => prev.filter(e => e !== entity));
    }
  };

  const removeRowField = (id: string) => {
    const fieldToRemove = rowFields.find(f => f.id === id);
    const newRowFields = rowFields.filter(f => f.id !== id);
    setRowFields(newRowFields);
    if (fieldToRemove) {
      setTimeout(() => checkAndDisableEntity(fieldToRemove.entity, { row: newRowFields, col: columnFields, val: valueFields, filter: globalFilters }), 0);
    }
  };
  
  const removeColumnField = (id: string) => {
    const fieldToRemove = columnFields.find(f => f.id === id);
    const newColFields = columnFields.filter(f => f.id !== id);
    setColumnFields(newColFields);
    if (fieldToRemove) {
      setTimeout(() => checkAndDisableEntity(fieldToRemove.entity, { row: rowFields, col: newColFields, val: valueFields, filter: globalFilters }), 0);
    }
  };
  
  const removeValueField = (id: string) => {
    const fieldToRemove = valueFields.find(f => f.id === id);
    const newValFields = valueFields.filter(f => f.id !== id);
    setValueFields(newValFields);
    if (fieldToRemove) {
      setTimeout(() => checkAndDisableEntity(fieldToRemove.entity, { row: rowFields, col: columnFields, val: newValFields, filter: globalFilters }), 0);
    }
  };
  
  const removeGlobalFilter = (id: string) => {
    const fieldToRemove = globalFilters.find(f => f.id === id);
    const newFilters = globalFilters.filter(f => f.id !== id);
    setGlobalFilters(newFilters);
    if (fieldToRemove) {
      setTimeout(() => checkAndDisableEntity(fieldToRemove.entity, { row: rowFields, col: columnFields, val: valueFields, filter: newFilters }), 0);
    }
  };

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
      relationships: (() => {
        // Filter out incomplete conditions (require both leftField and rightField)
        const validConditions = joinConditions.filter(c => c.leftField && c.rightField);
        if (selectedEntities.includes('returns') && joinType !== 'none' && validConditions.length > 0) {
          return [{
            id: 'rel-1',
            leftEntity: 'inventory' as QueryEntity,
            rightEntity: 'returns' as QueryEntity,
            joinType: joinType as JoinType,
            conditions: validConditions,
            enabled: true
          }];
        }
        return [];
      })(),
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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card/50">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight" data-testid="text-page-title">Query Builder</h1>
          <Badge variant="outline" className="text-[10px]">
            {selectedEntities.length > 1 ? 'Multi-source' : 'Inventory'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearAll} data-testid="button-clear-all">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Button 
            onClick={executeQuery} 
            disabled={executeMutation.isPending}
            size="sm"
            data-testid="button-execute-query"
          >
            {executeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Run
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            disabled={!result}
            data-testid="button-save-query"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r bg-muted/20 flex flex-col">
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
            primaryEntity={primaryEntity}
            onPrimaryEntityChange={setPrimaryEntity}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-4 py-3 bg-card/30">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Rows3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">Rows</span>
                </div>
                <div 
                  className={`min-h-[50px] p-2 border border-dashed rounded-md flex flex-wrap gap-1 transition-colors ${
                    dragOverZone === 'rows' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-muted-foreground/30'
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
                    <span className="text-[10px] text-muted-foreground w-full text-center py-2">Drop group-by fields</span>
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

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">Values</span>
                </div>
                <div 
                  className={`min-h-[50px] p-2 border border-dashed rounded-md flex flex-wrap gap-1 transition-colors ${
                    dragOverZone === 'values' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-muted-foreground/30'
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
                    <span className="text-[10px] text-muted-foreground w-full text-center py-2">Drop measure fields</span>
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

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">Filters</span>
                </div>
                <div 
                  className={`min-h-[50px] p-2 border border-dashed rounded-md flex flex-wrap gap-1 transition-colors ${
                    dragOverZone === 'filters' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-muted-foreground/30'
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
                    <span className="text-[10px] text-muted-foreground w-full text-center py-2">Drop filter fields</span>
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

            <div className="flex items-center gap-4 pt-2 border-t mt-3">
              <div className="flex items-center gap-1 pt-2">
                {CHART_TYPES.map(ct => (
                  <Button
                    key={ct.value}
                    variant={chartType === ct.value ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setChartType(ct.value)}
                    title={ct.label}
                    aria-label={ct.label}
                    data-testid={`button-chart-${ct.value}`}
                  >
                    <ct.icon className="h-3.5 w-3.5" />
                    <span className="sr-only">{ct.label}</span>
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 pt-2 ml-auto">
                <span className="text-[10px] text-muted-foreground">Rows:</span>
                <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v))}>
                  <SelectTrigger className="h-6 w-16 text-xs">
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
          
          {(rowFields.length > 0 || valueFields.length > 0 || globalFilters.length > 0) && (
            <div className="px-4 py-2 border-t bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                <span>{selectedEntities.join(' + ')}</span>
              </div>
              {rowFields.length > 0 && (
                <div className="flex items-center gap-1">
                  <Rows3 className="h-3 w-3" />
                  <span>{rowFields.length} group{rowFields.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {valueFields.length > 0 && (
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  <span>{valueFields.length} measure{valueFields.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {globalFilters.length > 0 && (
                <div className="flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  <span>{globalFilters.length} filter{globalFilters.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {result && (
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{result.rowCount} rows</Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{result.executionTime}ms</Badge>
                </div>
              )}
            </div>
          )}
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
