import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Shield, CheckCircle, XCircle, Clock } from "lucide-react";

interface RefreshStatus {
  isRunning: boolean;
  lastRun: string | null;
  lastStatus: "success" | "error" | "running" | "idle";
  lastMessage: string;
  inventoryCount: number;
  returnsCount: number;
  duration: number;
}

interface RefreshLog {
  id: number;
  uploadType: string;
  recordCount: number;
  status: string;
  uploadedAt: string;
  errorMessage: string | null;
}

export default function Admin() {
  const { toast } = useToast();
  const [adminToken, setAdminToken] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [logs, setLogs] = useState<RefreshLog[]>([]);

  const fetchStatus = async () => {
    if (!adminToken) return;
    try {
      const response = await fetch(`/api/admin/refresh/status?token=${adminToken}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setIsAuthorized(true);
      } else if (response.status === 403) {
        setIsAuthorized(false);
        toast({ title: "Invalid Token", description: "Admin token is incorrect", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch status", variant: "destructive" });
    }
  };

  const fetchLogs = async () => {
    if (!adminToken) return;
    try {
      const response = await fetch(`/api/admin/refresh/logs?token=${adminToken}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setStatus(data.currentStatus);
      }
    } catch {
      console.error("Failed to fetch logs");
    }
  };

  const handleVerify = async () => {
    await fetchStatus();
    if (isAuthorized) {
      await fetchLogs();
    }
  };

  const triggerRefresh = async () => {
    if (!adminToken) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/refresh/trigger?token=${adminToken}`);
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Refresh Started", description: "Database refresh has been triggered" });
        await fetchStatus();
      } else {
        toast({ title: "Error", description: data.error || "Failed to trigger refresh", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to trigger refresh", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized && adminToken) {
      const interval = setInterval(() => {
        fetchStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized, adminToken]);

  const getStatusIcon = (statusValue: string) => {
    switch (statusValue) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-admin-auth">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Admin Portal</CardTitle>
            <CardDescription>Enter your admin token to access database controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Admin Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter admin token"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                data-testid="input-admin-token"
              />
            </div>
            <Button onClick={handleVerify} className="w-full" data-testid="button-verify-token">
              Verify Token
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-admin-dashboard">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Portal
            </CardTitle>
            <CardDescription>Database management and refresh controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <h3 className="font-medium">Database Refresh</h3>
                <p className="text-sm text-muted-foreground">
                  Trigger a full data sync from the external SQL server
                </p>
              </div>
              <Button
                onClick={triggerRefresh}
                disabled={isLoading || status?.isRunning}
                data-testid="button-trigger-refresh"
              >
                {isLoading || status?.isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {status?.isRunning ? "Refreshing..." : "Trigger Refresh"}
              </Button>
            </div>

            {status && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(status.lastStatus)}
                    <span className="font-medium capitalize">{status.lastStatus}</span>
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Inventory Records</p>
                  <p className="font-medium text-lg" data-testid="text-inventory-count">
                    {status.inventoryCount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Returns Records</p>
                  <p className="font-medium text-lg" data-testid="text-returns-count">
                    {status.returnsCount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Last Duration</p>
                  <p className="font-medium text-lg">
                    {status.duration > 0 ? `${(status.duration / 1000).toFixed(1)}s` : "-"}
                  </p>
                </div>
              </div>
            )}

            {status?.lastMessage && (
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">Last Message</p>
                <p className="text-sm mt-1">{status.lastMessage}</p>
                {status.lastRun && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(status.lastRun).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle>Activity Log</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchLogs} data-testid="button-refresh-logs">
                <RefreshCw className="h-3 w-3 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity logs yet</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/30 flex-wrap"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <p className="font-medium text-sm">{log.uploadType}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === "success" ? "default" : "destructive"}>
                        {log.recordCount.toLocaleString()} records
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
