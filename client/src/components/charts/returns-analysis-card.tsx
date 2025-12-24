import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ShieldCheck, RotateCcw, Package } from "lucide-react";

interface ReturnsAnalysis {
  reasonsBreakdown: { reason: string; count: number; revenueImpact: number; profitImpact: number }[];
  byCategory: { category: string; returnCount: number; revenueAtRisk: number; profitLost: number }[];
  solutionsBreakdown: { solution: string; count: number; value: number }[];
}

interface WarrantyExposure {
  underWarranty: number;
  expiringSoon: number;
  warrantyValue: number;
}

interface Props {
  returnsAnalysis?: ReturnsAnalysis;
  warrantyExposure?: WarrantyExposure;
  totalUnitsReturned: number;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function ReturnsAnalysisCard({ returnsAnalysis, warrantyExposure, totalUnitsReturned, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const maxReasonCount = Math.max(...(returnsAnalysis?.reasonsBreakdown?.map(r => r.count) || [1]));

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-500" />
              Returns & Warranty Analysis
            </CardTitle>
            <CardDescription>Return reasons, resolutions, and warranty exposure</CardDescription>
          </div>
          {warrantyExposure && warrantyExposure.expiringSoon > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {warrantyExposure.expiringSoon} expiring soon
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Return Reasons</h4>
            {returnsAnalysis?.reasonsBreakdown && returnsAnalysis.reasonsBreakdown.length > 0 ? (
              <div className="space-y-2">
                {returnsAnalysis.reasonsBreakdown.slice(0, 5).map((reason, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate max-w-[150px]" title={reason.reason}>
                        {reason.reason}
                      </span>
                      <span className="text-xs font-medium">{reason.count}</span>
                    </div>
                    <Progress value={(reason.count / maxReasonCount) * 100} className="h-1.5" />
                    <div className="text-xs text-muted-foreground">
                      Impact: {formatCurrency(Math.abs(reason.profitImpact))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No return reasons recorded
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Returns by Category</h4>
            {returnsAnalysis?.byCategory && returnsAnalysis.byCategory.length > 0 ? (
              <div className="space-y-2">
                {returnsAnalysis.byCategory.slice(0, 5).map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs truncate max-w-[100px]" title={cat.category}>
                        {cat.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium">{cat.returnCount} units</div>
                      <div className="text-xs text-red-500">-{formatCurrency(Math.abs(cat.profitLost))}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No category returns data
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Resolution & Warranty</h4>
            
            {returnsAnalysis?.solutionsBreakdown && returnsAnalysis.solutionsBreakdown.length > 0 && (
              <div className="space-y-2">
                {returnsAnalysis.solutionsBreakdown.slice(0, 4).map((sol, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {sol.solution}
                    </Badge>
                    <span className="font-medium">{sol.count}</span>
                  </div>
                ))}
              </div>
            )}

            {warrantyExposure && (
              <div className="mt-4 p-3 rounded-md bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Warranty Status
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Under Warranty</div>
                    <div className="font-medium">{warrantyExposure.underWarranty.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Expiring (30d)</div>
                    <div className="font-medium text-amber-600">{warrantyExposure.expiringSoon.toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Value at risk: {formatCurrency(warrantyExposure.warrantyValue)}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
