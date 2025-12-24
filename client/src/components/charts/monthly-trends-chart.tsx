import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface MonthlyData {
  month: string;
  revenue: number;
  profit: number;
  margin: number;
  returnRate: number;
}

interface MonthlyTrendsChartProps {
  data: MonthlyData[];
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

export function MonthlyTrendsChart({ data, isLoading }: MonthlyTrendsChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      month: d.month.split('-')[1] ? `${d.month.split('-')[1]}/${d.month.split('-')[0].slice(2)}` : d.month,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Monthly Trends</CardTitle>
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
        <CardTitle className="text-base font-medium">Monthly Performance Trends</CardTitle>
        <CardDescription>Revenue, profit, and return rate over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              domain={[0, 'auto']}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'returnRate') return [`${value.toFixed(1)}%`, 'Return Rate'];
                if (name === 'margin') return [`${value.toFixed(1)}%`, 'Margin'];
                return [formatCurrency(value), name.charAt(0).toUpperCase() + name.slice(1)];
              }}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                borderColor: "hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value) => {
                const labels: Record<string, string> = {
                  revenue: 'Revenue',
                  profit: 'Profit',
                  returnRate: 'Return Rate'
                };
                return labels[value] || value;
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
            <Bar
              yAxisId="left"
              dataKey="profit"
              fill="hsl(var(--chart-2))"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="returnRate"
              stroke="hsl(25 95% 53%)"
              strokeWidth={2}
              dot={{ fill: "hsl(25 95% 53%)", strokeWidth: 0, r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
