import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileDown, Search, Loader2 } from "lucide-react";
import { generateDashboardPDF } from "@/lib/pdfService";
import { ExploreModal } from "./ExploreModal";
import { useToast } from "@/hooks/use-toast";

interface DashboardToolbarProps {
  pageName: string;
  chartElementIds: string[];
  insightType?: string;
}

export function DashboardToolbar({ pageName, chartElementIds, insightType = "category" }: DashboardToolbarProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showExplore, setShowExplore] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await generateDashboardPDF(
        {
          title: pageName,
          subtitle: "Executive Dashboard Report",
          includeTimestamp: true,
          orientation: "landscape",
        },
        chartElementIds
      );
      toast({
        title: "PDF Generated",
        description: "Your report has been downloaded successfully",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExplore(true)}
          data-testid="button-explore-data"
        >
          <Search className="w-4 h-4 mr-2" />
          Explore
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={isExporting}
          data-testid="button-export-pdf"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          Export PDF
        </Button>
      </div>

      <ExploreModal
        open={showExplore}
        onOpenChange={setShowExplore}
        initialInsightType={insightType}
        title={`Explore ${pageName} Data`}
      />
    </>
  );
}
