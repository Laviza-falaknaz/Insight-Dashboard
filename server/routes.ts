import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { query, sql, queryWithParams } from "./db";
import type { 
  InventoryItem, 
  DashboardData, 
  FilterDropdownOptions,
  KPISummary,
  TimeSeriesPoint,
  CategoryBreakdown,
  TopPerformer
} from "@shared/schema";

interface FilterParams {
  startDate?: string;
  endDate?: string;
  status?: string;
  category?: string;
  make?: string;
  customer?: string;
  vendor?: string;
  gradeCondition?: string;
}

function buildWhereClause(params: FilterParams): string {
  const conditions: string[] = [];
  
  if (params.startDate) {
    conditions.push(`InvoiceDate >= '${params.startDate}'`);
  }
  if (params.endDate) {
    conditions.push(`InvoiceDate <= '${params.endDate}'`);
  }
  if (params.status) {
    const statuses = params.status.split(",").map(s => `'${s.replace(/'/g, "''")}'`).join(",");
    conditions.push(`Status IN (${statuses})`);
  }
  if (params.category) {
    const categories = params.category.split(",").map(c => `'${c.replace(/'/g, "''")}'`).join(",");
    conditions.push(`Category IN (${categories})`);
  }
  if (params.make) {
    const makes = params.make.split(",").map(m => `'${m.replace(/'/g, "''")}'`).join(",");
    conditions.push(`Make IN (${makes})`);
  }
  if (params.customer) {
    const customers = params.customer.split(",").map(c => `'${c.replace(/'/g, "''")}'`).join(",");
    conditions.push(`InvoicingName IN (${customers})`);
  }
  if (params.vendor) {
    const vendors = params.vendor.split(",").map(v => `'${v.replace(/'/g, "''")}'`).join(",");
    conditions.push(`VendName IN (${vendors})`);
  }
  if (params.gradeCondition) {
    const grades = params.gradeCondition.split(",").map(g => `'${g.replace(/'/g, "''")}'`).join(",");
    conditions.push(`GradeCondition IN (${grades})`);
  }
  
  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get filter dropdown options
  app.get("/api/filters", async (_req: Request, res: Response) => {
    try {
      const [statuses, categories, makes, customers, vendors, grades] = await Promise.all([
        query<{ Status: string }>(`SELECT DISTINCT Status FROM Inventory WHERE Status IS NOT NULL AND Status != '' ORDER BY Status`),
        query<{ Category: string }>(`SELECT DISTINCT Category FROM Inventory WHERE Category IS NOT NULL AND Category != '' ORDER BY Category`),
        query<{ Make: string }>(`SELECT DISTINCT Make FROM Inventory WHERE Make IS NOT NULL AND Make != '' ORDER BY Make`),
        query<{ InvoicingName: string }>(`SELECT DISTINCT TOP 100 InvoicingName FROM Inventory WHERE InvoicingName IS NOT NULL AND InvoicingName != '' ORDER BY InvoicingName`),
        query<{ VendName: string }>(`SELECT DISTINCT TOP 100 VendName FROM Inventory WHERE VendName IS NOT NULL AND VendName != '' ORDER BY VendName`),
        query<{ GradeCondition: string }>(`SELECT DISTINCT GradeCondition FROM Inventory WHERE GradeCondition IS NOT NULL AND GradeCondition != '' ORDER BY GradeCondition`),
      ]);

      const filterOptions: FilterDropdownOptions = {
        statuses: statuses.map(s => s.Status),
        categories: categories.map(c => c.Category),
        makes: makes.map(m => m.Make),
        customers: customers.map(c => c.InvoicingName),
        vendors: vendors.map(v => v.VendName),
        grades: grades.map(g => g.GradeCondition),
      };

      res.json(filterOptions);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      res.status(500).json({ error: "Failed to fetch filter options" });
    }
  });

  // Get inventory data with filters
  app.get("/api/inventory", async (req: Request, res: Response) => {
    try {
      const params = req.query as FilterParams;
      const whereClause = buildWhereClause(params);
      
      const items = await query<InventoryItem>(`
        SELECT TOP 1000
          dataAreaId, ItemId, InventSerialId, DealRef, PurchPriceUSD, PurchDate,
          VendComments, KeyLang, OsSticker, DisplaySize, LCDCostUSD, StorageSerialNum,
          VendName, Category, MadeIn, GradeCondition, PartsCostUSD, FingerprintStr,
          MiscCostUSD, ProcessorGen, ManufacturingDate, PurchaseCategory, KeyLayout,
          PONumber, Make, Processor, PackagingCostUSD, ReceivedDate, ITADTreesCostUSD,
          StorageType, SoldAsHDD, StandardisationCostUSD, Comments, PurchPriceRevisedUSD,
          Status, ConsumableCostUSD, Chassis, JournalNum, BatteryCostUSD, Ram, SoldAsRAM,
          FreightChargesUSD, HDD, COACostUSD, ManufacturerSerialNum, SupplierPalletNum,
          ResourceCostUSD, CustomsDutyUSD, Resolution, ModelNum, InvoiceAccount,
          TotalCostCurUSD, SalesOrderDate, CustomerRef, CRMRef, InvoicingName, TransType,
          SalesInvoiceId, SalesId, InvoiceDate, APINNumber, Segregation, FinalSalesPriceUSD,
          FinalTotalCostUSD, OrderTaker, OrderResponsible, ProductSpecification,
          WarrantyStartDate, WarrantyEndDate, WarrantyDescription
        FROM Inventory
        ${whereClause}
        ORDER BY InvoiceDate DESC
      `);
      
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: "Failed to fetch inventory data" });
    }
  });

  // Get dashboard data
  app.get("/api/dashboard", async (req: Request, res: Response) => {
    try {
      const params = req.query as FilterParams;
      const whereClause = buildWhereClause(params);
      const andClause = whereClause ? whereClause.replace("WHERE", "AND") : "";

      // Get KPIs
      const kpiResult = await query<{
        totalRevenue: number;
        totalCost: number;
        totalProfit: number;
        unitsSold: number;
        totalOrders: number;
      }>(`
        SELECT 
          ISNULL(SUM(FinalSalesPriceUSD), 0) as totalRevenue,
          ISNULL(SUM(FinalTotalCostUSD), 0) as totalCost,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as totalProfit,
          COUNT(*) as unitsSold,
          COUNT(DISTINCT SalesId) as totalOrders
        FROM Inventory
        ${whereClause}
      `);

      const kpis: KPISummary = {
        totalRevenue: kpiResult[0]?.totalRevenue || 0,
        totalCost: kpiResult[0]?.totalCost || 0,
        totalProfit: kpiResult[0]?.totalProfit || 0,
        profitMargin: kpiResult[0]?.totalRevenue > 0 
          ? ((kpiResult[0]?.totalProfit || 0) / kpiResult[0]?.totalRevenue) * 100 
          : 0,
        unitsSold: kpiResult[0]?.unitsSold || 0,
        averageOrderValue: kpiResult[0]?.totalOrders > 0 
          ? (kpiResult[0]?.totalRevenue || 0) / kpiResult[0]?.totalOrders 
          : 0,
        totalOrders: kpiResult[0]?.totalOrders || 0,
      };

      // Get revenue over time
      const revenueOverTime = await query<TimeSeriesPoint>(`
        SELECT 
          CONVERT(varchar, InvoiceDate, 23) as date,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          ISNULL(SUM(FinalTotalCostUSD), 0) as cost,
          COUNT(*) as units
        FROM Inventory
        WHERE InvoiceDate IS NOT NULL ${andClause}
        GROUP BY CONVERT(varchar, InvoiceDate, 23)
        ORDER BY date DESC
        OFFSET 0 ROWS FETCH NEXT 30 ROWS ONLY
      `);

      // Get category breakdown
      const categoryBreakdown = await query<CategoryBreakdown>(`
        SELECT 
          ISNULL(Category, 'Unknown') as category,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          COUNT(*) as units,
          COUNT(*) as count
        FROM Inventory
        ${whereClause}
        GROUP BY Category
        ORDER BY revenue DESC
      `);

      // Get top customers
      const topCustomers = await query<TopPerformer>(`
        SELECT TOP 10
          ISNULL(InvoicingName, 'Unknown') as name,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          COUNT(*) as units,
          COUNT(DISTINCT SalesId) as count
        FROM Inventory
        WHERE InvoicingName IS NOT NULL AND InvoicingName != '' ${andClause}
        GROUP BY InvoicingName
        ORDER BY revenue DESC
      `);

      // Get top products (by Make + Model)
      const topProducts = await query<TopPerformer>(`
        SELECT TOP 10
          ISNULL(Make, 'Unknown') + ' ' + ISNULL(ModelNum, '') as name,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          COUNT(*) as units,
          COUNT(*) as count
        FROM Inventory
        ${whereClause}
        GROUP BY Make, ModelNum
        ORDER BY revenue DESC
      `);

      // Get top vendors
      const topVendors = await query<TopPerformer>(`
        SELECT TOP 10
          ISNULL(VendName, 'Unknown') as name,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          COUNT(*) as units,
          COUNT(*) as count
        FROM Inventory
        WHERE VendName IS NOT NULL AND VendName != '' ${andClause}
        GROUP BY VendName
        ORDER BY revenue DESC
      `);

      // Get status breakdown
      const statusBreakdown = await query<{ status: string; count: number }>(`
        SELECT 
          ISNULL(Status, 'Unknown') as status,
          COUNT(*) as count
        FROM Inventory
        ${whereClause}
        GROUP BY Status
        ORDER BY count DESC
      `);

      // Get grade breakdown
      const gradeBreakdown = await query<{ grade: string; count: number }>(`
        SELECT 
          ISNULL(GradeCondition, 'Unknown') as grade,
          COUNT(*) as count
        FROM Inventory
        ${whereClause}
        GROUP BY GradeCondition
        ORDER BY count DESC
      `);

      const dashboardData: DashboardData = {
        kpis,
        revenueOverTime: revenueOverTime.reverse(),
        categoryBreakdown,
        topCustomers,
        topProducts,
        topVendors,
        statusBreakdown,
        gradeBreakdown,
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Get customer analytics
  app.get("/api/analytics/customers", async (_req: Request, res: Response) => {
    try {
      const topCustomers = await query<TopPerformer>(`
        SELECT TOP 50
          ISNULL(InvoicingName, 'Unknown') as name,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          COUNT(*) as units,
          COUNT(DISTINCT SalesId) as count
        FROM Inventory
        WHERE InvoicingName IS NOT NULL AND InvoicingName != ''
        GROUP BY InvoicingName
        ORDER BY revenue DESC
      `);

      const totals = await query<{
        totalCustomers: number;
        totalRevenue: number;
        totalProfit: number;
        totalUnits: number;
      }>(`
        SELECT 
          COUNT(DISTINCT InvoicingName) as totalCustomers,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as totalRevenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as totalProfit,
          COUNT(*) as totalUnits
        FROM Inventory
        WHERE InvoicingName IS NOT NULL AND InvoicingName != ''
      `);

      res.json({
        topCustomers,
        totalCustomers: totals[0]?.totalCustomers || 0,
        totalRevenue: totals[0]?.totalRevenue || 0,
        totalProfit: totals[0]?.totalProfit || 0,
        totalUnits: totals[0]?.totalUnits || 0,
      });
    } catch (error) {
      console.error("Error fetching customer analytics:", error);
      res.status(500).json({ error: "Failed to fetch customer analytics" });
    }
  });

  // Get product analytics
  app.get("/api/analytics/products", async (_req: Request, res: Response) => {
    try {
      const topProducts = await query<TopPerformer>(`
        SELECT TOP 50
          ISNULL(Make, 'Unknown') + ' ' + ISNULL(ModelNum, '') as name,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          COUNT(*) as units,
          COUNT(*) as count
        FROM Inventory
        GROUP BY Make, ModelNum
        ORDER BY revenue DESC
      `);

      const categoryBreakdown = await query<CategoryBreakdown>(`
        SELECT 
          ISNULL(Category, 'Unknown') as category,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as revenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as profit,
          COUNT(*) as units,
          COUNT(*) as count
        FROM Inventory
        GROUP BY Category
        ORDER BY revenue DESC
      `);

      const totals = await query<{
        totalProducts: number;
        totalRevenue: number;
        totalProfit: number;
        totalUnits: number;
      }>(`
        SELECT 
          COUNT(DISTINCT CONCAT(Make, ModelNum)) as totalProducts,
          ISNULL(SUM(FinalSalesPriceUSD), 0) as totalRevenue,
          ISNULL(SUM(FinalSalesPriceUSD) - SUM(FinalTotalCostUSD), 0) as totalProfit,
          COUNT(*) as totalUnits
        FROM Inventory
      `);

      res.json({
        topProducts,
        categoryBreakdown,
        totalProducts: totals[0]?.totalProducts || 0,
        totalRevenue: totals[0]?.totalRevenue || 0,
        totalProfit: totals[0]?.totalProfit || 0,
        totalUnits: totals[0]?.totalUnits || 0,
      });
    } catch (error) {
      console.error("Error fetching product analytics:", error);
      res.status(500).json({ error: "Failed to fetch product analytics" });
    }
  });

  return httpServer;
}
