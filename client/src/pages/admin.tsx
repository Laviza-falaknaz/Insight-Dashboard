import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Shield, CheckCircle, XCircle, Clock, Database, Link2, Trash2, Plus, Package, RotateCcw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EntityConfig {
  id: number;
  entityId: string;
  displayName: string;
  description: string | null;
  isVisible: string;
  icon: string | null;
  color: string | null;
}

interface JoinKey {
  id: number;
  sourceEntityId: string;
  targetEntityId: string;
  name: string;
  sourceField: string;
  targetField: string;
  isDefault: string;
  supportedJoinTypes: string | null;
}

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
  tableName: string;
  recordsCount: number;
  insertedCount: number;
  updatedCount: number;
  status: string;
  uploadedAt: string;
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
      const response = await fetch("/api/admin/refresh/status", {
        headers: { "X-Admin-Token": adminToken },
      });
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
      const response = await fetch("/api/admin/refresh/logs", {
        headers: { "X-Admin-Token": adminToken },
      });
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
      const response = await fetch("/api/admin/refresh/trigger", {
        headers: { "X-Admin-Token": adminToken },
      });
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
                      {getStatusIcon(log.status === "completed" ? "success" : log.status)}
                      <div>
                        <p className="font-medium text-sm capitalize">{log.tableName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={log.status === "completed" ? "default" : "destructive"}>
                        {(log.recordsCount || 0).toLocaleString()} records
                      </Badge>
                      {log.insertedCount > 0 && (
                        <Badge variant="outline" className="text-green-600">
                          +{log.insertedCount} new
                        </Badge>
                      )}
                      {log.updatedCount > 0 && (
                        <Badge variant="outline" className="text-blue-600">
                          {log.updatedCount} updated
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <EntityConfigManager />
      </div>
    </div>
  );
}

function EntityConfigManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newJoinKey, setNewJoinKey] = useState({
    sourceEntityId: "",
    targetEntityId: "",
    name: "",
    sourceField: "",
    targetField: "",
    isDefault: false
  });

  const { data: adminData, isLoading } = useQuery<{ entities: EntityConfig[], joinKeys: JoinKey[] }>({
    queryKey: ["/api/admin/entities"],
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ entityId, isVisible }: { entityId: string, isVisible: boolean }) => {
      const entity = adminData?.entities.find(e => e.entityId === entityId);
      return apiRequest("PUT", `/api/admin/entities/${entityId}`, {
        isVisible,
        displayName: entity?.displayName,
        description: entity?.description,
        icon: entity?.icon,
        color: entity?.color
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/query-builder/columns"] });
      toast({ title: "Updated", description: "Entity visibility updated" });
    }
  });

  const createJoinKeyMutation = useMutation({
    mutationFn: async (data: typeof newJoinKey) => {
      return apiRequest("POST", "/api/admin/join-keys", {
        ...data,
        supportedJoinTypes: "inner,left,right"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/query-builder/columns"] });
      setNewJoinKey({ sourceEntityId: "", targetEntityId: "", name: "", sourceField: "", targetField: "", isDefault: false });
      toast({ title: "Created", description: "Join key created successfully" });
    }
  });

  const setDefaultMutation = useMutation({
    mutationFn: async ({ id, isDefault }: { id: number, isDefault: boolean }) => {
      const joinKey = adminData?.joinKeys.find(jk => jk.id === id);
      return apiRequest("PUT", `/api/admin/join-keys/${id}`, {
        name: joinKey?.name,
        sourceField: joinKey?.sourceField,
        targetField: joinKey?.targetField,
        isDefault,
        supportedJoinTypes: joinKey?.supportedJoinTypes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/query-builder/columns"] });
      toast({ title: "Updated", description: "Default join key updated" });
    }
  });

  const deleteJoinKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/join-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/query-builder/columns"] });
      toast({ title: "Deleted", description: "Join key removed" });
    }
  });

  const getEntityIcon = (entityId: string) => {
    if (entityId === 'inventory') return <Package className="h-4 w-4" />;
    if (entityId === 'returns') return <RotateCcw className="h-4 w-4" />;
    return <Database className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const entities = adminData?.entities || [];
  const joinKeys = adminData?.joinKeys || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Entity Configuration
        </CardTitle>
        <CardDescription>Manage which data sources are available and how they can be joined</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="entities">
          <TabsList className="mb-4">
            <TabsTrigger value="entities" data-testid="tab-entities">Entities</TabsTrigger>
            <TabsTrigger value="joinkeys" data-testid="tab-joinkeys">Join Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="space-y-4">
            {entities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No entities configured</p>
            ) : (
              <div className="space-y-3">
                {entities.map((entity) => (
                  <div
                    key={entity.entityId}
                    className="flex items-center justify-between gap-4 p-4 rounded-md bg-muted/30"
                    data-testid={`entity-row-${entity.entityId}`}
                  >
                    <div className="flex items-center gap-3">
                      {getEntityIcon(entity.entityId)}
                      <div>
                        <p className="font-medium">{entity.displayName}</p>
                        <p className="text-xs text-muted-foreground">{entity.description || entity.entityId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`visible-${entity.entityId}`} className="text-sm text-muted-foreground">
                        Visible
                      </Label>
                      <Switch
                        id={`visible-${entity.entityId}`}
                        checked={entity.isVisible === 'true'}
                        onCheckedChange={(checked) => toggleVisibilityMutation.mutate({ entityId: entity.entityId, isVisible: checked })}
                        data-testid={`switch-visibility-${entity.entityId}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="joinkeys" className="space-y-4">
            <div className="p-4 rounded-md border space-y-4">
              <h4 className="font-medium text-sm">Add New Join Key</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Source Entity</Label>
                  <Select value={newJoinKey.sourceEntityId} onValueChange={(v) => setNewJoinKey(prev => ({ ...prev, sourceEntityId: v }))}>
                    <SelectTrigger data-testid="select-source-entity">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.map(e => (
                        <SelectItem key={e.entityId} value={e.entityId}>{e.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target Entity</Label>
                  <Select value={newJoinKey.targetEntityId} onValueChange={(v) => setNewJoinKey(prev => ({ ...prev, targetEntityId: v }))}>
                    <SelectTrigger data-testid="select-target-entity">
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.map(e => (
                        <SelectItem key={e.entityId} value={e.entityId}>{e.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source Field</Label>
                  <Input
                    placeholder="e.g. inventSerialId"
                    value={newJoinKey.sourceField}
                    onChange={(e) => setNewJoinKey(prev => ({ ...prev, sourceField: e.target.value }))}
                    data-testid="input-source-field"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target Field</Label>
                  <Input
                    placeholder="e.g. serialId"
                    value={newJoinKey.targetField}
                    onChange={(e) => setNewJoinKey(prev => ({ ...prev, targetField: e.target.value }))}
                    data-testid="input-target-field"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Join Key Name</Label>
                  <Input
                    placeholder="e.g. Serial ID Match"
                    value={newJoinKey.name}
                    onChange={(e) => setNewJoinKey(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-join-key-name"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newJoinKey.isDefault}
                    onCheckedChange={(checked) => setNewJoinKey(prev => ({ ...prev, isDefault: checked }))}
                    data-testid="switch-new-default"
                  />
                  <Label className="text-xs">Set as default</Label>
                </div>
                <Button
                  size="sm"
                  onClick={() => createJoinKeyMutation.mutate(newJoinKey)}
                  disabled={!newJoinKey.sourceEntityId || !newJoinKey.targetEntityId || !newJoinKey.name || !newJoinKey.sourceField || !newJoinKey.targetField}
                  data-testid="button-add-join-key"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Join Key
                </Button>
              </div>
            </div>

            {joinKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No join keys configured</p>
            ) : (
              <div className="space-y-2">
                {joinKeys.map((jk) => (
                  <div
                    key={jk.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/30 flex-wrap"
                    data-testid={`joinkey-row-${jk.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{jk.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {jk.sourceEntityId}.{jk.sourceField} = {jk.targetEntityId}.{jk.targetField}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {jk.isDefault === 'true' && (
                        <Badge variant="default" className="text-xs">Default</Badge>
                      )}
                      {jk.isDefault !== 'true' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate({ id: jk.id, isDefault: true })}
                          data-testid={`button-set-default-${jk.id}`}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteJoinKeyMutation.mutate(jk.id)}
                        data-testid={`button-delete-joinkey-${jk.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
