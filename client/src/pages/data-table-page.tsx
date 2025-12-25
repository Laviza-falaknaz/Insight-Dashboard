import { useState, useEffect } from "react";
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
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from "recharts";
import { 
  Database, Layers, Filter, BarChart3, Play, Save, Sparkles, Plus, X, 
  ArrowUpDown, ChevronRight, TableIcon, PieChartIcon, LineChartIcon, 
  AreaChartIcon, Loader2, RefreshCw, Lightbulb
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  QueryColumn, QueryBuilderConfig, QueryDimension, QueryMeasure, 
  QueryFilter, QuerySort, QueryResult, QueryAIInterpretation, 
  ChartConfig, ChartType, AggregationType, FilterOperator, QueryEntity
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
  { value: 'is_null', label: 'Is Empty' },
  { value: 'is_not_null', label: 'Is Not Empty' },
];

const CHART_TYPES: { value: ChartType; label: string; icon: any }[] = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon },
  { value: 'area', label: 'Area Chart', icon: AreaChartIcon },
  { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  { value: 'table', label: 'Data Table', icon: TableIcon },
];

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export default function DataTablePage() {
  const { toast } = useToast();
  
  // Query builder state
  const [selectedEntities, setSelectedEntities] = useState<QueryEntity[]>(['inventory']);
  const [dimensions, setDimensions] = useState<QueryDimension[]>([]);
  const [measures, setMeasures] = useState<QueryMeasure[]>([]);
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [sorts, setSorts] = useState<QuerySort[]>([]);
  const [limit, setLimit] = useState(50);
  
  // Chart config
  const [chartType, setChartType] = useState<ChartType>('bar');
  
  // Results and interpretation
  const [result, setResult] = useState<QueryResult | null>(null);
  const [interpretation, setInterpretation] = useState<QueryAIInterpretation | null>(null);
  
  // Save dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState("");
  const [queryDescription, setQueryDescription] = useState("");

  // Fetch available columns
  const { data: columnsData, isLoading: columnsLoading } = useQuery<{
    inventory: QueryColumn[];
    returns: QueryColumn[];
    relationships: any[];
  }>({
    queryKey: ["/api/query-builder/columns"],
  });

  const availableColumns = columnsData ? [
    ...columnsData.inventory,
    ...(selectedEntities.includes('returns') ? columnsData.returns : [])
  ] : [];

  const textColumns = availableColumns.filter(c => c.type === 'text' || c.type === 'date');
  const numericColumns = availableColumns.filter(c => c.aggregatable);

  // Execute query mutation
  const executeMutation = useMutation({
    mutationFn: async (config: QueryBuilderConfig) => {
      const response = await apiRequest("POST", "/api/query-builder/execute", config);
      return response.json();
    },
    onSuccess: (data: QueryResult) => {
      setResult(data);
      toast({ title: "Query executed", description: `${data.rowCount} rows in ${data.executionTime}ms` });
    },
    onError: (error: any) => {
      toast({ title: "Query failed", description: error.message, variant: "destructive" });
    },
  });

  // AI interpretation mutation
  const interpretMutation = useMutation({
    mutationFn: async () => {
      const config = buildConfig();
      const response = await apiRequest("POST", "/api/query-builder/interpret", {
        config,
        result,
        chartConfig: { type: chartType, showLegend: true, showGrid: true },
      });
      return response.json();
    },
    onSuccess: (data: QueryAIInterpretation) => {
      setInterpretation(data);
    },
    onError: (error: any) => {
      toast({ title: "AI interpretation failed", description: error.message, variant: "destructive" });
    },
  });

  // Save mutation
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

  const buildConfig = (): QueryBuilderConfig => ({
    name: queryName || "Untitled Query",
    description: queryDescription,
    entities: selectedEntities,
    dimensions,
    measures,
    filters,
    sorts,
    relationships: selectedEntities.includes('returns') && columnsData?.relationships ? 
      [{ ...columnsData.relationships[0], type: 'left' as const }] : [],
    limit,
  });

  const executeQuery = () => {
    if (dimensions.length === 0 && measures.length === 0) {
      toast({ title: "Add fields", description: "Add at least one dimension or measure", variant: "destructive" });
      return;
    }
    executeMutation.mutate(buildConfig());
  };

  const addDimension = (column: QueryColumn) => {
    const newDim: QueryDimension = {
      id: generateId(),
      column,
      alias: column.label,
    };
    setDimensions([...dimensions, newDim]);
  };

  const removeDimension = (id: string) => {
    setDimensions(dimensions.filter(d => d.id !== id));
  };

  const addMeasure = (column: QueryColumn, aggregation: AggregationType = 'SUM') => {
    const newMeasure: QueryMeasure = {
      id: generateId(),
      column,
      aggregation,
      alias: `${aggregation} of ${column.label}`,
    };
    setMeasures([...measures, newMeasure]);
  };

  const removeMeasure = (id: string) => {
    setMeasures(measures.filter(m => m.id !== id));
  };

  const updateMeasureAggregation = (id: string, aggregation: AggregationType) => {
    setMeasures(measures.map(m => 
      m.id === id ? { ...m, aggregation, alias: `${aggregation} of ${m.column.label}` } : m
    ));
  };

  const addFilter = (column: QueryColumn) => {
    const newFilter: QueryFilter = {
      id: generateId(),
      column,
      operator: 'equals',
      value: '',
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<QueryFilter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const renderChart = () => {
    if (!result || result.data.length === 0) return null;
    
    const chartData = result.data.slice(0, 20);
    const xAxisKey = dimensions[0]?.alias || result.columns[0]?.key;
    const measureKeys = measures.map(m => m.alias);

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {measureKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {measureKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {measureKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={measureKeys[0] || 'value'}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'table':
      default:
        return (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map(col => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((row, i) => (
                  <TableRow key={i}>
                    {result.columns.map(col => (
                      <TableCell key={col.key}>
                        {col.type === 'numeric' ? formatCurrency(Number(row[col.key]) || 0) : row[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
    }
  };

  if (columnsLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Explore Data</h1>
          <p className="text-sm text-muted-foreground">
            Build custom insights by selecting entities, columns, and aggregations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            Save to Collection
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="entity-inventory"
                  checked={selectedEntities.includes('inventory')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEntities([...selectedEntities, 'inventory']);
                    } else {
                      setSelectedEntities(selectedEntities.filter(e => e !== 'inventory'));
                    }
                  }}
                  className="rounded"
                  data-testid="checkbox-entity-inventory"
                />
                <Label htmlFor="entity-inventory" className="text-sm">Inventory</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="entity-returns"
                  checked={selectedEntities.includes('returns')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEntities([...selectedEntities, 'returns']);
                    } else {
                      setSelectedEntities(selectedEntities.filter(e => e !== 'returns'));
                    }
                  }}
                  className="rounded"
                  data-testid="checkbox-entity-returns"
                />
                <Label htmlFor="entity-returns" className="text-sm">Returns</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Dimensions (Group By)
              </CardTitle>
              <CardDescription className="text-xs">
                Click to add columns for grouping
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {textColumns.map(col => (
                    <Button
                      key={`${col.entity}-${col.field}`}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      onClick={() => addDimension(col)}
                      data-testid={`button-add-dimension-${col.field}`}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {col.label}
                      <Badge variant="outline" className="ml-auto text-[10px]">{col.entity}</Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Measures (Aggregate)
              </CardTitle>
              <CardDescription className="text-xs">
                Click to add numeric columns with aggregation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {numericColumns.map(col => (
                    <Button
                      key={`${col.entity}-${col.field}`}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      onClick={() => addMeasure(col)}
                      data-testid={`button-add-measure-${col.field}`}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {col.label}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {availableColumns.slice(0, 10).map(col => (
                    <Button
                      key={`filter-${col.entity}-${col.field}`}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      onClick={() => addFilter(col)}
                      data-testid={`button-add-filter-${col.field}`}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {col.label}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Query Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dimensions.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Dimensions</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {dimensions.map(dim => (
                      <Badge key={dim.id} variant="secondary" className="gap-1">
                        {dim.alias}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeDimension(dim.id)}
                          data-testid={`button-remove-dimension-${dim.id}`}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {measures.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Measures</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {measures.map(m => (
                      <div key={m.id} className="flex items-center gap-1">
                        <Select
                          value={m.aggregation}
                          onValueChange={(v) => updateMeasureAggregation(m.id, v as AggregationType)}
                        >
                          <SelectTrigger className="h-7 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AGGREGATIONS.map(agg => (
                              <SelectItem key={agg.value} value={agg.value}>{agg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge variant="secondary" className="gap-1">
                          {m.column.label}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeMeasure(m.id)}
                            data-testid={`button-remove-measure-${m.id}`}
                          />
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filters.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Filters</Label>
                  <div className="space-y-2 mt-1">
                    {filters.map(f => (
                      <div key={f.id} className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{f.column.label}</Badge>
                        <Select
                          value={f.operator}
                          onValueChange={(v) => updateFilter(f.id, { operator: v as FilterOperator })}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPERATORS.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!['is_null', 'is_not_null'].includes(f.operator) && (
                          <Input
                            value={String(f.value)}
                            onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                            placeholder="Value..."
                            className="h-7 w-32 text-xs"
                            data-testid={`input-filter-value-${f.id}`}
                          />
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7"
                          onClick={() => removeFilter(f.id)}
                          data-testid={`button-remove-filter-${f.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Limit:</Label>
                  <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                    <SelectTrigger className="h-7 w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-sm font-medium">Results</CardTitle>
                    <CardDescription className="text-xs">
                      {result.rowCount} rows in {result.executionTime}ms
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 border rounded-md p-1">
                      {CHART_TYPES.map(ct => (
                        <Button
                          key={ct.value}
                          size="icon"
                          variant={chartType === ct.value ? "default" : "ghost"}
                          className="h-7 w-7"
                          onClick={() => setChartType(ct.value)}
                          data-testid={`button-chart-type-${ct.value}`}
                        >
                          <ct.icon className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => interpretMutation.mutate()}
                      disabled={interpretMutation.isPending}
                      data-testid="button-ai-interpret"
                    >
                      {interpretMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      AI Insights
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderChart()}
              </CardContent>
            </Card>
          )}

          {interpretation && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  AI Interpretation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{interpretation.summary}</p>
                
                {interpretation.insights.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Key Insights</Label>
                    <ul className="mt-1 space-y-1">
                      {interpretation.insights.map((insight, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {interpretation.recommendations.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Recommendations</Label>
                    <ul className="mt-1 space-y-1">
                      {interpretation.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Query to Collection</DialogTitle>
            <DialogDescription>
              Give your custom insight a name and description to save it for later use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="query-name">Name</Label>
              <Input
                id="query-name"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="e.g., Top Customers by Revenue"
                data-testid="input-query-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="query-description">Description (optional)</Label>
              <Textarea
                id="query-description"
                value={queryDescription}
                onChange={(e) => setQueryDescription(e.target.value)}
                placeholder="Describe what this insight shows..."
                className="min-h-20"
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
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
