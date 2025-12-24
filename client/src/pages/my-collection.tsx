import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Folder, Play, Trash2, Edit2, Loader2, Search, BarChart3, PieChartIcon, LineChartIcon, TableIcon, FolderOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavedCollection } from "@shared/schema";

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
  const [isRunning, setIsRunning] = useState(false);
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
    try {
      const config = JSON.parse(collection.queryConfig);
      const response = await apiRequest("POST", `/api/explore/${collection.insightType}`, config);
      const result = await response.json();
      setCollectionData(result.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to run collection", variant: "destructive" });
    } finally {
      setIsRunning(false);
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

    const dataKey = getDataKey(collection.insightType);
    const chartData = data.slice(0, 10);
    const chartType = collection.chartType || "bar";

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
              <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} />
              <Bar dataKey="profit" name="Profit" fill={CHART_COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="revenue"
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
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS[0]} strokeWidth={2} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke={CHART_COLORS[1]} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "table":
      default:
        return (
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dataKey.charAt(0).toUpperCase() + dataKey.slice(1)}</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index} data-testid={`row-collection-${index}`}>
                    <TableCell className="font-medium">{row[dataKey]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.profit)}</TableCell>
                    <TableCell className="text-right">{row.margin?.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.units?.toLocaleString()}</TableCell>
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

          <div className="lg:col-span-2">
            {selectedCollection ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>{selectedCollection.name}</CardTitle>
                      {selectedCollection.description && (
                        <CardDescription>{selectedCollection.description}</CardDescription>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runCollection(selectedCollection)}
                      disabled={isRunning}
                      data-testid="button-refresh-collection"
                    >
                      {isRunning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
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
                      Click to load data
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
