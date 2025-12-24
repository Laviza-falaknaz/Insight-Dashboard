import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Users, Package, DollarSign, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Alert {
  type: 'margin' | 'returns' | 'customer' | 'product' | 'cost';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: number;
  recommendation: string;
}

interface CriticalAlertsProps {
  alerts: Alert[];
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const getAlertIcon = (type: string) => {
  switch (type) {
    case 'margin':
      return <DollarSign className="h-4 w-4" />;
    case 'returns':
      return <TrendingDown className="h-4 w-4" />;
    case 'customer':
      return <Users className="h-4 w-4" />;
    case 'product':
      return <Package className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-600 border-red-200';
    case 'warning':
      return 'bg-amber-500/10 text-amber-600 border-amber-200';
    default:
      return 'bg-blue-500/10 text-blue-600 border-blue-200';
  }
};

export function CriticalAlerts({ alerts, isLoading }: CriticalAlertsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Critical Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <Card className={criticalCount > 0 ? 'border-red-200' : warningCount > 0 ? 'border-amber-200' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${criticalCount > 0 ? 'text-red-500' : warningCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            Action Required
          </CardTitle>
          <div className="flex gap-1">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">{criticalCount} Critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-xs">{warningCount} Warning</Badge>
            )}
          </div>
        </div>
        <CardDescription>Issues requiring executive attention</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <div className="text-emerald-500 font-medium">All Clear</div>
            <div className="text-xs mt-1">No critical issues detected</div>
          </div>
        ) : (
          alerts.slice(0, 4).map((alert, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-md border ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {getAlertIcon(alert.type)}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{alert.title}</div>
                    <div className="text-xs opacity-80">{alert.description}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Impact</div>
                  <div className="text-sm font-medium">{formatCurrency(alert.impact)}</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-current/10">
                <div className="text-xs flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  {alert.recommendation}
                </div>
              </div>
            </div>
          ))
        )}
        
        {alerts.length > 4 && (
          <Button variant="ghost" size="sm" className="w-full text-xs">
            View {alerts.length - 4} more alerts
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
