import { AlertCircle, RefreshCw, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ConnectionErrorProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ConnectionError({ onRetry, isRetrying }: ConnectionErrorProps) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Database className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Database Connection Error
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Unable to connect to the SQL Server database. This is likely due to firewall restrictions.
            </p>
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md text-left mt-3">
              <p className="font-medium mb-2">To fix this issue:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to Azure Portal</li>
                <li>Navigate to your SQL Server resource</li>
                <li>Go to "Networking" or "Firewalls and virtual networks"</li>
                <li>Add a rule to allow connections from Replit's IP range, or enable "Allow Azure services and resources to access this server"</li>
              </ol>
            </div>
          </div>
          {onRetry && (
            <Button onClick={onRetry} disabled={isRetrying} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
              Retry Connection
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
