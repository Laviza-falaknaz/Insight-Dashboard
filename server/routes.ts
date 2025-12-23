import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { inventory, dataUploads } from "@shared/schema";
import { eq, sql, and, gte, lte, inArray, desc, asc, count, sum, isNotNull, ne } from "drizzle-orm";
import type { 
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

function buildFilterConditions(params: FilterParams) {
  const conditions = [];
  
  if (params.startDate) {
    conditions.push(gte(inventory.invoiceDate, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(inventory.invoiceDate, params.endDate));
  }
  if (params.status) {
    const statuses = params.status.split(",");
    conditions.push(inArray(inventory.status, statuses));
  }
  if (params.category) {
    const categories = params.category.split(",");
    conditions.push(inArray(inventory.category, categories));
  }
  if (params.make) {
    const makes = params.make.split(",");
    conditions.push(inArray(inventory.make, makes));
  }
  if (params.customer) {
    const customers = params.customer.split(",");
    conditions.push(inArray(inventory.invoicingName, customers));
  }
  if (params.vendor) {
    const vendors = params.vendor.split(",");
    conditions.push(inArray(inventory.vendName, vendors));
  }
  if (params.gradeCondition) {
    const grades = params.gradeCondition.split(",");
    conditions.push(inArray(inventory.gradeCondition, grades));
  }
  
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Upload data endpoint - accepts JSON array of inventory items
  app.post("/api/data/upload", async (req: Request, res: Response) => {
    try {
      const items = req.body;
      
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Request body must be an array of inventory items" });
      }
      
      if (items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }
      
      // Map items from original schema (PascalCase) to local schema (camelCase)
      const mappedItems = items.map((item: Record<string, unknown>) => ({
        dataAreaId: item.dataAreaId as string || null,
        itemId: item.ItemId as string || null,
        inventSerialId: item.InventSerialId as string || null,
        dealRef: item.DealRef as string || null,
        purchPriceUSD: item.PurchPriceUSD?.toString() || null,
        purchDate: item.PurchDate as string || null,
        vendComments: item.VendComments as string || null,
        keyLang: item.KeyLang as string || null,
        osSticker: item.OsSticker as string || null,
        displaySize: item.DisplaySize as string || null,
        lcdCostUSD: item.LCDCostUSD?.toString() || null,
        storageSerialNum: item.StorageSerialNum as string || null,
        vendName: item.VendName as string || null,
        category: item.Category as string || null,
        madeIn: item.MadeIn as string || null,
        gradeCondition: item.GradeCondition as string || null,
        partsCostUSD: item.PartsCostUSD?.toString() || null,
        fingerprintStr: item.FingerprintStr as string || null,
        miscCostUSD: item.MiscCostUSD?.toString() || null,
        processorGen: item.ProcessorGen as string || null,
        manufacturingDate: item.ManufacturingDate as string || null,
        purchaseCategory: item.PurchaseCategory as string || null,
        keyLayout: item.KeyLayout as string || null,
        poNumber: item.PONumber as string || null,
        make: item.Make as string || null,
        processor: item.Processor as string || null,
        packagingCostUSD: item.PackagingCostUSD?.toString() || null,
        receivedDate: item.ReceivedDate as string || null,
        itadTreesCostUSD: item.ITADTreesCostUSD?.toString() || null,
        storageType: item.StorageType as string || null,
        soldAsHDD: item.SoldAsHDD as string || null,
        standardisationCostUSD: item.StandardisationCostUSD?.toString() || null,
        comments: item.Comments as string || null,
        purchPriceRevisedUSD: item.PurchPriceRevisedUSD?.toString() || null,
        status: item.Status as string || null,
        consumableCostUSD: item.ConsumableCostUSD?.toString() || null,
        chassis: item.Chassis as string || null,
        journalNum: item.JournalNum as string || null,
        batteryCostUSD: item.BatteryCostUSD?.toString() || null,
        ram: item.Ram as string || null,
        soldAsRAM: item.SoldAsRAM as string || null,
        freightChargesUSD: item.FreightChargesUSD?.toString() || null,
        hdd: item.HDD as string || null,
        coaCostUSD: item.COACostUSD?.toString() || null,
        manufacturerSerialNum: item.ManufacturerSerialNum as string || null,
        supplierPalletNum: item.SupplierPalletNum as string || null,
        resourceCostUSD: item.ResourceCostUSD?.toString() || null,
        customsDutyUSD: item.CustomsDutyUSD?.toString() || null,
        resolution: item.Resolution as string || null,
        modelNum: item.ModelNum as string || null,
        invoiceAccount: item.InvoiceAccount as string || null,
        totalCostCurUSD: item.TotalCostCurUSD?.toString() || null,
        salesOrderDate: item.SalesOrderDate as string || null,
        customerRef: item.CustomerRef as string || null,
        crmRef: item.CRMRef as string || null,
        invoicingName: item.InvoicingName as string || null,
        transType: item.TransType as string || null,
        salesInvoiceId: item.SalesInvoiceId as string || null,
        salesId: item.SalesId as string || null,
        invoiceDate: item.InvoiceDate as string || null,
        apinNumber: item.APINNumber as string || null,
        segregation: item.Segregation as string || null,
        finalSalesPriceUSD: item.FinalSalesPriceUSD?.toString() || null,
        finalTotalCostUSD: item.FinalTotalCostUSD?.toString() || null,
        orderTaker: item.OrderTaker as string || null,
        orderResponsible: item.OrderResponsible as string || null,
        productSpecification: item.ProductSpecification as string || null,
        warrantyStartDate: item.WarrantyStartDate as string || null,
        warrantyEndDate: item.WarrantyEndDate as string || null,
        warrantyDescription: item.WarrantyDescription as string || null,
      }));
      
      // Insert in batches of 1000
      const batchSize = 1000;
      for (let i = 0; i < mappedItems.length; i += batchSize) {
        const batch = mappedItems.slice(i, i + batchSize);
        await db.insert(inventory).values(batch);
      }
      
      // Record the upload
      await db.insert(dataUploads).values({
        recordsCount: items.length,
        status: "completed",
      });
      
      res.json({ 
        success: true, 
        message: `Successfully uploaded ${items.length} records`,
        recordsInserted: items.length
      });
    } catch (error) {
      console.error("Error uploading data:", error);
      res.status(500).json({ error: "Failed to upload data", details: String(error) });
    }
  });
  
  // Clear all data endpoint
  app.delete("/api/data/clear", async (_req: Request, res: Response) => {
    try {
      await db.delete(inventory);
      res.json({ success: true, message: "All inventory data cleared" });
    } catch (error) {
      console.error("Error clearing data:", error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });
  
  // Get upload history
  app.get("/api/data/uploads", async (_req: Request, res: Response) => {
    try {
      const uploads = await db.select().from(dataUploads).orderBy(desc(dataUploads.uploadedAt)).limit(20);
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching upload history:", error);
      res.status(500).json({ error: "Failed to fetch upload history" });
    }
  });
  
  // Get data count
  app.get("/api/data/count", async (_req: Request, res: Response) => {
    try {
      const result = await db.select({ count: count() }).from(inventory);
      res.json({ count: result[0]?.count || 0 });
    } catch (error) {
      console.error("Error fetching data count:", error);
      res.status(500).json({ error: "Failed to fetch data count" });
    }
  });

  // Get filter dropdown options
  app.get("/api/filters", async (_req: Request, res: Response) => {
    try {
      const [statuses, categories, makes, customers, vendors, grades] = await Promise.all([
        db.selectDistinct({ value: inventory.status }).from(inventory).where(and(isNotNull(inventory.status), ne(inventory.status, ""))).orderBy(asc(inventory.status)),
        db.selectDistinct({ value: inventory.category }).from(inventory).where(and(isNotNull(inventory.category), ne(inventory.category, ""))).orderBy(asc(inventory.category)),
        db.selectDistinct({ value: inventory.make }).from(inventory).where(and(isNotNull(inventory.make), ne(inventory.make, ""))).orderBy(asc(inventory.make)),
        db.selectDistinct({ value: inventory.invoicingName }).from(inventory).where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, ""))).orderBy(asc(inventory.invoicingName)).limit(100),
        db.selectDistinct({ value: inventory.vendName }).from(inventory).where(and(isNotNull(inventory.vendName), ne(inventory.vendName, ""))).orderBy(asc(inventory.vendName)).limit(100),
        db.selectDistinct({ value: inventory.gradeCondition }).from(inventory).where(and(isNotNull(inventory.gradeCondition), ne(inventory.gradeCondition, ""))).orderBy(asc(inventory.gradeCondition)),
      ]);

      const filterOptions: FilterDropdownOptions = {
        statuses: statuses.map(s => s.value!),
        categories: categories.map(c => c.value!),
        makes: makes.map(m => m.value!),
        customers: customers.map(c => c.value!),
        vendors: vendors.map(v => v.value!),
        grades: grades.map(g => g.value!),
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
      const whereCondition = buildFilterConditions(params);
      
      const items = await db.select().from(inventory)
        .where(whereCondition)
        .orderBy(desc(inventory.invoiceDate))
        .limit(1000);
      
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
      const whereCondition = buildFilterConditions(params);

      // Get KPIs
      const kpiResult = await db.select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        totalCost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        totalProfit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        unitsSold: count(),
        totalOrders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory).where(whereCondition);

      const kpis: KPISummary = {
        totalRevenue: Number(kpiResult[0]?.totalRevenue) || 0,
        totalCost: Number(kpiResult[0]?.totalCost) || 0,
        totalProfit: Number(kpiResult[0]?.totalProfit) || 0,
        profitMargin: Number(kpiResult[0]?.totalRevenue) > 0 
          ? (Number(kpiResult[0]?.totalProfit) / Number(kpiResult[0]?.totalRevenue)) * 100 
          : 0,
        unitsSold: Number(kpiResult[0]?.unitsSold) || 0,
        averageOrderValue: Number(kpiResult[0]?.totalOrders) > 0 
          ? Number(kpiResult[0]?.totalRevenue) / Number(kpiResult[0]?.totalOrders) 
          : 0,
        totalOrders: Number(kpiResult[0]?.totalOrders) || 0,
      };

      // Get revenue over time
      const revenueOverTimeResult = await db.select({
        date: inventory.invoiceDate,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(and(isNotNull(inventory.invoiceDate), whereCondition))
        .groupBy(inventory.invoiceDate)
        .orderBy(asc(inventory.invoiceDate))
        .limit(30);

      const revenueOverTime: TimeSeriesPoint[] = revenueOverTimeResult.map(r => ({
        date: r.date || "",
        revenue: Number(r.revenue),
        profit: Number(r.profit),
        cost: Number(r.cost),
        units: Number(r.units),
      }));

      // Get category breakdown
      const categoryResult = await db.select({
        category: inventory.category,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(inventory.category)
        .orderBy(sql`revenue DESC`);

      const categoryBreakdown: CategoryBreakdown[] = categoryResult.map(c => ({
        category: c.category || "Unknown",
        revenue: Number(c.revenue),
        profit: Number(c.profit),
        units: Number(c.units),
        count: Number(c.units),
      }));

      // Get top customers
      const customerResult = await db.select({
        name: inventory.invoicingName,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
        orderCount: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, ""), whereCondition))
        .groupBy(inventory.invoicingName)
        .orderBy(sql`revenue DESC`)
        .limit(10);

      const topCustomers: TopPerformer[] = customerResult.map(c => ({
        name: c.name || "Unknown",
        revenue: Number(c.revenue),
        profit: Number(c.profit),
        units: Number(c.units),
        count: Number(c.orderCount),
      }));

      // Get top products (by Make + Model)
      const productResult = await db.select({
        make: inventory.make,
        model: inventory.modelNum,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(inventory.make, inventory.modelNum)
        .orderBy(sql`revenue DESC`)
        .limit(10);

      const topProducts: TopPerformer[] = productResult.map(p => ({
        name: `${p.make || "Unknown"} ${p.model || ""}`.trim(),
        revenue: Number(p.revenue),
        profit: Number(p.profit),
        units: Number(p.units),
        count: Number(p.units),
      }));

      // Get top vendors
      const vendorResult = await db.select({
        name: inventory.vendName,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(and(isNotNull(inventory.vendName), ne(inventory.vendName, ""), whereCondition))
        .groupBy(inventory.vendName)
        .orderBy(sql`revenue DESC`)
        .limit(10);

      const topVendors: TopPerformer[] = vendorResult.map(v => ({
        name: v.name || "Unknown",
        revenue: Number(v.revenue),
        profit: Number(v.profit),
        units: Number(v.units),
        count: Number(v.units),
      }));

      // Get status breakdown
      const statusResult = await db.select({
        status: inventory.status,
        count: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(inventory.status)
        .orderBy(sql`count DESC`);

      const statusBreakdown = statusResult.map(s => ({
        status: s.status || "Unknown",
        count: Number(s.count),
      }));

      // Get grade breakdown
      const gradeResult = await db.select({
        grade: inventory.gradeCondition,
        count: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(inventory.gradeCondition)
        .orderBy(sql`count DESC`);

      const gradeBreakdown = gradeResult.map(g => ({
        grade: g.grade || "Unknown",
        count: Number(g.count),
      }));

      const dashboardData: DashboardData = {
        kpis,
        revenueOverTime,
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
      const topCustomers = await db.select({
        name: inventory.invoicingName,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
        orderCount: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(inventory.invoicingName)
        .orderBy(sql`revenue DESC`)
        .limit(50);

      const totals = await db.select({
        totalCustomers: sql<number>`COUNT(DISTINCT ${inventory.invoicingName})`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        totalProfit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        totalUnits: count(),
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")));

      res.json({
        topCustomers: topCustomers.map(c => ({
          name: c.name || "Unknown",
          revenue: Number(c.revenue),
          profit: Number(c.profit),
          units: Number(c.units),
          count: Number(c.orderCount),
        })),
        totalCustomers: Number(totals[0]?.totalCustomers) || 0,
        totalRevenue: Number(totals[0]?.totalRevenue) || 0,
        totalProfit: Number(totals[0]?.totalProfit) || 0,
        totalUnits: Number(totals[0]?.totalUnits) || 0,
      });
    } catch (error) {
      console.error("Error fetching customer analytics:", error);
      res.status(500).json({ error: "Failed to fetch customer analytics" });
    }
  });

  // Get product analytics
  app.get("/api/analytics/products", async (_req: Request, res: Response) => {
    try {
      const topProducts = await db.select({
        make: inventory.make,
        model: inventory.modelNum,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(inventory.make, inventory.modelNum)
        .orderBy(sql`revenue DESC`)
        .limit(50);

      const categoryBreakdown = await db.select({
        category: inventory.category,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(inventory.category)
        .orderBy(sql`revenue DESC`);

      const totals = await db.select({
        totalProducts: sql<number>`COUNT(DISTINCT CONCAT(${inventory.make}, ${inventory.modelNum}))`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        totalProfit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        totalUnits: count(),
      }).from(inventory);

      res.json({
        topProducts: topProducts.map(p => ({
          name: `${p.make || "Unknown"} ${p.model || ""}`.trim(),
          revenue: Number(p.revenue),
          profit: Number(p.profit),
          units: Number(p.units),
          count: Number(p.units),
        })),
        categoryBreakdown: categoryBreakdown.map(c => ({
          category: c.category || "Unknown",
          revenue: Number(c.revenue),
          profit: Number(c.profit),
          units: Number(c.units),
          count: Number(c.units),
        })),
        totalProducts: Number(totals[0]?.totalProducts) || 0,
        totalRevenue: Number(totals[0]?.totalRevenue) || 0,
        totalProfit: Number(totals[0]?.totalProfit) || 0,
        totalUnits: Number(totals[0]?.totalUnits) || 0,
      });
    } catch (error) {
      console.error("Error fetching product analytics:", error);
      res.status(500).json({ error: "Failed to fetch product analytics" });
    }
  });

  return httpServer;
}
