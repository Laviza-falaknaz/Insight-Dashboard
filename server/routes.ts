import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db, pool } from "./db";
import { inventory, dataUploads, returns } from "@shared/schema";
import { eq, sql, and, gte, lte, inArray, desc, asc, count, sum, isNotNull, ne } from "drizzle-orm";
import type { 
  DashboardData, 
  FilterDropdownOptions,
  KPISummary,
  TimeSeriesPoint,
  CategoryBreakdown,
  TopPerformer
} from "@shared/schema";

// Power Automate endpoint for SQL queries (from environment variable)
const POWER_AUTOMATE_URL = process.env.POWER_AUTOMATE_URL || "";

// Refresh status tracking
let refreshStatus: {
  isRunning: boolean;
  lastRun: Date | null;
  lastStatus: "success" | "error" | "running" | "idle";
  lastMessage: string;
  inventoryCount: number;
  returnsCount: number;
  duration: number;
} = {
  isRunning: false,
  lastRun: null,
  lastStatus: "idle",
  lastMessage: "No refresh has been run yet",
  inventoryCount: 0,
  returnsCount: 0,
  duration: 0,
};

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
  
  // Upsert inventory data endpoint - handles duplicates efficiently for 3M+ records
  // Uses batch multi-row inserts for high throughput
  app.post("/api/data/inventory/upsert", async (req: Request, res: Response) => {
    try {
      const items = req.body;
      
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Request body must be an array of inventory items" });
      }
      
      if (items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      let totalProcessed = 0;
      const batchSize = 500;
      const columns = [
        'data_area_id', 'item_id', 'invent_serial_id', 'deal_ref', 'purch_price_usd',
        'purch_date', 'vend_comments', 'key_lang', 'os_sticker', 'display_size',
        'lcd_cost_usd', 'storage_serial_num', 'vend_name', 'category', 'made_in',
        'grade_condition', 'parts_cost_usd', 'fingerprint_str', 'misc_cost_usd', 'processor_gen',
        'manufacturing_date', 'purchase_category', 'key_layout', 'po_number', 'make',
        'processor', 'packaging_cost_usd', 'received_date', 'itad_trees_cost_usd', 'storage_type',
        'sold_as_hdd', 'standardisation_cost_usd', 'comments', 'purch_price_revised_usd', 'status',
        'consumable_cost_usd', 'chassis', 'journal_num', 'battery_cost_usd', 'ram',
        'sold_as_ram', 'freight_charges_usd', 'hdd', 'coa_cost_usd', 'manufacturer_serial_num',
        'supplier_pallet_num', 'resource_cost_usd', 'customs_duty_usd', 'resolution', 'model_num',
        'invoice_account', 'total_cost_cur_usd', 'sales_order_date', 'customer_ref', 'crm_ref',
        'invoicing_name', 'trans_type', 'sales_invoice_id', 'sales_id', 'invoice_date',
        'apin_number', 'segregation', 'final_sales_price_usd', 'final_total_cost_usd', 'order_taker',
        'order_responsible', 'product_specification', 'warranty_start_date', 'warranty_end_date', 'warranty_description'
      ];
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize).filter((item: Record<string, unknown>) => item.InventSerialId);
        if (batch.length === 0) continue;
        
        const values: unknown[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;
        
        for (const item of batch) {
          const rowValues = [
            item.dataAreaId || null,
            item.ItemId || null,
            item.InventSerialId,
            item.DealRef || null,
            item.PurchPriceUSD?.toString() || null,
            item.PurchDate || null,
            item.VendComments || null,
            item.KeyLang || null,
            item.OsSticker || null,
            item.DisplaySize || null,
            item.LCDCostUSD?.toString() || null,
            item.StorageSerialNum || null,
            item.VendName || null,
            item.Category || null,
            item.MadeIn || null,
            item.GradeCondition || null,
            item.PartsCostUSD?.toString() || null,
            item.FingerprintStr || null,
            item.MiscCostUSD?.toString() || null,
            item.ProcessorGen || null,
            item.ManufacturingDate || null,
            item.PurchaseCategory || null,
            item.KeyLayout || null,
            item.PONumber || null,
            item.Make || null,
            item.Processor || null,
            item.PackagingCostUSD?.toString() || null,
            item.ReceivedDate || null,
            item.ITADTreesCostUSD?.toString() || null,
            item.StorageType || null,
            item.SoldAsHDD || null,
            item.StandardisationCostUSD?.toString() || null,
            item.Comments || null,
            item.PurchPriceRevisedUSD?.toString() || null,
            item.Status || null,
            item.ConsumableCostUSD?.toString() || null,
            item.Chassis || null,
            item.JournalNum || null,
            item.BatteryCostUSD?.toString() || null,
            item.Ram || null,
            item.SoldAsRAM || null,
            item.FreightChargesUSD?.toString() || null,
            item.HDD || null,
            item.COACostUSD?.toString() || null,
            item.ManufacturerSerialNum || null,
            item.SupplierPalletNum || null,
            item.ResourceCostUSD?.toString() || null,
            item.CustomsDutyUSD?.toString() || null,
            item.Resolution || null,
            item.ModelNum || null,
            item.InvoiceAccount || null,
            item.TotalCostCurUSD?.toString() || null,
            item.SalesOrderDate || null,
            item.CustomerRef || null,
            item.CRMRef || null,
            item.InvoicingName || null,
            item.TransType || null,
            item.SalesInvoiceId || null,
            item.SalesId || null,
            item.InvoiceDate || null,
            item.APINNumber || null,
            item.Segregation || null,
            item.FinalSalesPriceUSD?.toString() || null,
            item.FinalTotalCostUSD?.toString() || null,
            item.OrderTaker || null,
            item.OrderResponsible || null,
            item.ProductSpecification || null,
            item.WarrantyStartDate || null,
            item.WarrantyEndDate || null,
            item.WarrantyDescription || null,
          ];
          
          values.push(...rowValues);
          const placeholders = rowValues.map(() => `$${paramIndex++}`);
          valuePlaceholders.push(`(${placeholders.join(', ')})`);
        }
        
        const query = `
          INSERT INTO inventory (${columns.join(', ')})
          VALUES ${valuePlaceholders.join(', ')}
          ON CONFLICT (invent_serial_id, data_area_id, item_id, sales_id, trans_type) DO UPDATE SET
            deal_ref = EXCLUDED.deal_ref,
            purch_price_usd = EXCLUDED.purch_price_usd,
            purch_date = EXCLUDED.purch_date,
            vend_comments = EXCLUDED.vend_comments,
            vend_name = EXCLUDED.vend_name,
            category = EXCLUDED.category,
            grade_condition = EXCLUDED.grade_condition,
            make = EXCLUDED.make,
            status = EXCLUDED.status,
            invoicing_name = EXCLUDED.invoicing_name,
            invoice_date = EXCLUDED.invoice_date,
            final_sales_price_usd = EXCLUDED.final_sales_price_usd,
            final_total_cost_usd = EXCLUDED.final_total_cost_usd
        `;
        
        await pool.query(query, values);
        totalProcessed += batch.length;
      }
      
      // Record the upload
      await db.insert(dataUploads).values({
        tableName: "inventory",
        recordsCount: items.length,
        insertedCount: totalProcessed,
        updatedCount: 0,
        status: "completed",
      });
      
      res.json({ 
        success: true, 
        message: `Processed ${totalProcessed} records`,
        processed: totalProcessed
      });
    } catch (error) {
      console.error("Error upserting inventory data:", error);
      res.status(500).json({ error: "Failed to upsert data", details: String(error) });
    }
  });

  // Upsert returns data endpoint - handles duplicates efficiently
  // Uses batch multi-row inserts for high throughput
  app.post("/api/data/returns/upsert", async (req: Request, res: Response) => {
    try {
      const items = req.body;
      
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Request body must be an array of return items" });
      }
      
      if (items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      let totalProcessed = 0;
      const batchSize = 500;
      const columns = [
        'final_customer', 'related_order_name', 'case_id', 'rma_number', 'reason_for_return',
        'created_on', 'warehouse_notes', 'final_reseller_name', 'expected_shipping_date', 'rma_line_item_guid',
        'rma_line_name', 'case_end_user', 'uae_warehouse_notes', 'notes_description', 'rma_guid',
        'related_serial_guid', 'modified_on', 'opportunity_number', 'item_testing_date', 'final_distributor_name',
        'case_customer', 'item_received_date', 'case_description', 'dispatch_date', 'replacement_serial_guid',
        'rma_status', 'type_of_unit', 'line_status', 'line_solution', 'uae_final_outcome',
        'rma_topic_label', 'uk_final_outcome', 'serial_id', 'area_id', 'item_id'
      ];
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize).filter((item: Record<string, unknown>) => item.RMALineItemGUID);
        if (batch.length === 0) continue;
        
        const values: unknown[] = [];
        const valuePlaceholders: string[] = [];
        let paramIndex = 1;
        
        for (const item of batch) {
          const rowValues = [
            item.FinalCustomer || null,
            item.RelatedOrderName || null,
            item.CaseID || null,
            item.RMANumber || null,
            item.ReasonforReturn || null,
            item.CreatedOn || null,
            item.WarehouseNotes || null,
            item.FinalResellerName || null,
            item.ExpectedShippingDate || null,
            item.RMALineItemGUID,
            item.RMALineName || null,
            item.CaseEndUser || null,
            item.UAEWarehosueNotes || null,
            item.NotesDescription || null,
            item.RMAGUID || null,
            item.RelatedSerialGUID || null,
            item.ModifiedOn || null,
            item.OpportunityNumber || null,
            item.ItemTestingDate || null,
            item.FinalDistributorName || null,
            item.CaseCustomer || null,
            item.ItemReceivedDate || null,
            item.CaseDescription || null,
            item.DispatchDate || null,
            item.ReplacementSerialGUID || null,
            item.RMAStatus || null,
            item.TypeOfUnit || null,
            item.LineStatus || null,
            item.LineSolution || null,
            item.UAEFinalOutcome || null,
            item.RMATopicLabel || null,
            item.UKFinalOutcome || null,
            item.SerialID || null,
            item.AreaID || null,
            item.ItemID || null,
          ];
          
          values.push(...rowValues);
          const placeholders = rowValues.map(() => `$${paramIndex++}`);
          valuePlaceholders.push(`(${placeholders.join(', ')})`);
        }
        
        const query = `
          INSERT INTO returns (${columns.join(', ')})
          VALUES ${valuePlaceholders.join(', ')}
          ON CONFLICT (rma_line_item_guid) DO UPDATE SET
            final_customer = EXCLUDED.final_customer,
            rma_number = EXCLUDED.rma_number,
            reason_for_return = EXCLUDED.reason_for_return,
            warehouse_notes = EXCLUDED.warehouse_notes,
            modified_on = EXCLUDED.modified_on,
            rma_status = EXCLUDED.rma_status,
            line_status = EXCLUDED.line_status,
            line_solution = EXCLUDED.line_solution,
            uae_final_outcome = EXCLUDED.uae_final_outcome,
            uk_final_outcome = EXCLUDED.uk_final_outcome,
            updated_at = NOW()
        `;
        
        await pool.query(query, values);
        totalProcessed += batch.length;
      }
      
      // Record the upload
      await db.insert(dataUploads).values({
        tableName: "returns",
        recordsCount: items.length,
        insertedCount: totalProcessed,
        updatedCount: 0,
        status: "completed",
      });
      
      res.json({ 
        success: true, 
        message: `Processed ${totalProcessed} records`,
        processed: totalProcessed
      });
    } catch (error) {
      console.error("Error upserting returns data:", error);
      res.status(500).json({ error: "Failed to upsert data", details: String(error) });
    }
  });

  // Get returns data
  app.get("/api/returns", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 1000;
      const items = await db.select().from(returns)
        .orderBy(desc(returns.createdOn))
        .limit(limit);
      res.json(items);
    } catch (error) {
      console.error("Error fetching returns:", error);
      res.status(500).json({ error: "Failed to fetch returns data" });
    }
  });

  // Get returns count
  app.get("/api/data/returns/count", async (_req: Request, res: Response) => {
    try {
      const result = await db.select({ count: count() }).from(returns);
      res.json({ count: result[0]?.count || 0 });
    } catch (error) {
      console.error("Error fetching returns count:", error);
      res.status(500).json({ error: "Failed to fetch returns count" });
    }
  });

  // Clear all data endpoint (now clears both tables)
  app.delete("/api/data/clear", async (req: Request, res: Response) => {
    try {
      const table = req.query.table as string;
      if (table === "inventory") {
        await db.delete(inventory);
        res.json({ success: true, message: "Inventory data cleared" });
      } else if (table === "returns") {
        await db.delete(returns);
        res.json({ success: true, message: "Returns data cleared" });
      } else {
        await db.delete(inventory);
        await db.delete(returns);
        res.json({ success: true, message: "All data cleared" });
      }
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
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`));

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
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
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
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
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
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
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
        statusCount: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(inventory.status)
        .orderBy(desc(count()));

      const statusBreakdown = statusResult.map(s => ({
        status: s.status || "Unknown",
        count: Number(s.statusCount),
      }));

      // Get grade breakdown
      const gradeResult = await db.select({
        grade: inventory.gradeCondition,
        gradeCount: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(inventory.gradeCondition)
        .orderBy(desc(count()));

      const gradeBreakdown = gradeResult.map(g => ({
        grade: g.grade || "Unknown",
        count: Number(g.gradeCount),
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
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
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
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(50);

      const categoryBreakdown = await db.select({
        category: inventory.category,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(inventory.category)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`));

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

  // ============================================
  // REFRESH DB - Scheduled Data Sync Endpoint
  // ============================================
  
  // Get refresh status
  app.get("/api/refresh/status", async (_req: Request, res: Response) => {
    res.json(refreshStatus);
  });

  // Trigger database refresh - fetches all data via Power Automate and ingests locally
  app.get("/api/refresh/db", async (_req: Request, res: Response) => {
    // Prevent concurrent refreshes
    if (refreshStatus.isRunning) {
      return res.status(409).json({ 
        error: "Refresh already in progress", 
        status: refreshStatus 
      });
    }

    if (!POWER_AUTOMATE_URL) {
      return res.status(500).json({ 
        error: "POWER_AUTOMATE_URL environment variable not configured" 
      });
    }

    const startTime = Date.now();
    refreshStatus = {
      isRunning: true,
      lastRun: new Date(),
      lastStatus: "running",
      lastMessage: "Starting data refresh...",
      inventoryCount: 0,
      returnsCount: 0,
      duration: 0,
    };

    // Respond immediately, process in background
    res.json({ 
      message: "Refresh started", 
      status: refreshStatus,
      checkStatusAt: "/api/refresh/status"
    });

    // Run refresh in background
    (async () => {
      try {
        const BATCH_SIZE = 500;
        const PAGE_SIZE = 50000; // Fetch 50k records at a time to stay under 104MB buffer
        
        // ---- FETCH AND INGEST INVENTORY (PAGINATED) ----
        console.log("[Refresh] Fetching inventory data via Power Automate (paginated)...");
        refreshStatus.lastMessage = "Fetching inventory data...";
        
        let inventoryProcessed = 0;
        let pageOffset = 0;
        let hasMoreInventory = true;
        
        while (hasMoreInventory) {
          const paginatedQuery = `SELECT * FROM Inventory ORDER BY InventSerialId OFFSET ${pageOffset} ROWS FETCH NEXT ${PAGE_SIZE} ROWS ONLY`;
          
          console.log(`[Refresh] Fetching inventory page: offset ${pageOffset}, limit ${PAGE_SIZE}`);
          refreshStatus.lastMessage = `Fetching inventory records (offset: ${pageOffset})...`;
          
          const inventoryResponse = await fetch(POWER_AUTOMATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "Inventory", query: paginatedQuery }),
          });
          
          if (!inventoryResponse.ok) {
            const errorText = await inventoryResponse.text();
            throw new Error(`Inventory fetch failed: ${inventoryResponse.status} - ${errorText}`);
          }
          
          const inventoryData = await inventoryResponse.json();
          const inventoryRows = Array.isArray(inventoryData) ? inventoryData : (inventoryData.value || inventoryData.data || []);
          
          console.log(`[Refresh] Fetched ${inventoryRows.length} inventory records (page offset: ${pageOffset})`);
          
          if (inventoryRows.length === 0) {
            hasMoreInventory = false;
            break;
          }
          
          refreshStatus.lastMessage = `Ingesting inventory batch (offset: ${pageOffset}, count: ${inventoryRows.length})...`;
          
          // Process this page in batches of 500
          for (let i = 0; i < inventoryRows.length; i += BATCH_SIZE) {
            const batch = inventoryRows.slice(i, i + BATCH_SIZE);
            
            const columns = [
              'data_area_id', 'item_id', 'invent_serial_id', 'deal_ref', 'purch_price_usd',
              'purch_date', 'vend_comments', 'key_lang', 'os_sticker', 'display_size',
              'lcd_cost_usd', 'storage_serial_num', 'vend_name', 'category', 'made_in',
              'grade_condition', 'parts_cost_usd', 'fingerprint_str', 'misc_cost_usd',
              'processor_gen', 'manufacturing_date', 'purchase_category', 'key_layout',
              'po_number', 'make', 'processor', 'packaging_cost_usd', 'received_date',
              'itad_trees_cost_usd', 'storage_type', 'sold_as_hdd', 'standardisation_cost_usd',
              'comments', 'purch_price_revised_usd', 'status', 'consumable_cost_usd',
              'chassis', 'journal_num', 'battery_cost_usd', 'ram', 'sold_as_ram',
              'freight_charges_usd', 'hdd', 'coa_cost_usd', 'manufacturer_serial_num',
              'supplier_pallet_num', 'resource_cost_usd', 'customs_duty_usd', 'resolution',
              'model_num', 'invoice_account', 'total_cost_cur_usd', 'sales_order_date',
              'customer_ref', 'crm_ref', 'invoicing_name', 'trans_type', 'sales_invoice_id',
              'sales_id', 'invoice_date', 'apin_number', 'segregation', 'final_sales_price_usd',
              'final_total_cost_usd', 'order_taker', 'order_responsible', 'product_specification',
              'warranty_start_date', 'warranty_end_date', 'warranty_description'
            ];
            
            const values: unknown[] = [];
            const valuePlaceholders: string[] = [];
            let paramIndex = 1;
            
            for (const item of batch) {
              const rowValues = [
                item.dataAreaId || null,
                item.ItemId || null,
                item.InventSerialId || null,
                item.DealRef || null,
                item.PurchPriceUSD?.toString() || null,
                item.PurchDate || null,
                item.VendComments || null,
                item.KeyLang || null,
                item.OsSticker || null,
                item.DisplaySize || null,
                item.LCDCostUSD?.toString() || null,
                item.StorageSerialNum || null,
                item.VendName || null,
                item.Category || null,
                item.MadeIn || null,
                item.GradeCondition || null,
                item.PartsCostUSD?.toString() || null,
                item.FingerprintStr || null,
                item.MiscCostUSD?.toString() || null,
                item.ProcessorGen || null,
                item.ManufacturingDate || null,
                item.PurchaseCategory || null,
                item.KeyLayout || null,
                item.PONumber || null,
                item.Make || null,
                item.Processor || null,
                item.PackagingCostUSD?.toString() || null,
                item.ReceivedDate || null,
                item.ITADTreesCostUSD?.toString() || null,
                item.StorageType || null,
                item.SoldAsHDD || null,
                item.StandardisationCostUSD?.toString() || null,
                item.Comments || null,
                item.PurchPriceRevisedUSD?.toString() || null,
                item.Status || null,
                item.ConsumableCostUSD?.toString() || null,
                item.Chassis || null,
                item.JournalNum || null,
                item.BatteryCostUSD?.toString() || null,
                item.Ram || null,
                item.SoldAsRAM || null,
                item.FreightChargesUSD?.toString() || null,
                item.HDD || null,
                item.COACostUSD?.toString() || null,
                item.ManufacturerSerialNum || null,
                item.SupplierPalletNum || null,
                item.ResourceCostUSD?.toString() || null,
                item.CustomsDutyUSD?.toString() || null,
                item.Resolution || null,
                item.ModelNum || null,
                item.InvoiceAccount || null,
                item.TotalCostCurUSD?.toString() || null,
                item.SalesOrderDate || null,
                item.CustomerRef || null,
                item.CRMRef || null,
                item.InvoicingName || null,
                item.TransType || null,
                item.SalesInvoiceId || null,
                item.SalesId || null,
                item.InvoiceDate || null,
                item.APINNumber || null,
                item.Segregation || null,
                item.FinalSalesPriceUSD?.toString() || null,
                item.FinalTotalCostUSD?.toString() || null,
                item.OrderTaker || null,
                item.OrderResponsible || null,
                item.ProductSpecification || null,
                item.WarrantyStartDate || null,
                item.WarrantyEndDate || null,
                item.WarrantyDescription || null,
              ];
              
              values.push(...rowValues);
              const placeholders = rowValues.map(() => `$${paramIndex++}`);
              valuePlaceholders.push(`(${placeholders.join(', ')})`);
            }
            
            const query = `
              INSERT INTO inventory (${columns.join(', ')})
              VALUES ${valuePlaceholders.join(', ')}
              ON CONFLICT (invent_serial_id, data_area_id, item_id, sales_id, trans_type) DO UPDATE SET
                deal_ref = EXCLUDED.deal_ref,
                purch_price_usd = EXCLUDED.purch_price_usd,
                purch_date = EXCLUDED.purch_date,
                vend_comments = EXCLUDED.vend_comments,
                vend_name = EXCLUDED.vend_name,
                category = EXCLUDED.category,
                grade_condition = EXCLUDED.grade_condition,
                make = EXCLUDED.make,
                status = EXCLUDED.status,
                invoicing_name = EXCLUDED.invoicing_name,
                invoice_date = EXCLUDED.invoice_date,
                final_sales_price_usd = EXCLUDED.final_sales_price_usd,
                final_total_cost_usd = EXCLUDED.final_total_cost_usd,
                model_num = EXCLUDED.model_num,
                trans_type = EXCLUDED.trans_type,
                sales_id = EXCLUDED.sales_id
            `;
            
            await pool.query(query, values);
            inventoryProcessed += batch.length;
            refreshStatus.inventoryCount = inventoryProcessed;
            refreshStatus.lastMessage = `Inventory: ${inventoryProcessed} processed (page offset: ${pageOffset})`;
            console.log(`[Refresh] Inventory batch: ${inventoryProcessed} total processed`);
          }
          
          // Move to next page
          pageOffset += PAGE_SIZE;
          
          // If we got fewer records than PAGE_SIZE, we've reached the end
          if (inventoryRows.length < PAGE_SIZE) {
            hasMoreInventory = false;
          }
        }
        
        console.log(`[Refresh] Inventory complete: ${inventoryProcessed} total records`);
        
        // ---- FETCH AND INGEST RETURNS ----
        console.log("[Refresh] Fetching returns data via Power Automate...");
        refreshStatus.lastMessage = "Fetching returns data...";
        
        const returnsResponse = await fetch(POWER_AUTOMATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "RMAs", query: "SELECT * FROM RMAs" }),
        });
        
        if (!returnsResponse.ok) {
          throw new Error(`Returns fetch failed: ${returnsResponse.status} ${returnsResponse.statusText}`);
        }
        
        const returnsData = await returnsResponse.json();
        const returnsRows = Array.isArray(returnsData) ? returnsData : (returnsData.value || returnsData.data || []);
        console.log(`[Refresh] Fetched ${returnsRows.length} returns records`);
        refreshStatus.lastMessage = `Ingesting ${returnsRows.length} returns records...`;
        
        let returnsProcessed = 0;
        
        for (let i = 0; i < returnsRows.length; i += BATCH_SIZE) {
          const batch = returnsRows.slice(i, i + BATCH_SIZE);
          
          const columns = [
            'final_customer', 'related_order_name', 'case_id', 'rma_number',
            'reason_for_return', 'created_on', 'warehouse_notes', 'final_reseller_name',
            'expected_shipping_date', 'rma_line_item_guid', 'rma_line_name', 'case_end_user',
            'uae_warehouse_notes', 'notes_description', 'rma_guid', 'related_serial_guid',
            'modified_on', 'opportunity_number', 'item_testing_date', 'final_distributor_name',
            'case_customer', 'item_received_date', 'case_description', 'dispatch_date',
            'replacement_serial_guid', 'rma_status', 'type_of_unit', 'line_status',
            'line_solution', 'uae_final_outcome', 'rma_topic_label', 'uk_final_outcome',
            'serial_id', 'area_id', 'item_id'
          ];
          
          const values: unknown[] = [];
          const valuePlaceholders: string[] = [];
          let paramIndex = 1;
          
          for (const item of batch) {
            const rowValues = [
              item.FinalCustomer || null,
              item.RelatedOrderName || null,
              item.CaseID || null,
              item.RMANumber || null,
              item.ReasonforReturn || null,
              item.CreatedOn || null,
              item.WarehouseNotes || null,
              item.FinalResellerName || null,
              item.ExpectedShippingDate || null,
              item.RMALineItemGUID || null,
              item.RMALineName || null,
              item.CaseEndUser || null,
              item.UAEWarehosueNotes || null,
              item.NotesDescription || null,
              item.RMAGUID || null,
              item.RelatedSerialGUID || null,
              item.ModifiedOn || null,
              item.OpportunityNumber || null,
              item.ItemTestingDate || null,
              item.FinalDistributorName || null,
              item.CaseCustomer || null,
              item.ItemReceivedDate || null,
              item.CaseDescription || null,
              item.DispatchDate || null,
              item.ReplacementSerialGUID || null,
              item.RMAStatus || null,
              item.TypeOfUnit || null,
              item.LineStatus || null,
              item.LineSolution || null,
              item.UAEFinalOutcome || null,
              item.RMATopicLabel || null,
              item.UKFinalOutcome || null,
              item.SerialID || null,
              item.AreaID || null,
              item.ItemID || null,
            ];
            
            values.push(...rowValues);
            const placeholders = rowValues.map(() => `$${paramIndex++}`);
            valuePlaceholders.push(`(${placeholders.join(', ')})`);
          }
          
          const query = `
            INSERT INTO returns (${columns.join(', ')})
            VALUES ${valuePlaceholders.join(', ')}
            ON CONFLICT (rma_line_item_guid) DO UPDATE SET
              rma_status = EXCLUDED.rma_status,
              line_status = EXCLUDED.line_status,
              line_solution = EXCLUDED.line_solution,
              modified_on = EXCLUDED.modified_on,
              dispatch_date = EXCLUDED.dispatch_date,
              item_received_date = EXCLUDED.item_received_date,
              uae_final_outcome = EXCLUDED.uae_final_outcome,
              uk_final_outcome = EXCLUDED.uk_final_outcome
          `;
          
          await pool.query(query, values);
          returnsProcessed += batch.length;
          refreshStatus.returnsCount = returnsProcessed;
          refreshStatus.lastMessage = `Returns: ${returnsProcessed}/${returnsRows.length} processed`;
          console.log(`[Refresh] Returns batch ${Math.floor(i/BATCH_SIZE) + 1}: ${returnsProcessed}/${returnsRows.length}`);
        }
        
        // Record successful upload
        await db.insert(dataUploads).values({
          tableName: "refresh_db",
          recordsCount: inventoryProcessed + returnsProcessed,
          status: "success",
        });
        
        const duration = Date.now() - startTime;
        refreshStatus = {
          isRunning: false,
          lastRun: new Date(),
          lastStatus: "success",
          lastMessage: `Refresh completed successfully`,
          inventoryCount: inventoryProcessed,
          returnsCount: returnsProcessed,
          duration,
        };
        
        console.log(`[Refresh] Completed in ${duration}ms - Inventory: ${inventoryProcessed}, Returns: ${returnsProcessed}`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        refreshStatus = {
          isRunning: false,
          lastRun: new Date(),
          lastStatus: "error",
          lastMessage: `Refresh failed: ${errorMessage}`,
          inventoryCount: refreshStatus.inventoryCount,
          returnsCount: refreshStatus.returnsCount,
          duration,
        };
        
        console.error("[Refresh] Error:", error);
        
        // Record failed upload
        await db.insert(dataUploads).values({
          tableName: "refresh_db",
          recordsCount: 0,
          status: "error",
        });
      }
    })();
  });

  return httpServer;
}
