import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { ProfitabilityWaterfall as WaterfallData } from "@shared/schema";

interface ProfitabilityWaterfallProps {
  data: WaterfallData | undefined;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function ProfitabilityWaterfall({ data, isLoading }: ProfitabilityWaterfallProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return [
      { name: "Revenue", value: data.grossRevenue, fill: "hsl(var(--chart-1))", isPositive: true },
      { name: "Purchase", value: -data.purchaseCost, fill: "hsl(0 84% 60%)", isPositive: false },
      { name: "Parts", value: -data.partsCost, fill: "hsl(0 74% 65%)", isPositive: false },
      { name: "Freight", value: -data.freightCost, fill: "hsl(0 64% 70%)", isPositive: false },
      { name: "Labor", value: -data.laborCost, fill: "hsl(0 54% 72%)", isPositive: false },
      { name: "Other", value: -(data.packagingCost + data.otherCosts), fill: "hsl(0 44% 75%)", isPositive: false },
      { name: "Gross Profit", value: data.grossProfit, fill: "hsl(var(--chart-2))", isPositive: true },
      { name: "Returns", value: -data.returnImpact, fill: "hsl(25 95% 53%)", isPositive: false },
      { name: "Net Profit", value: data.netProfit, fill: data.netProfit >= 0 ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)", isPositive: data.netProfit >= 0 },
    ];
  }, [data]);

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Profit Waterfall</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Profit Waterfall Analysis</CardTitle>
        <CardDescription>
          Revenue to Net Profit breakdown showing cost structure and return impact
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(Math.abs(value)), value >= 0 ? "Add" : "Subtract"]}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                borderColor: "hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-between mt-4 text-sm px-2">
          <div className="text-muted-foreground">
            Gross Margin: <span className="font-medium text-foreground">{data?.grossMargin.toFixed(1)}%</span>
          </div>
          <div className="text-muted-foreground">
            Net Margin: <span className={`font-medium ${(data?.netMargin || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {data?.netMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
