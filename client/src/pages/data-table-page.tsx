import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from "recharts";
import { 
  Database, Filter, BarChart3, Play, Save, Plus, X, 
  ChevronRight, ChevronDown, TableIcon, PieChartIcon, LineChartIcon, 
  AreaChartIcon, Loader2, RefreshCw, Search, ArrowUp, ArrowDown,
  ArrowLeftRight, Columns, Hash, Calendar, RotateCcw, Code, Copy, Check
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  QueryColumn, QueryBuilderConfig, QueryResult, ChartType, AggregationType, FilterOperator, QueryEntity,
  JoinType, JoinCondition
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

const FILTER_OPERATORS: { value: FilterOperator; label: string; types: string[]; needsValue?: boolean; needsSecondValue?: boolean }[] = [
  { value: 'equals', label: '=', types: ['text', 'numeric', 'date'] },
  { value: 'not_equals', label: '!=', types: ['text', 'numeric', 'date'] },
  { value: 'greater_than', label: '>', types: ['numeric', 'date'] },
  { value: 'less_than', label: '<', types: ['numeric', 'date'] },
  { value: 'greater_equal', label: '>=', types: ['numeric', 'date'] },
  { value: 'less_equal', label: '<=', types: ['numeric', 'date'] },
  { value: 'between', label: 'Between', types: ['numeric', 'date'], needsSecondValue: true },
  { value: 'contains', label: 'Contains', types: ['text'] },
  { value: 'starts_with', label: 'Starts With', types: ['text'] },
  { value: 'ends_with', label: 'Ends With', types: ['text'] },
  { value: 'in', label: 'In List', types: ['text', 'numeric'] },
  { value: 'not_in', label: 'Not In List', types: ['text', 'numeric'] },
  { value: 'is_null', label: 'Is Empty', types: ['text', 'numeric', 'date'], needsValue: false },
  { value: 'is_not_null', label: 'Is Not Empty', types: ['text', 'numeric', 'date'], needsValue: false },
];

const DATE_PRESETS: { value: string; label: string; getRange: () => { start: string; end?: string } }[] = [
  { value: 'today', label: 'Today', getRange: () => {
    const today = new Date();
    return { start: today.toISOString().split('T')[0] };
  }},
  { value: 'yesterday', label: 'Yesterday', getRange: () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return { start: d.toISOString().split('T')[0] };
  }},
  { value: 'this_week', label: 'This Week', getRange: () => {
    const today = new Date();
    const day = today.getDay();
    const start = new Date(today); start.setDate(today.getDate() - day);
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }},
  { value: 'last_7_days', label: 'Last 7 Days', getRange: () => {
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - 7);
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }},
  { value: 'last_30_days', label: 'Last 30 Days', getRange: () => {
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - 30);
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }},
  { value: 'this_month', label: 'This Month', getRange: () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }},
  { value: 'last_month', label: 'Last Month', getRange: () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }},
  { value: 'this_quarter', label: 'This Quarter', getRange: () => {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const start = new Date(today.getFullYear(), quarter * 3, 1);
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }},
  { value: 'this_year', label: 'This Year', getRange: () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }},
  { value: 'last_90_days', label: 'Last 90 Days', getRange: () => {
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - 90);
    return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }},
];

const JOIN_TYPES: { value: JoinType; label: string; description: string }[] = [
  { value: 'inner', label: 'INNER JOIN', description: 'Only matching records from both' },
  { value: 'left', label: 'LEFT JOIN', description: 'All from primary, matching from secondary' },
  { value: 'right', label: 'RIGHT JOIN', description: 'All from secondary, matching from primary' },
  { value: 'exists', label: 'EXISTS', description: 'Check if related record exists' },
];

const CHART_TYPES: { value: ChartType; label: string; icon: any }[] = [
  { value: 'table', label: 'Table', icon: TableIcon },
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'line', label: 'Line', icon: LineChartIcon },
  { value: 'area', label: 'Area', icon: AreaChartIcon },
  { value: 'pie', label: 'Pie', icon: PieChartIcon },
];

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

interface SelectedColumn {
  id: string;
  entity: QueryEntity;
  field: string;
  label: string;
  type: string;
  aggregation?: AggregationType;
  alias?: string;
}

interface QueryFilterItem {
  id: string;
  entity: QueryEntity;
  field: string;
  label: string;
  type: string;
  operator: FilterOperator;
  value: string;
  value2?: string;
  datePreset?: string;
}

interface OrderByItem {
  id: string;
  entity: QueryEntity;
  field: string;
  label: string;
  direction: 'asc' | 'desc';
}

interface RelationshipMeta {
  id: string;
  sourceEntity: QueryEntity;
  targetEntity: QueryEntity;
  sourceField: string;
  targetField: string;
  label?: string;
  bidirectional: boolean;
  isDefault?: boolean;
  defaultJoinType: JoinType;
  supportedJoinTypes: JoinType[];
  joinFields?: Array<{ from: string; to: string }>;
}

export default function DataTablePage() {
  const { toast } = useToast();
  
  // Entity selection
  const [primaryEntity, setPrimaryEntity] = useState<QueryEntity>('returns');
  const [secondaryEntity, setSecondaryEntity] = useState<QueryEntity | null>(null);
  
  // Column selection
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  
  // Filters
  const [filters, setFilters] = useState<QueryFilterItem[]>([]);
  
  // Order By
  const [orderBy, setOrderBy] = useState<OrderByItem[]>([]);
  
  // Join configuration
  const [joinType, setJoinType] = useState<JoinType>('left');
  const [joinConditions, setJoinConditions] = useState<JoinCondition[]>([]);
  const [selectedJoinPreset, setSelectedJoinPreset] = useState<string | null>(null);
  
  // Limit & output
  const [limit, setLimit] = useState(100);
  const [chartType, setChartType] = useState<ChartType>('table');
  const [result, setResult] = useState<QueryResult | null>(null);
  
  // UI state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    entity: true,
    columns: true,
    filters: false,
    orderBy: false,
    join: false,
  });
  const [columnSearch, setColumnSearch] = useState("");
  const [showSqlPreview, setShowSqlPreview] = useState(true);
  const [sqlCopied, setSqlCopied] = useState(false);

  const { data: columnsData, isLoading: columnsLoading } = useQuery<{
    inventory: QueryColumn[];
    returns: QueryColumn[];
    entities: Array<{ id: QueryEntity; name: string; description?: string; icon?: string; color?: string }>;
    relationships: RelationshipMeta[];
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

  const entities = columnsData?.entities || [];
  const relationships = columnsData?.relationships || [];

  const getColumnsForEntity = (entity: QueryEntity): QueryColumn[] => {
    if (!columnsData) return [];
    const columnsByEntity: Record<string, QueryColumn[]> = {
      inventory: columnsData.inventory || [],
      returns: columnsData.returns || [],
    };
    return columnsByEntity[entity] || [];
  };

  const allAvailableColumns = useMemo(() => {
    const cols: QueryColumn[] = [...getColumnsForEntity(primaryEntity)];
    if (secondaryEntity) {
      cols.push(...getColumnsForEntity(secondaryEntity));
    }
    if (columnSearch) {
      return cols.filter(c => 
        c.field.toLowerCase().includes(columnSearch.toLowerCase()) ||
        c.label.toLowerCase().includes(columnSearch.toLowerCase())
      );
    }
    return cols;
  }, [columnsData, primaryEntity, secondaryEntity, columnSearch]);

  const activeRelationship = useMemo(() => {
    if (!secondaryEntity) return undefined;
    return relationships.find(r => 
      (r.sourceEntity === primaryEntity && r.targetEntity === secondaryEntity) ||
      (r.bidirectional && r.targetEntity === primaryEntity && r.sourceEntity === secondaryEntity)
    );
  }, [relationships, primaryEntity, secondaryEntity]);

  const availableJoinPresets = useMemo(() => {
    if (!secondaryEntity) return [];
    return relationships.filter(r => 
      (r.sourceEntity === primaryEntity && r.targetEntity === secondaryEntity) ||
      (r.bidirectional && r.targetEntity === primaryEntity && r.sourceEntity === secondaryEntity)
    );
  }, [relationships, primaryEntity, secondaryEntity]);

  const toggleColumn = (col: QueryColumn) => {
    const exists = selectedColumns.find(c => c.entity === col.entity && c.field === col.field);
    if (exists) {
      setSelectedColumns(selectedColumns.filter(c => c.id !== exists.id));
    } else {
      setSelectedColumns([...selectedColumns, {
        id: generateId(),
        entity: col.entity,
        field: col.field,
        label: col.label,
        type: col.type,
      }]);
    }
  };

  const updateColumnAggregation = (id: string, aggregation: AggregationType | undefined) => {
    setSelectedColumns(selectedColumns.map(c => 
      c.id === id ? { ...c, aggregation } : c
    ));
  };

  const addFilter = () => {
    if (allAvailableColumns.length === 0) return;
    const firstCol = allAvailableColumns[0];
    setFilters([...filters, {
      id: generateId(),
      entity: firstCol.entity,
      field: firstCol.field,
      label: firstCol.label,
      type: firstCol.type,
      operator: 'equals',
      value: '',
    }]);
  };

  const updateFilter = (id: string, updates: Partial<QueryFilterItem>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const addOrderBy = () => {
    if (selectedColumns.length === 0) return;
    const firstCol = selectedColumns[0];
    setOrderBy([...orderBy, {
      id: generateId(),
      entity: firstCol.entity,
      field: firstCol.field,
      label: firstCol.label,
      direction: 'asc',
    }]);
  };

  const updateOrderBy = (id: string, updates: Partial<OrderByItem>) => {
    setOrderBy(orderBy.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOrderBy = (id: string) => {
    setOrderBy(orderBy.filter(o => o.id !== id));
  };

  const addJoinCondition = () => {
    setJoinConditions([...joinConditions, { leftField: '', rightField: '', comparator: '=' }]);
  };

  const updateJoinCondition = (idx: number, updates: Partial<JoinCondition>) => {
    const updated = [...joinConditions];
    updated[idx] = { ...updated[idx], ...updates };
    setJoinConditions(updated);
  };

  const removeJoinCondition = (idx: number) => {
    setJoinConditions(joinConditions.filter((_, i) => i !== idx));
  };

  const buildConfig = (): QueryBuilderConfig => {
    const aggregatedCols = selectedColumns.filter(c => c.aggregation);
    const groupByCols = selectedColumns.filter(c => !c.aggregation);
    
    const selectedEntities: QueryEntity[] = [primaryEntity];
    if (secondaryEntity) selectedEntities.push(secondaryEntity);

    const getColumnObject = (entity: QueryEntity, field: string, label: string, type: string): QueryColumn => ({
      entity,
      field,
      label,
      type: type as 'text' | 'numeric' | 'date',
      aggregatable: type === 'numeric',
    });

    return {
      name: 'Custom Query',
      entities: selectedEntities,
      dimensions: groupByCols.map(c => ({
        id: c.id,
        column: getColumnObject(c.entity, c.field, c.label, c.type),
        alias: c.label,
      })),
      measures: aggregatedCols.map(c => ({
        id: c.id,
        column: getColumnObject(c.entity, c.field, c.label, c.type),
        aggregation: c.aggregation!,
        alias: `${c.aggregation} of ${c.label}`,
      })),
      filters: filters.map(f => ({
        id: f.id,
        column: getColumnObject(f.entity, f.field, f.label, f.type),
        operator: f.operator,
        value: f.operator === 'between' && f.value2 ? [f.value, f.value2] : f.value,
      })),
      sorts: orderBy.map(o => ({
        columnId: o.field,
        direction: o.direction,
      })),
      relationships: (() => {
        if (!secondaryEntity || joinConditions.length === 0) return [];
        const validConditions = joinConditions.filter(c => c.leftField && c.rightField);
        if (validConditions.length === 0) return [];
        return [{
          id: 'rel-1',
          leftEntity: primaryEntity,
          rightEntity: secondaryEntity,
          joinType: joinType,
          conditions: validConditions,
          enabled: true,
        }];
      })(),
      limit,
    };
  };

  const generateSqlPreview = (): string => {
    if (selectedColumns.length === 0) return '-- SELECT columns to build a query';
    
    const aggregatedCols = selectedColumns.filter(c => c.aggregation);
    const groupByCols = selectedColumns.filter(c => !c.aggregation);
    
    const selectParts = selectedColumns.map(c => {
      const colName = `${c.entity}.${c.field}`;
      if (c.aggregation) {
        return `${c.aggregation.toUpperCase()}(${colName}) AS "${c.aggregation}_${c.field}"`;
      }
      return colName;
    });
    
    let sql = `SELECT ${selectParts.join(',\n       ')}`;
    sql += `\nFROM ${primaryEntity}`;
    
    if (secondaryEntity && joinConditions.length > 0) {
      const validConditions = joinConditions.filter(c => c.leftField && c.rightField);
      if (validConditions.length > 0) {
        const onClause = validConditions.map(c => `${primaryEntity}.${c.leftField} = ${secondaryEntity}.${c.rightField}`).join(' AND ');
        
        if (joinType === 'exists') {
          sql += `\nWHERE EXISTS (\n  SELECT 1 FROM ${secondaryEntity}\n  WHERE ${onClause}\n)`;
        } else if (joinType === 'first') {
          sql += `\nLEFT JOIN LATERAL (\n  SELECT * FROM ${secondaryEntity}\n  WHERE ${onClause}\n  LIMIT 1\n) AS ${secondaryEntity}_first ON TRUE`;
        } else {
          sql += `\n${joinType.toUpperCase()} JOIN ${secondaryEntity}`;
          sql += `\n  ON ${validConditions.map(c => `${primaryEntity}.${c.leftField} = ${secondaryEntity}.${c.rightField}`).join('\n  AND ')}`;
        }
      }
    }
    
    const validJoinConditions = secondaryEntity && joinConditions.length > 0 
      ? joinConditions.filter(c => c.leftField && c.rightField)
      : [];
    const hasExistsClause = joinType === 'exists' && validJoinConditions.length > 0;
    
    if (filters.length > 0) {
      const filterParts = filters.map(f => {
        const colName = `${f.entity}.${f.field}`;
        if (f.operator === 'is_null') return `${colName} IS NULL`;
        if (f.operator === 'is_not_null') return `${colName} IS NOT NULL`;
        if (f.operator === 'contains') return `${colName} LIKE '%${f.value}%'`;
        if (f.operator === 'starts_with') return `${colName} LIKE '${f.value}%'`;
        if (f.operator === 'ends_with') return `${colName} LIKE '%${f.value}'`;
        if (f.operator === 'between' && f.value2) return `${colName} BETWEEN '${f.value}' AND '${f.value2}'`;
        if (f.operator === 'in') return `${colName} IN (${f.value.split(',').map(v => `'${v.trim()}'`).join(', ')})`;
        if (f.operator === 'not_in') return `${colName} NOT IN (${f.value.split(',').map(v => `'${v.trim()}'`).join(', ')})`;
        const opMap: Record<string, string> = {
          'equals': '=', 'not_equals': '!=', 'greater_than': '>', 'less_than': '<',
          'greater_equal': '>=', 'less_equal': '<='
        };
        const sqlOp = opMap[f.operator] || f.operator;
        return `${colName} ${sqlOp} '${f.value}'`;
      });
      if (hasExistsClause) {
        sql += `\n  AND ${filterParts.join('\n  AND ')}`;
      } else {
        sql += `\nWHERE ${filterParts.join('\n  AND ')}`;
      }
    }
    
    if (aggregatedCols.length > 0 && groupByCols.length > 0) {
      sql += `\nGROUP BY ${groupByCols.map(c => `${c.entity}.${c.field}`).join(', ')}`;
    }
    
    if (orderBy.length > 0) {
      sql += `\nORDER BY ${orderBy.map(o => `${o.entity}.${o.field} ${o.direction.toUpperCase()}`).join(', ')}`;
    }
    
    sql += `\nLIMIT ${limit}`;
    
    return sql;
  };

  const executeQuery = () => {
    if (selectedColumns.length === 0) {
      toast({ title: "Select columns", description: "Add at least one column to your query", variant: "destructive" });
      return;
    }
    executeMutation.mutate(buildConfig());
  };

  const clearAll = () => {
    setSelectedColumns([]);
    setFilters([]);
    setOrderBy([]);
    setJoinConditions([]);
    setResult(null);
  };

  const formatValue = (value: unknown, type?: string) => {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (!isNaN(num) && type === 'numeric') {
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
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
                <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} />
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
        const pieKey = measureKeys[0];
        if (!pieKey) return null;
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie data={chartData} dataKey={pieKey} nameKey={xAxisKey} cx="50%" cy="50%" outerRadius={150} label>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatValue(value, 'numeric')} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map(col => (
                    <TableHead key={col.key} className="text-xs whitespace-nowrap">{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((row, i) => (
                  <TableRow key={i}>
                    {result.columns.map(col => (
                      <TableCell key={col.key} className="text-xs">
                        {formatValue(row[col.key], col.type)}
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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getFieldIcon = (type: string) => {
    if (type === 'numeric') return <Hash className="h-3 w-3 text-blue-500" />;
    if (type === 'date') return <Calendar className="h-3 w-3 text-orange-500" />;
    return <Columns className="h-3 w-3 text-green-500" />;
  };

  const formatColumnName = (field: string): string => {
    // Handle both camelCase and snake_case
    // First convert camelCase to spaces: "relatedOrderName" -> "related Order Name"
    const withSpaces = field.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Then replace underscores with spaces and convert to uppercase
    return withSpaces.replace(/_/g, ' ').toUpperCase();
  };

  if (columnsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Query Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearAll} data-testid="button-clear-all">
            <RefreshCw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button onClick={executeQuery} disabled={executeMutation.isPending} size="sm" data-testid="button-execute-query">
            {executeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Run Query
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} disabled={!result} data-testid="button-save-query">
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Query Builder Panel */}
        <div className="w-80 border-r bg-muted/20 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              
              {/* 1. FROM - Entity Selection */}
              <Collapsible open={expandedSections.entity} onOpenChange={() => toggleSection('entity')}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-md bg-card border cursor-pointer hover-elevate">
                    <div className="flex items-center gap-2">
                      {expandedSections.entity ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-sm font-medium">FROM</span>
                      <Badge variant="secondary" className="text-xs">{primaryEntity}</Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Primary Entity</Label>
                    <Select value={primaryEntity} onValueChange={(v) => setPrimaryEntity(v as QueryEntity)}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-primary-entity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {entities.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Join With (optional)</Label>
                    <Select value={secondaryEntity || 'none'} onValueChange={(v) => setSecondaryEntity(v === 'none' ? null : v as QueryEntity)}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-secondary-entity">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {entities.filter(e => e.id !== primaryEntity).map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 2. JOIN Configuration */}
              {secondaryEntity && (
                <Collapsible open={expandedSections.join} onOpenChange={() => toggleSection('join')}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-2 rounded-md bg-card border cursor-pointer hover-elevate">
                      <div className="flex items-center gap-2">
                        {expandedSections.join ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">JOIN</span>
                        <Badge variant="outline" className="text-xs">{joinType.toUpperCase()}</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-2">
                    {/* Preset Join Key Selector */}
                    {availableJoinPresets.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Join Preset</Label>
                        <Select 
                          value={selectedJoinPreset || 'custom'} 
                          onValueChange={(v) => {
                            if (v === 'custom') {
                              setSelectedJoinPreset(null);
                              setJoinConditions([]);
                            } else {
                              setSelectedJoinPreset(v);
                              const preset = relationships.find(r => r.id === v);
                              if (preset) {
                                const isBidirectionalSwapped = preset.bidirectional && preset.targetEntity === primaryEntity;
                                
                                // Use joinFields if available (multi-field support), otherwise fall back to single field
                                const fields = preset.joinFields && preset.joinFields.length > 0
                                  ? preset.joinFields
                                  : [{ from: preset.sourceField, to: preset.targetField }];
                                
                                const conditions = fields.map(f => ({
                                  leftField: isBidirectionalSwapped ? f.to : f.from,
                                  rightField: isBidirectionalSwapped ? f.from : f.to,
                                  comparator: '=' as const
                                }));
                                
                                setJoinConditions(conditions);
                                setJoinType(preset.defaultJoinType);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm" data-testid="select-join-preset">
                            <SelectValue placeholder="Select preset..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableJoinPresets.map(preset => (
                              <SelectItem key={preset.id} value={preset.id}>
                                <div className="flex items-center gap-1">
                                  {preset.isDefault && <Badge variant="default" className="text-[9px] h-4">Default</Badge>}
                                  <span>{preset.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Join Type</Label>
                      <Select value={joinType} onValueChange={(v) => setJoinType(v as JoinType)}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-join-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JOIN_TYPES.map(j => (
                            <SelectItem key={j.value} value={j.value}>
                              <div>
                                <div className="font-medium">{j.label}</div>
                                <div className="text-xs text-muted-foreground">{j.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">ON Conditions</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addJoinCondition}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      {joinConditions.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">Add conditions to match records</p>
                      )}
                      {joinConditions.map((cond, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Select value={cond.leftField} onValueChange={(v) => updateJoinCondition(idx, { leftField: v })}>
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder={entities.find(e => e.id === primaryEntity)?.name} />
                            </SelectTrigger>
                            <SelectContent>
                              {getColumnsForEntity(primaryEntity).map(col => (
                                <SelectItem key={col.field} value={col.field} className="text-xs">{formatColumnName(col.field)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs">=</span>
                          <Select value={cond.rightField} onValueChange={(v) => updateJoinCondition(idx, { rightField: v })}>
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder={entities.find(e => e.id === secondaryEntity)?.name} />
                            </SelectTrigger>
                            <SelectContent>
                              {getColumnsForEntity(secondaryEntity).map(col => (
                                <SelectItem key={col.field} value={col.field} className="text-xs">{formatColumnName(col.field)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeJoinCondition(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* 3. SELECT - Column Selection */}
              <Collapsible open={expandedSections.columns} onOpenChange={() => toggleSection('columns')}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-md bg-card border cursor-pointer hover-elevate">
                    <div className="flex items-center gap-2">
                      {expandedSections.columns ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-sm font-medium">SELECT</span>
                      <Badge variant="secondary" className="text-xs">{selectedColumns.length}</Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Search columns..." 
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      className="pl-7 h-7 text-xs"
                    />
                  </div>
                  
                  {/* Selected columns with aggregation */}
                  {selectedColumns.length > 0 && (
                    <div className="space-y-1 p-2 bg-muted/50 rounded-md">
                      <Label className="text-xs text-muted-foreground">Selected Columns ({selectedColumns.length})</Label>
                      {selectedColumns.map(col => (
                        <div key={col.id} className="flex items-center gap-1 text-xs bg-background p-1.5 rounded">
                          {getFieldIcon(col.type)}
                          <span className="flex-1 truncate text-[11px]" title={formatColumnName(col.field)}>{formatColumnName(col.field)}</span>
                          <Select 
                            value={col.aggregation || 'none'} 
                            onValueChange={(v) => updateColumnAggregation(col.id, v === 'none' ? undefined : v as AggregationType)}
                          >
                            <SelectTrigger className="h-6 w-24 text-[10px]" data-testid={`select-agg-${col.field}`}>
                              <SelectValue placeholder="Aggregate" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Group By</SelectItem>
                              {AGGREGATIONS.map(a => (
                                <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setSelectedColumns(selectedColumns.filter(c => c.id !== col.id))}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Available columns */}
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allAvailableColumns.map(col => {
                      const isSelected = selectedColumns.some(c => c.entity === col.entity && c.field === col.field);
                      return (
                        <div 
                          key={`${col.entity}-${col.field}`}
                          className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer hover-elevate ${isSelected ? 'bg-primary/10' : ''}`}
                          onClick={() => toggleColumn(col)}
                          data-testid={`column-${col.entity}-${col.field}`}
                        >
                          <Checkbox checked={isSelected} className="h-3 w-3" />
                          {getFieldIcon(col.type)}
                          <span className="flex-1 truncate">{formatColumnName(col.field)}</span>
                          <Badge variant="outline" className="text-[9px] px-1">{col.entity.slice(0, 3).toUpperCase()}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 4. WHERE - Filters */}
              <Collapsible open={expandedSections.filters} onOpenChange={() => toggleSection('filters')}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-md bg-card border cursor-pointer hover-elevate">
                    <div className="flex items-center gap-2">
                      {expandedSections.filters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">WHERE</span>
                      {filters.length > 0 && <Badge variant="secondary" className="text-xs">{filters.length}</Badge>}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addFilter}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Filter
                  </Button>
                  {filters.map((filter, idx) => (
                    <div key={filter.id} className="space-y-1 p-2 bg-muted/50 rounded-md">
                      {idx > 0 && <span className="text-xs text-muted-foreground">AND</span>}
                      <div className="flex items-center gap-1">
                        <Select 
                          value={`${filter.entity}.${filter.field}`} 
                          onValueChange={(v) => {
                            const [entity, field] = v.split('.');
                            const col = allAvailableColumns.find(c => c.entity === entity && c.field === field);
                            if (col) {
                              updateFilter(filter.id, { entity: col.entity, field: col.field, label: col.label, type: col.type });
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allAvailableColumns.map(col => (
                              <SelectItem key={`${col.entity}.${col.field}`} value={`${col.entity}.${col.field}`} className="text-xs">
                                {formatColumnName(col.field)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFilter(filter.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Select value={filter.operator} onValueChange={(v) => {
                          const updates: Partial<QueryFilterItem> = { operator: v as FilterOperator };
                          if (['is_null', 'is_not_null'].includes(v)) {
                            updates.value = '';
                            updates.value2 = undefined;
                            updates.datePreset = undefined;
                          }
                          updateFilter(filter.id, updates);
                        }}>
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPERATORS.filter(op => op.types.includes(filter.type)).map(op => (
                              <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!['is_null', 'is_not_null'].includes(filter.operator) && (
                          <>
                            {filter.type === 'date' && (
                              <Select 
                                value={filter.datePreset || 'custom'} 
                                onValueChange={(v) => {
                                  if (v === 'custom') {
                                    updateFilter(filter.id, { datePreset: undefined });
                                  } else {
                                    const preset = DATE_PRESETS.find(p => p.value === v);
                                    if (preset) {
                                      const range = preset.getRange();
                                      updateFilter(filter.id, { 
                                        datePreset: v, 
                                        value: range.start,
                                        value2: range.end,
                                        operator: range.end ? 'between' : 'equals'
                                      });
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue placeholder="Preset..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="custom" className="text-xs">Custom Date</SelectItem>
                                  {DATE_PRESETS.map(p => (
                                    <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {filter.operator === 'between' ? (
                              <div className="flex items-center gap-1 flex-1">
                                <Input 
                                  type={filter.type === 'date' ? 'date' : filter.type === 'numeric' ? 'number' : 'text'}
                                  value={filter.value}
                                  onChange={(e) => updateFilter(filter.id, { value: e.target.value, datePreset: undefined })}
                                  placeholder="From"
                                  className="h-7 text-xs flex-1"
                                />
                                <span className="text-xs text-muted-foreground">to</span>
                                <Input 
                                  type={filter.type === 'date' ? 'date' : filter.type === 'numeric' ? 'number' : 'text'}
                                  value={filter.value2 || ''}
                                  onChange={(e) => updateFilter(filter.id, { value2: e.target.value, datePreset: undefined })}
                                  placeholder="To"
                                  className="h-7 text-xs flex-1"
                                />
                              </div>
                            ) : ['in', 'not_in'].includes(filter.operator) ? (
                              <Input 
                                value={filter.value}
                                onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                placeholder="value1, value2, value3..."
                                className="h-7 text-xs flex-1"
                              />
                            ) : (
                              <Input 
                                type={filter.type === 'date' ? 'date' : filter.type === 'numeric' ? 'number' : 'text'}
                                value={filter.value}
                                onChange={(e) => updateFilter(filter.id, { value: e.target.value, datePreset: undefined })}
                                placeholder={filter.type === 'text' && ['contains', 'starts_with', 'ends_with'].includes(filter.operator) ? 'Pattern...' : 'Value'}
                                className="h-7 text-xs flex-1"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* 5. ORDER BY */}
              <Collapsible open={expandedSections.orderBy} onOpenChange={() => toggleSection('orderBy')}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-md bg-card border cursor-pointer hover-elevate">
                    <div className="flex items-center gap-2">
                      {expandedSections.orderBy ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <ArrowUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">ORDER BY</span>
                      {orderBy.length > 0 && <Badge variant="secondary" className="text-xs">{orderBy.length}</Badge>}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addOrderBy} disabled={selectedColumns.length === 0}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Sort
                  </Button>
                  {orderBy.map((order) => (
                    <div key={order.id} className="flex items-center gap-1 p-2 bg-muted/50 rounded-md">
                      <Select 
                        value={`${order.entity}.${order.field}`}
                        onValueChange={(v) => {
                          const [entity, field] = v.split('.');
                          const col = selectedColumns.find(c => c.entity === entity && c.field === field);
                          if (col) {
                            updateOrderBy(order.id, { entity: col.entity, field: col.field, label: col.label });
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedColumns.map(col => (
                            <SelectItem key={`${col.entity}.${col.field}`} value={`${col.entity}.${col.field}`} className="text-xs">
                              {col.aggregation ? `${col.aggregation}(${formatColumnName(col.field)})` : formatColumnName(col.field)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant={order.direction === 'asc' ? 'default' : 'outline'} 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => updateOrderBy(order.id, { direction: 'asc' })}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant={order.direction === 'desc' ? 'default' : 'outline'} 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => updateOrderBy(order.id, { direction: 'desc' })}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeOrderBy(order.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* 6. LIMIT */}
              <div className="flex items-center gap-2 p-2 rounded-md bg-card border">
                <span className="text-sm font-medium">LIMIT</span>
                <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v))}>
                  <SelectTrigger className="h-7 w-20 text-xs">
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
          </ScrollArea>
        </div>

        {/* Results Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SQL Preview */}
          <Collapsible open={showSqlPreview} onOpenChange={setShowSqlPreview}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">SQL Preview</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(generateSqlPreview());
                      setSqlCopied(true);
                      setTimeout(() => setSqlCopied(false), 2000);
                    }}
                    data-testid="button-copy-sql"
                  >
                    {sqlCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    <span className="ml-1 text-xs">{sqlCopied ? 'Copied' : 'Copy'}</span>
                  </Button>
                  {showSqlPreview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 py-3 bg-muted/20 border-b">
                <pre 
                  className="text-xs font-mono overflow-x-auto p-3 rounded-md bg-background border whitespace-pre-wrap"
                  data-testid="sql-preview-code"
                >
                  {generateSqlPreview()}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Chart type selector */}
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-card/50">
            <span className="text-xs text-muted-foreground">View:</span>
            {CHART_TYPES.map(ct => (
              <Button
                key={ct.value}
                variant={chartType === ct.value ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setChartType(ct.value)}
                data-testid={`button-chart-${ct.value}`}
              >
                <ct.icon className="h-3.5 w-3.5" />
              </Button>
            ))}
            {result && (
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="secondary">{result.rowCount} rows</Badge>
                <Badge variant="outline">{result.executionTime}ms</Badge>
              </div>
            )}
          </div>

          {/* Results display */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {result ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Query Results</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {renderChart()}
                  </CardContent>
                </Card>
              ) : (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <BarChart3 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Build Your Query</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Select columns, add filters, and run your query to see results.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Query</DialogTitle>
            <DialogDescription>Save this query for quick access later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="query-name">Name</Label>
              <Input
                id="query-name"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="My Query"
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
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!queryName || saveMutation.isPending} data-testid="button-confirm-save">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
