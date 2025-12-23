import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/kpi-card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { StatusChart } from "@/components/charts/status-chart";
import { TopPerformers } from "@/components/charts/top-performers";
import { Download, FileText, BarChart3, PieChart } from "lucide-react";
import type { DashboardData } from "@shared/schema";

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export default function Reports() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  const exportReport = (type: string) => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      type,
      kpis: data?.kpis,
      categoryBreakdown: data?.categoryBreakdown,
      topCustomers: data?.topCustomers,
      topProducts: data?.topProducts,
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_report_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate and export analytics reports
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportReport("executive_summary")}
            data-testid="button-export-executive"
          >
            <FileText className="h-4 w-4 mr-1" />
            Executive Summary
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportReport("full_analytics")}
            data-testid="button-export-full"
          >
            <Download className="h-4 w-4 mr-1" />
            Full Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="hover-elevate cursor-pointer" onClick={() => exportReport("kpi")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">KPI Report</p>
              <p className="text-xs text-muted-foreground">Key performance indicators</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => exportReport("sales")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-chart-2/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="font-medium">Sales Report</p>
              <p className="text-xs text-muted-foreground">Revenue and orders analysis</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => exportReport("profitability")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-chart-4/10 flex items-center justify-center">
              <PieChart className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="font-medium">Profitability Report</p>
              <p className="text-xs text-muted-foreground">Margin and cost analysis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Report Preview - Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              title="Total Revenue"
              value={formatCurrency(data?.kpis.totalRevenue || 0)}
              isLoading={isLoading}
            />
            <KPICard
              title="Total Profit"
              value={formatCurrency(data?.kpis.totalProfit || 0)}
              isLoading={isLoading}
            />
            <KPICard
              title="Units Sold"
              value={(data?.kpis.unitsSold || 0).toLocaleString()}
              isLoading={isLoading}
            />
            <KPICard
              title="Profit Margin"
              value={`${(data?.kpis.profitMargin || 0).toFixed(1)}%`}
              isLoading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <RevenueChart
              data={data?.revenueOverTime || []}
              isLoading={isLoading}
            />
            <CategoryChart
              data={data?.categoryBreakdown || []}
              isLoading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatusChart
              data={data?.statusBreakdown || []}
              isLoading={isLoading}
              title="Status Overview"
            />
            <TopPerformers
              data={data?.topCustomers || []}
              title="Top 5 Customers"
              isLoading={isLoading}
            />
            <TopPerformers
              data={data?.topProducts || []}
              title="Top 5 Products"
              isLoading={isLoading}
            />
            <TopPerformers
              data={data?.topVendors || []}
              title="Top 5 Vendors"
              isLoading={isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
