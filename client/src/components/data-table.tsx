import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { InventoryItem } from "@shared/schema";

interface DataTableProps {
  data: InventoryItem[];
  isLoading?: boolean;
  pageSize?: number;
}

type SortDirection = "asc" | "desc" | null;
type SortConfig = { key: keyof InventoryItem; direction: SortDirection };

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
};

const getStatusVariant = (status: string | null) => {
  if (!status) return "secondary";
  const lower = status.toLowerCase();
  if (lower.includes("sold") || lower.includes("complete")) return "default";
  if (lower.includes("available") || lower.includes("stock")) return "secondary";
  if (lower.includes("pending") || lower.includes("process")) return "outline";
  return "secondary";
};

export function DataTable({ data, isLoading, pageSize = 15 }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some(
        (val) => val && String(val).toLowerCase().includes(lower)
      )
    );
  }, [data, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig || !sortConfig.direction) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortConfig.direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (key: keyof InventoryItem) => {
    setSortConfig((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return null;
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: keyof InventoryItem) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="h-3 w-3" />;
    if (sortConfig.direction === "asc") return <ArrowUp className="h-3 w-3" />;
    if (sortConfig.direction === "desc") return <ArrowDown className="h-3 w-3" />;
    return <ArrowUpDown className="h-3 w-3" />;
  };

  const exportToCsv = () => {
    const headers = [
      "Serial",
      "Make",
      "Model",
      "Category",
      "Status",
      "Grade",
      "Customer",
      "Sales Price",
      "Total Cost",
      "Profit",
      "Invoice Date",
    ];
    const rows = sortedData.map((item) => [
      item.InventSerialId || "",
      item.Make || "",
      item.ModelNum || "",
      item.Category || "",
      item.Status || "",
      item.GradeCondition || "",
      item.InvoicingName || "",
      item.FinalSalesPriceUSD || "",
      item.FinalTotalCostUSD || "",
      ((item.FinalSalesPriceUSD || 0) - (item.FinalTotalCostUSD || 0)).toFixed(2),
      item.InvoiceDate || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="border rounded-md">
          <div className="p-4 space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
            data-testid="input-search-inventory"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {sortedData.length.toLocaleString()} records
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("InventSerialId")}
                >
                  <div className="flex items-center gap-1">
                    Serial {getSortIcon("InventSerialId")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("Make")}
                >
                  <div className="flex items-center gap-1">
                    Make {getSortIcon("Make")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("ModelNum")}
                >
                  <div className="flex items-center gap-1">
                    Model {getSortIcon("ModelNum")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("Category")}
                >
                  <div className="flex items-center gap-1">
                    Category {getSortIcon("Category")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("Status")}
                >
                  <div className="flex items-center gap-1">
                    Status {getSortIcon("Status")}
                  </div>
                </TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("FinalSalesPriceUSD")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Sales Price {getSortIcon("FinalSalesPriceUSD")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("FinalTotalCostUSD")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Cost {getSortIcon("FinalTotalCostUSD")}
                  </div>
                </TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("InvoiceDate")}
                >
                  <div className="flex items-center gap-1">
                    Date {getSortIcon("InvoiceDate")}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, idx) => {
                  const profit = (item.FinalSalesPriceUSD || 0) - (item.FinalTotalCostUSD || 0);
                  return (
                    <TableRow key={item.InventSerialId || idx} data-testid={`row-inventory-${idx}`}>
                      <TableCell className="font-mono text-xs">
                        {item.InventSerialId || "-"}
                      </TableCell>
                      <TableCell>{item.Make || "-"}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={item.ModelNum || ""}>
                        {item.ModelNum || "-"}
                      </TableCell>
                      <TableCell>{item.Category || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(item.Status)} className="text-xs">
                          {item.Status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.GradeCondition || "-"}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={item.InvoicingName || ""}>
                        {item.InvoicingName || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency(item.FinalSalesPriceUSD)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency(item.FinalTotalCostUSD)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-xs font-medium ${
                          profit > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : profit < 0
                            ? "text-red-600 dark:text-red-400"
                            : ""
                        }`}
                      >
                        {formatCurrency(profit)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(item.InvoiceDate)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              data-testid="button-page-first"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-page-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-page-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              data-testid="button-page-last"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
