import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { Folder, Play, Trash2, Edit2, Loader2, Search, BarChart3, PieChartIcon, LineChartIcon, TableIcon, FolderOpen, Sparkles, RefreshCw, ChevronRight, Lightbulb } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavedCollection, QueryAIInterpretation, QueryBuilderConfig } from "@shared/schema";

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

export default function MyCollectionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedCollection, setSelectedCollection] = useState<SavedCollection | null>(null);
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [collectionColumns, setCollectionColumns] = useState<{ key: string; label: string; dataType: string; aggregation?: string }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<QueryAIInterpretation | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: collections, isLoading } = useQuery<SavedCollection[]>({
    queryKey: ["/api/collections"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/collections/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Collection deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      setShowDeleteDialog(false);
      setSelectedCollection(null);
      setCollectionData([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: number; name: string; description: string }) => {
      const response = await apiRequest("PATCH", `/api/collections/${id}`, { name, description });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Collection updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    },
  });

  const runCollection = async (collection: SavedCollection) => {
    setSelectedCollection(collection);
    setIsRunning(true);
    setInterpretation(null);
    setCollectionData([]);
    setCollectionColumns([]);
    
    try {
      const config = JSON.parse(collection.queryConfig);
      
      // Check if this is a custom query builder config or legacy insight type
      if (collection.insightType === 'custom' && config.dimensions) {
        // New query builder format
        const response = await apiRequest("POST", "/api/query-builder/execute", config);
        const result = await response.json();
        setCollectionData(result.data || []);
        setCollectionColumns(result.columns || []);
      } else {
        // Legacy insight type
        const response = await apiRequest("POST", `/api/explore/${collection.insightType}`, config);
        const result = await response.json();
        setCollectionData(result.data || []);
        setCollectionColumns([]);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to run collection", variant: "destructive" });
      setCollectionData([]);
      setCollectionColumns([]);
    } finally {
      setIsRunning(false);
    }
  };

  const refreshInterpretation = async () => {
    if (!selectedCollection || collectionData.length === 0) return;
    
    setIsInterpreting(true);
    try {
      const config = JSON.parse(selectedCollection.queryConfig);
      
      // Build column metadata that matches the interpret endpoint contract
      const columnMetadata = collectionColumns.length > 0 
        ? collectionColumns.map(c => ({
            key: c.key,
            label: c.label,
            dataType: c.dataType || 'text',
            aggregation: c.aggregation,
          }))
        : Object.keys(collectionData[0] || {}).map(key => ({
            key,
            label: key,
            dataType: typeof collectionData[0][key] === 'number' ? 'number' : 'text',
          }));
      
      const response = await apiRequest("POST", "/api/query-builder/interpret", {
        config,
        result: { 
          data: collectionData.slice(0, 100), 
          columns: columnMetadata, 
          rowCount: collectionData.length, 
          executionTime: 0 
        },
        chartConfig: { 
          type: selectedCollection.chartType || 'bar', 
          showLegend: true, 
          showGrid: true 
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to generate interpretation');
      }
      
      const result = await response.json();
      setInterpretation(result);
      toast({ title: "AI Analysis Complete", description: "Interpretation updated with latest data" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate interpretation", variant: "destructive" });
    } finally {
      setIsInterpreting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getDataKey = (insightType: string) => {
    switch (insightType) {
      case "category": return "category";
      case "customer": return "customer";
      case "vendor": return "vendor";
      case "product": return "make";
      case "monthly": return "month";
      default: return "category";
    }
  };

  const renderChart = (collection: SavedCollection, data: any[]) => {
    if (data.length === 0) return null;

    const isCustom = collection.insightType === 'custom' && collectionColumns.length > 0;
    const chartData = data.slice(0, 20);
    const chartType = collection.chartType || "bar";
    
    // For custom queries, use dynamic columns; for legacy, use fixed columns
    // Find the first non-numeric column as the category/dimension key
    let dataKey = isCustom && collectionColumns.length > 0 
      ? (collectionColumns.find(c => c.dataType !== 'number')?.key || collectionColumns[0].key)
      : getDataKey(collection.insightType);
    
    // Find numeric columns for measures (check both 'dataType' and 'aggregation' presence)
    const measureKeys = isCustom && collectionColumns.length > 0
      ? collectionColumns.filter(c => c.dataType === 'number' || c.aggregation).map(c => c.key)
      : ['revenue', 'profit'];
    
    // Fallback if no numeric columns found for custom queries
    const effectiveMeasureKeys = measureKeys.length > 0 ? measureKeys : (isCustom ? Object.keys(chartData[0] || {}).filter(k => typeof chartData[0][k] === 'number') : ['revenue', 'profit']);

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={dataKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {effectiveMeasureKeys.map((key, i) => (
                <Bar key={key} dataKey={key} name={key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={effectiveMeasureKeys[0] || "revenue"}
                nameKey={dataKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
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

      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={dataKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {effectiveMeasureKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} name={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={dataKey} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {effectiveMeasureKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} name={key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "table":
      default:
        // For custom queries, use dataType; for legacy, use type
        const displayColumns = isCustom && collectionColumns.length > 0 
          ? collectionColumns.map(c => ({ ...c, isNumeric: c.dataType === 'number' || !!c.aggregation }))
          : [
              { key: dataKey, label: dataKey.charAt(0).toUpperCase() + dataKey.slice(1), isNumeric: false },
              { key: 'revenue', label: 'Revenue', isNumeric: true },
              { key: 'profit', label: 'Profit', isNumeric: true },
              { key: 'margin', label: 'Margin', isNumeric: true },
              { key: 'units', label: 'Units', isNumeric: true },
            ];
        
        return (
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {displayColumns.map(col => (
                    <TableHead key={col.key} className={col.isNumeric ? 'text-right' : ''}>
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index} data-testid={`row-collection-${index}`}>
                    {displayColumns.map(col => (
                      <TableCell key={col.key} className={col.isNumeric ? 'text-right' : 'font-medium'}>
                        {col.isNumeric 
                          ? (col.key === 'margin' 
                              ? `${Number(row[col.key] || 0).toFixed(1)}%` 
                              : formatCurrency(Number(row[col.key]) || 0))
                          : row[col.key]}
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

  const getChartIcon = (chartType: string | null) => {
    switch (chartType) {
      case "pie": return <PieChartIcon className="w-4 h-4" />;
      case "line": return <LineChartIcon className="w-4 h-4" />;
      case "table": return <TableIcon className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Collection</h1>
          <p className="text-muted-foreground">Your saved analyses and drill-down views</p>
        </div>
      </div>

      {(!collections || collections.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No saved collections</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Use the Explore feature on any dashboard page to create custom views and save them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold">Saved Views ({collections.length})</h2>
            <div className="space-y-2">
              {collections.map((collection) => (
                <Card 
                  key={collection.id} 
                  className={`cursor-pointer transition-colors ${selectedCollection?.id === collection.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => runCollection(collection)}
                  data-testid={`card-collection-${collection.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{collection.name}</span>
                        </div>
                        {collection.description && (
                          <p className="text-sm text-muted-foreground truncate">{collection.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {collection.insightType}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {getChartIcon(collection.chartType)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCollection(collection);
                            setEditName(collection.name);
                            setEditDescription(collection.description || "");
                            setShowEditDialog(true);
                          }}
                          data-testid={`button-edit-${collection.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCollection(collection);
                            setShowDeleteDialog(true);
                          }}
                          data-testid={`button-delete-${collection.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selectedCollection ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle>{selectedCollection.name}</CardTitle>
                        {selectedCollection.description && (
                          <CardDescription>{selectedCollection.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runCollection(selectedCollection)}
                          disabled={isRunning}
                          data-testid="button-refresh-collection"
                        >
                          {isRunning ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshInterpretation}
                          disabled={isInterpreting || collectionData.length === 0}
                          data-testid="button-ai-interpret"
                        >
                          {isInterpreting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-1" />
                          )}
                          AI Insights
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isRunning ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : collectionData.length > 0 ? (
                      renderChart(selectedCollection, collectionData)
                    ) : (
                      <div className="flex items-center justify-center h-64 text-muted-foreground">
                        Click Refresh to load data
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="text-sm text-muted-foreground">
                    Created: {new Date(selectedCollection.createdAt!).toLocaleDateString()}
                    {selectedCollection.updatedAt && selectedCollection.updatedAt !== selectedCollection.createdAt && (
                      <span className="ml-4">Updated: {new Date(selectedCollection.updatedAt).toLocaleDateString()}</span>
                    )}
                  </CardFooter>
                </Card>

                {interpretation && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        AI Interpretation
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Generated: {new Date(interpretation.generatedAt).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{interpretation.summary}</p>
                      
                      {interpretation.insights && interpretation.insights.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-1">Key Insights</p>
                          <ul className="space-y-1">
                            {interpretation.insights.map((insight, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {interpretation.recommendations && interpretation.recommendations.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-1">Recommendations</p>
                          <ul className="space-y-1">
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
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a collection to view</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedCollection) {
                  updateMutation.mutate({ 
                    id: selectedCollection.id, 
                    name: editName, 
                    description: editDescription 
                  });
                }
              }}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCollection?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedCollection) {
                  deleteMutation.mutate(selectedCollection.id);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
