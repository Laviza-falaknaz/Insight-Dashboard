import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Search, Save, Download, Loader2, BarChart3, PieChartIcon, LineChartIcon, TableIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExploreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialInsightType?: string;
  initialData?: any[];
  title?: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
];

export function ExploreModal({ 
  open, 
  onOpenChange, 
  initialInsightType = "category",
  initialData,
  title = "Explore Data" 
}: ExploreModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [insightType, setInsightType] = useState(initialInsightType);
  const [limit, setLimit] = useState(20);
  const [chartType, setChartType] = useState<"bar" | "pie" | "line" | "table">("bar");
  const [data, setData] = useState<any[]>(initialData || []);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const exploreMutation = useMutation({
    mutationFn: async (params: { insightType: string; limit: number }) => {
      const response = await apiRequest("POST", `/api/explore/${params.insightType}`, {
        dimension: params.insightType,
        limit: params.limit,
        filters: {},
      });
      return response.json();
    },
    onSuccess: (result) => {
      setData(result.data || []);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch data",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (params: { name: string; description: string }) => {
      const response = await apiRequest("POST", "/api/collections", {
        name: params.name,
        description: params.description,
        insightType,
        queryConfig: JSON.stringify({ dimension: insightType, limit, filters: {} }),
        chartType,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Saved",
        description: "Collection saved successfully",
      });
      setShowSaveDialog(false);
      setCollectionName("");
      setCollectionDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save collection",
        variant: "destructive",
      });
    },
  });

  const handleExplore = () => {
    exploreMutation.mutate({ insightType, limit });
  };

  const handleSave = () => {
    if (!collectionName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a collection name",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate({ name: collectionName, description: collectionDescription });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getDataKey = () => {
    switch (insightType) {
      case "category":
        return "category";
      case "customer":
        return "customer";
      case "vendor":
        return "vendor";
      case "product":
        return "make";
      case "monthly":
        return "month";
      default:
        return "category";
    }
  };

  const renderChart = () => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Click "Explore" to load data
        </div>
      );
    }

    const dataKey = getDataKey();
    const chartData = data.slice(0, 10);

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey={dataKey} 
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
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
              <XAxis 
                dataKey={dataKey} 
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS[0]} strokeWidth={2} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke={CHART_COLORS[1]} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "table":
        return (
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dataKey.charAt(0).toUpperCase() + dataKey.slice(1)}</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index} data-testid={`row-explore-${index}`}>
                    <TableCell className="font-medium">{row[dataKey]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.cost)}</TableCell>
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Explore and analyze data with custom filters. Save interesting views to your collection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Dimension</Label>
                <Select value={insightType} onValueChange={setInsightType}>
                  <SelectTrigger className="w-40" data-testid="select-dimension">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Limit</Label>
                <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                  <SelectTrigger className="w-24" data-testid="select-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleExplore} 
                disabled={exploreMutation.isPending}
                data-testid="button-explore"
              >
                {exploreMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Explore
              </Button>
            </div>

            <div className="flex gap-2 border-b pb-2">
              <Button
                variant={chartType === "bar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("bar")}
                data-testid="button-chart-bar"
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === "pie" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("pie")}
                data-testid="button-chart-pie"
              >
                <PieChartIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === "line" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("line")}
                data-testid="button-chart-line"
              >
                <LineChartIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("table")}
                data-testid="button-chart-table"
              >
                <TableIcon className="w-4 h-4" />
              </Button>
            </div>

            <Card>
              <CardContent className="pt-4">
                {renderChart()}
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(true)}
              disabled={data.length === 0}
              data-testid="button-save-collection"
            >
              <Save className="w-4 h-4 mr-2" />
              Save to Collection
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-explore">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Collection</DialogTitle>
            <DialogDescription>
              Save this view to your collection for quick access later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="My saved analysis"
                data-testid="input-collection-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection-description">Description (optional)</Label>
              <Input
                id="collection-description"
                value={collectionDescription}
                onChange={(e) => setCollectionDescription(e.target.value)}
                placeholder="Description of this view"
                data-testid="input-collection-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} data-testid="button-cancel-save">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saveMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
