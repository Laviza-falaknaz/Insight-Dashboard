import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AIInsightResponse } from "@shared/schema";

interface AIInsightsPanelProps {
  context: 'executive_summary' | 'freight' | 'inventory' | 'margins' | 'orders' | 'customers' | 'products' | 'returns';
  data: Record<string, any>;
  title?: string;
}

export function AIInsightsPanel({ context, data, title = "AI Insights" }: AIInsightsPanelProps) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<AIInsightResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/insights", { context, data });
      return response.json();
    },
    onSuccess: (result: AIInsightResponse) => {
      setInsights(result);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate insights",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            size="sm"
            data-testid="button-generate-insights"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          AI-powered analysis and recommendations based on your data
        </CardDescription>
      </CardHeader>

      {insights && (
        <CardContent className="space-y-4">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent" data-testid="button-toggle-insights">
                <span className="text-sm font-medium">View Details</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 mt-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Summary
                </h4>
                <p className="text-sm text-muted-foreground" data-testid="text-ai-summary">{insights.summary}</p>
              </div>

              {insights.keyFindings.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Key Findings
                  </h4>
                  <ul className="space-y-2">
                    {insights.keyFindings.map((finding, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm" data-testid={`text-finding-${index}`}>
                        <Badge variant="outline" className="mt-0.5 shrink-0">{index + 1}</Badge>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {insights.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm" data-testid={`text-recommendation-${index}`}>
                        <Badge variant="secondary" className="mt-0.5 shrink-0 bg-green-500/10 text-green-700 dark:text-green-400">
                          Action
                        </Badge>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.risks.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Risks
                  </h4>
                  <ul className="space-y-2">
                    {insights.risks.map((risk, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm" data-testid={`text-risk-${index}`}>
                        <Badge variant="secondary" className="mt-0.5 shrink-0 bg-red-500/10 text-red-700 dark:text-red-400">
                          Risk
                        </Badge>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.opportunities.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Opportunities
                  </h4>
                  <ul className="space-y-2">
                    {insights.opportunities.map((opp, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm" data-testid={`text-opportunity-${index}`}>
                        <Badge variant="secondary" className="mt-0.5 shrink-0 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                          Opportunity
                        </Badge>
                        <span>{opp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Generated: {new Date(insights.generatedAt).toLocaleString()}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}
