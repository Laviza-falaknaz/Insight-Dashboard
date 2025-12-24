import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { db, pool } from "./db";
import { inventory, dataUploads, returns, users, themePresets, savedCollections, type ThemeId } from "@shared/schema";
import { eq, sql, and, gte, lte, inArray, desc, asc, count, sum, isNotNull, ne } from "drizzle-orm";
import { setupAuth, requireAuth, requireAdminToken, registerUser } from "./auth";
import OpenAI from "openai";
import type { 
  DashboardData, 
  FilterDropdownOptions,
  KPISummary,
  TimeSeriesPoint,
  CategoryBreakdown,
  TopPerformer,
  AIInsightRequest,
  AIInsightResponse,
  DrillDownConfig
} from "@shared/schema";

// Initialize OpenAI client (optional - only if API key is provided)
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Power Automate endpoint for SQL queries (from environment variable)
const POWER_AUTOMATE_URL = process.env.POWER_AUTOMATE_URL || "";

// Helper function to sanitize numeric values - extracts only numeric parts
function sanitizeNumeric(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === "" || str.toLowerCase() === "null") return null;
  // Extract numeric value (including negative and decimal)
  const match = str.match(/^-?\d+\.?\d*/);
  if (match && match[0]) {
    return match[0];
  }
  // Check if it's purely non-numeric (like "USD")
  if (!/\d/.test(str)) return null;
  // Try to extract any number from the string
  const numMatch = str.match(/-?\d+\.?\d*/);
  return numMatch ? numMatch[0] : null;
}

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
  
  // Setup authentication
  setupAuth(app);
  
  // ========== AUTHENTICATION ROUTES ==========
  
  // Register new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      const user = await registerUser(email, password);
      
      req.login({ id: user.id, email: user.email, themeId: user.themeId, isAdmin: user.isAdmin }, (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed after registration" });
        }
        res.json({ 
          user: { id: user.id, email: user.email, themeId: user.themeId, isAdmin: user.isAdmin } 
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      res.status(400).json({ error: message });
    }
  });
  
  // Login
  app.post("/api/auth/login", (req: Request, res: Response, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login failed" });
        }
        res.json({ user: { id: user.id, email: user.email, themeId: user.themeId, isAdmin: user.isAdmin } });
      });
    })(req, res, next);
  });
  
  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Get current user
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ user: req.user });
  });
  
  // Update user theme
  app.patch("/api/auth/theme", requireAuth, async (req: Request, res: Response) => {
    try {
      const { themeId } = req.body;
      
      if (!themeId || !Object.keys(themePresets).includes(themeId)) {
        return res.status(400).json({ error: "Invalid theme ID" });
      }
      
      await db
        .update(users)
        .set({ themeId })
        .where(eq(users.id, req.user!.id));
      
      res.json({ themeId, theme: themePresets[themeId as ThemeId] });
    } catch (error) {
      res.status(500).json({ error: "Failed to update theme" });
    }
  });
  
  // Get theme presets
  app.get("/api/themes", (_req: Request, res: Response) => {
    res.json(themePresets);
  });
  
  // ========== ADMIN ROUTES (Token Protected) ==========
  
  // Admin: Trigger database refresh
  app.get("/api/admin/refresh/trigger", requireAdminToken, async (_req: Request, res: Response) => {
    if (refreshStatus.isRunning) {
      return res.status(409).json({ 
        error: "Refresh already in progress", 
        status: refreshStatus 
      });
    }
    
    // Trigger the refresh by calling the internal endpoint
    const response = await fetch(`http://localhost:5000/api/refresh/db`);
    const data = await response.json();
    res.json(data);
  });
  
  // Admin: Get refresh status
  app.get("/api/admin/refresh/status", requireAdminToken, async (_req: Request, res: Response) => {
    res.json(refreshStatus);
  });
  
  // Admin: Get refresh logs (activity trace)
  app.get("/api/admin/refresh/logs", requireAdminToken, async (_req: Request, res: Response) => {
    try {
      const logs = await db
        .select()
        .from(dataUploads)
        .orderBy(desc(dataUploads.uploadedAt))
        .limit(50);
      
      res.json({ logs, currentStatus: refreshStatus });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });
  
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
        purchPriceUSD: sanitizeNumeric(item.PurchPriceUSD),
        purchDate: item.PurchDate as string || null,
        vendComments: item.VendComments as string || null,
        keyLang: item.KeyLang as string || null,
        osSticker: item.OsSticker as string || null,
        displaySize: item.DisplaySize as string || null,
        lcdCostUSD: sanitizeNumeric(item.LCDCostUSD),
        storageSerialNum: item.StorageSerialNum as string || null,
        vendName: item.VendName as string || null,
        category: item.Category as string || null,
        madeIn: item.MadeIn as string || null,
        gradeCondition: item.GradeCondition as string || null,
        partsCostUSD: sanitizeNumeric(item.PartsCostUSD),
        fingerprintStr: item.FingerprintStr as string || null,
        miscCostUSD: sanitizeNumeric(item.MiscCostUSD),
        processorGen: item.ProcessorGen as string || null,
        manufacturingDate: item.ManufacturingDate as string || null,
        purchaseCategory: item.PurchaseCategory as string || null,
        keyLayout: item.KeyLayout as string || null,
        poNumber: item.PONumber as string || null,
        make: item.Make as string || null,
        processor: item.Processor as string || null,
        packagingCostUSD: sanitizeNumeric(item.PackagingCostUSD),
        receivedDate: item.ReceivedDate as string || null,
        itadTreesCostUSD: sanitizeNumeric(item.ITADTreesCostUSD),
        storageType: item.StorageType as string || null,
        soldAsHDD: item.SoldAsHDD as string || null,
        standardisationCostUSD: sanitizeNumeric(item.StandardisationCostUSD),
        comments: item.Comments as string || null,
        purchPriceRevisedUSD: sanitizeNumeric(item.PurchPriceRevisedUSD),
        status: item.Status as string || null,
        consumableCostUSD: sanitizeNumeric(item.ConsumableCostUSD),
        chassis: item.Chassis as string || null,
        journalNum: item.JournalNum as string || null,
        batteryCostUSD: sanitizeNumeric(item.BatteryCostUSD),
        ram: item.Ram as string || null,
        soldAsRAM: item.SoldAsRAM as string || null,
        freightChargesUSD: sanitizeNumeric(item.FreightChargesUSD),
        hdd: item.HDD as string || null,
        coaCostUSD: sanitizeNumeric(item.COACostUSD),
        manufacturerSerialNum: item.ManufacturerSerialNum as string || null,
        supplierPalletNum: item.SupplierPalletNum as string || null,
        resourceCostUSD: sanitizeNumeric(item.ResourceCostUSD),
        customsDutyUSD: sanitizeNumeric(item.CustomsDutyUSD),
        resolution: item.Resolution as string || null,
        modelNum: item.ModelNum as string || null,
        invoiceAccount: item.InvoiceAccount as string || null,
        totalCostCurUSD: item.TotalCostCurUSD as string || null,
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
        finalSalesPriceUSD: sanitizeNumeric(item.FinalSalesPriceUSD),
        finalTotalCostUSD: sanitizeNumeric(item.FinalTotalCostUSD),
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
            sanitizeNumeric(item.PurchPriceUSD),
            item.PurchDate || null,
            item.VendComments || null,
            item.KeyLang || null,
            item.OsSticker || null,
            item.DisplaySize || null,
            sanitizeNumeric(item.LCDCostUSD),
            item.StorageSerialNum || null,
            item.VendName || null,
            item.Category || null,
            item.MadeIn || null,
            item.GradeCondition || null,
            sanitizeNumeric(item.PartsCostUSD),
            item.FingerprintStr || null,
            sanitizeNumeric(item.MiscCostUSD),
            item.ProcessorGen || null,
            item.ManufacturingDate || null,
            item.PurchaseCategory || null,
            item.KeyLayout || null,
            item.PONumber || null,
            item.Make || null,
            item.Processor || null,
            sanitizeNumeric(item.PackagingCostUSD),
            item.ReceivedDate || null,
            sanitizeNumeric(item.ITADTreesCostUSD),
            item.StorageType || null,
            item.SoldAsHDD || null,
            sanitizeNumeric(item.StandardisationCostUSD),
            item.Comments || null,
            sanitizeNumeric(item.PurchPriceRevisedUSD),
            item.Status || null,
            sanitizeNumeric(item.ConsumableCostUSD),
            item.Chassis || null,
            item.JournalNum || null,
            sanitizeNumeric(item.BatteryCostUSD),
            item.Ram || null,
            item.SoldAsRAM || null,
            sanitizeNumeric(item.FreightChargesUSD),
            item.HDD || null,
            sanitizeNumeric(item.COACostUSD),
            item.ManufacturerSerialNum || null,
            item.SupplierPalletNum || null,
            sanitizeNumeric(item.ResourceCostUSD),
            sanitizeNumeric(item.CustomsDutyUSD),
            item.Resolution || null,
            item.ModelNum || null,
            item.InvoiceAccount || null,
            item.TotalCostCurUSD || null,
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
            sanitizeNumeric(item.FinalSalesPriceUSD),
            sanitizeNumeric(item.FinalTotalCostUSD),
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

      // Get category breakdown (case-insensitive grouping)
      const categoryResult = await db.select({
        category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`));

      const categoryBreakdown: CategoryBreakdown[] = categoryResult.map(c => ({
        category: c.category || "Unknown",
        revenue: Number(c.revenue),
        profit: Number(c.profit),
        units: Number(c.units),
        count: Number(c.units),
      }));

      // Get top customers (case-insensitive grouping)
      const customerResult = await db.select({
        name: sql<string>`UPPER(${inventory.invoicingName})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
        orderCount: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, ""), whereCondition))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(10);

      const topCustomers: TopPerformer[] = customerResult.map(c => ({
        name: c.name || "Unknown",
        revenue: Number(c.revenue),
        profit: Number(c.profit),
        units: Number(c.units),
        count: Number(c.orderCount),
      }));

      // Get top products (by Make + Model, case-insensitive grouping)
      const productResult = await db.select({
        make: sql<string>`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`,
        model: sql<string>`UPPER(COALESCE(${inventory.modelNum}, ''))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(sql`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`, sql`UPPER(COALESCE(${inventory.modelNum}, ''))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(10);

      const topProducts: TopPerformer[] = productResult.map(p => ({
        name: `${p.make || "Unknown"} ${p.model || ""}`.trim(),
        revenue: Number(p.revenue),
        profit: Number(p.profit),
        units: Number(p.units),
        count: Number(p.units),
      }));

      // Get top vendors (case-insensitive grouping)
      const vendorResult = await db.select({
        name: sql<string>`UPPER(${inventory.vendName})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(and(isNotNull(inventory.vendName), ne(inventory.vendName, ""), whereCondition))
        .groupBy(sql`UPPER(${inventory.vendName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(10);

      const topVendors: TopPerformer[] = vendorResult.map(v => ({
        name: v.name || "Unknown",
        revenue: Number(v.revenue),
        profit: Number(v.profit),
        units: Number(v.units),
        count: Number(v.units),
      }));

      // Get status breakdown (case-insensitive grouping)
      const statusResult = await db.select({
        status: sql<string>`UPPER(COALESCE(${inventory.status}, 'UNKNOWN'))`,
        statusCount: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(sql`UPPER(COALESCE(${inventory.status}, 'UNKNOWN'))`)
        .orderBy(desc(count()));

      const statusBreakdown = statusResult.map(s => ({
        status: s.status || "Unknown",
        count: Number(s.statusCount),
      }));

      // Get grade breakdown (case-insensitive grouping)
      const gradeResult = await db.select({
        grade: sql<string>`UPPER(COALESCE(${inventory.gradeCondition}, 'UNKNOWN'))`,
        gradeCount: count(),
      }).from(inventory)
        .where(whereCondition)
        .groupBy(sql`UPPER(COALESCE(${inventory.gradeCondition}, 'UNKNOWN'))`)
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

  // Get customer analytics (case-insensitive grouping)
  app.get("/api/analytics/customers", async (_req: Request, res: Response) => {
    try {
      const topCustomers = await db.select({
        name: sql<string>`UPPER(${inventory.invoicingName})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
        orderCount: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
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

  // Get product analytics (case-insensitive grouping)
  app.get("/api/analytics/products", async (_req: Request, res: Response) => {
    try {
      const topProducts = await db.select({
        make: sql<string>`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`,
        model: sql<string>`UPPER(COALESCE(${inventory.modelNum}, ''))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`, sql`UPPER(COALESCE(${inventory.modelNum}, ''))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(50);

      const categoryBreakdown = await db.select({
        category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
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
  // EXECUTIVE INSIGHTS API ENDPOINTS
  // ============================================

  // Freight Analysis - comprehensive freight cost insights
  app.get("/api/insights/freight", async (_req: Request, res: Response) => {
    try {
      // Total freight metrics
      const freightTotals = await db.select({
        totalFreight: sql<number>`COALESCE(SUM(CAST(${inventory.freightChargesUSD} as numeric)), 0)`,
        totalCost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        itemCount: count(),
      }).from(inventory);

      const totalFreight = Number(freightTotals[0]?.totalFreight) || 0;
      const totalCost = Number(freightTotals[0]?.totalCost) || 0;
      const itemCount = Number(freightTotals[0]?.itemCount) || 0;

      // Freight by supplier (case-insensitive grouping)
      const freightBySupplier = await db.select({
        supplier: sql<string>`UPPER(${inventory.vendName})`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.freightChargesUSD} as numeric)), 0)`,
        itemCount: count(),
      }).from(inventory)
        .where(and(isNotNull(inventory.vendName), ne(inventory.vendName, "")))
        .groupBy(sql`UPPER(${inventory.vendName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.freightChargesUSD} as numeric)), 0)`))
        .limit(20);

      // Freight by category (case-insensitive grouping)
      const freightByCategory = await db.select({
        category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.freightChargesUSD} as numeric)), 0)`,
        itemCount: count(),
      }).from(inventory)
        .where(and(isNotNull(inventory.category), ne(inventory.category, "")))
        .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.freightChargesUSD} as numeric)), 0)`))
        .limit(15);

      // Calculate concentration risk (top 3 suppliers % of total freight)
      const top3Freight = freightBySupplier.slice(0, 3).reduce((sum, s) => sum + Number(s.cost), 0);
      const concentrationRisk = totalFreight > 0 ? (top3Freight / totalFreight) * 100 : 0;

      // Generate alerts
      const alerts: any[] = [];
      
      if (concentrationRisk > 65) {
        alerts.push({
          type: 'concentration',
          severity: concentrationRisk > 80 ? 'high' : 'medium',
          title: 'High Freight Concentration Risk',
          description: `Top 3 suppliers account for ${concentrationRisk.toFixed(1)}% of total freight costs`,
          value: concentrationRisk,
          recommendation: 'Diversify supplier base to reduce dependency and negotiate better rates',
        });
      }

      // Check for high freight as % of cost per supplier
      freightBySupplier.forEach(s => {
        const avgPerUnit = Number(s.itemCount) > 0 ? Number(s.cost) / Number(s.itemCount) : 0;
        const overallAvg = itemCount > 0 ? totalFreight / itemCount : 0;
        if (avgPerUnit > overallAvg * 1.5 && Number(s.cost) > 1000) {
          alerts.push({
            type: 'spike',
            severity: avgPerUnit > overallAvg * 2 ? 'high' : 'medium',
            title: `High Freight Costs from ${s.supplier}`,
            description: `Average freight per unit ($${avgPerUnit.toFixed(2)}) is ${((avgPerUnit / overallAvg - 1) * 100).toFixed(0)}% above average`,
            supplier: s.supplier,
            value: avgPerUnit,
            baseline: overallAvg,
            percentChange: ((avgPerUnit / overallAvg - 1) * 100),
            affectedItems: Number(s.itemCount),
            recommendation: 'Renegotiate shipping terms or consider alternative logistics providers',
          });
        }
      });

      res.json({
        totalFreightCost: totalFreight,
        freightAsPercentOfCost: totalCost > 0 ? (totalFreight / totalCost) * 100 : 0,
        averageFreightPerUnit: itemCount > 0 ? totalFreight / itemCount : 0,
        freightBySupplier: freightBySupplier.map(s => ({
          supplier: s.supplier || 'Unknown',
          cost: Number(s.cost),
          itemCount: Number(s.itemCount),
          avgPerUnit: Number(s.itemCount) > 0 ? Number(s.cost) / Number(s.itemCount) : 0,
        })),
        freightByCategory: freightByCategory.map(c => ({
          category: c.category || 'Unknown',
          cost: Number(c.cost),
          itemCount: Number(c.itemCount),
          avgPerUnit: Number(c.itemCount) > 0 ? Number(c.cost) / Number(c.itemCount) : 0,
        })),
        freightConcentrationRisk: concentrationRisk,
        alerts: alerts.slice(0, 5),
      });
    } catch (error) {
      console.error("Error fetching freight analysis:", error);
      res.status(500).json({ error: "Failed to fetch freight analysis" });
    }
  });

  // Inventory Aging Analysis
  app.get("/api/insights/inventory-aging", async (_req: Request, res: Response) => {
    try {
      // Get aging metrics with date calculations
      const agingData = await db.select({
        category: inventory.category,
        purchDate: inventory.purchDate,
        invoiceDate: inventory.invoiceDate,
        status: inventory.status,
        cost: inventory.finalTotalCostUSD,
        itemId: inventory.itemId,
      }).from(inventory)
        .limit(10000);

      const now = new Date();
      let totalValue = 0;
      let totalDays = 0;
      let deadStockCount = 0;
      let deadStockValue = 0;
      let slowMovingCount = 0;
      let slowMovingValue = 0;
      
      const agingBuckets = {
        '0-30 days': { count: 0, value: 0 },
        '31-60 days': { count: 0, value: 0 },
        '61-90 days': { count: 0, value: 0 },
        '91-180 days': { count: 0, value: 0 },
        '180+ days': { count: 0, value: 0 },
      };

      const categoryAging: Record<string, { value: number; days: number; count: number }> = {};

      agingData.forEach(item => {
        const cost = Number(item.cost) || 0;
        totalValue += cost;
        
        const purchDate = item.purchDate ? new Date(item.purchDate) : null;
        const invoiceDate = item.invoiceDate ? new Date(item.invoiceDate) : null;
        
        if (purchDate && !isNaN(purchDate.getTime())) {
          const daysHeld = invoiceDate && !isNaN(invoiceDate.getTime()) 
            ? Math.floor((invoiceDate.getTime() - purchDate.getTime()) / (1000 * 60 * 60 * 24))
            : Math.floor((now.getTime() - purchDate.getTime()) / (1000 * 60 * 60 * 24));
          
          totalDays += Math.max(0, daysHeld);
          
          // Bucket by age
          if (daysHeld <= 30) {
            agingBuckets['0-30 days'].count++;
            agingBuckets['0-30 days'].value += cost;
          } else if (daysHeld <= 60) {
            agingBuckets['31-60 days'].count++;
            agingBuckets['31-60 days'].value += cost;
          } else if (daysHeld <= 90) {
            agingBuckets['61-90 days'].count++;
            agingBuckets['61-90 days'].value += cost;
          } else if (daysHeld <= 180) {
            agingBuckets['91-180 days'].count++;
            agingBuckets['91-180 days'].value += cost;
          } else {
            agingBuckets['180+ days'].count++;
            agingBuckets['180+ days'].value += cost;
          }

          // Dead stock: unsold for 180+ days
          if (!invoiceDate && daysHeld > 180) {
            deadStockCount++;
            deadStockValue += cost;
          }
          
          // Slow moving: unsold for 90-180 days
          if (!invoiceDate && daysHeld > 90 && daysHeld <= 180) {
            slowMovingCount++;
            slowMovingValue += cost;
          }

          // Category aging (case-insensitive grouping)
          const cat = (item.category || 'Unknown').toUpperCase();
          if (!categoryAging[cat]) {
            categoryAging[cat] = { value: 0, days: 0, count: 0 };
          }
          categoryAging[cat].value += cost;
          categoryAging[cat].days += Math.max(0, daysHeld);
          categoryAging[cat].count++;
        }
      });

      const avgDaysHeld = agingData.length > 0 ? totalDays / agingData.length : 0;

      // Generate alerts
      const alerts: any[] = [];
      
      if (deadStockValue > totalValue * 0.1) {
        alerts.push({
          type: 'dead_stock',
          severity: 'high',
          title: 'High Dead Stock Value',
          description: `$${deadStockValue.toLocaleString()} in inventory unsold for 180+ days`,
          value: deadStockValue,
          recommendation: 'Consider liquidation, bundle deals, or write-off for tax purposes',
        });
      }

      if (slowMovingValue > totalValue * 0.15) {
        alerts.push({
          type: 'slow_moving',
          severity: 'medium',
          title: 'Slow-Moving Inventory Alert',
          description: `$${slowMovingValue.toLocaleString()} in inventory unsold for 90-180 days`,
          value: slowMovingValue,
          recommendation: 'Apply promotional pricing or accelerate sales efforts',
        });
      }

      res.json({
        totalInventoryValue: totalValue,
        averageDaysHeld: Math.round(avgDaysHeld),
        agingBuckets: Object.entries(agingBuckets).map(([range, data]) => ({
          range,
          count: data.count,
          value: data.value,
          percentOfTotal: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        })),
        deadStockValue,
        deadStockCount,
        slowMovingValue,
        slowMovingCount,
        capitalLockupByCategory: Object.entries(categoryAging)
          .map(([category, data]) => ({
            category,
            value: data.value,
            avgDays: data.count > 0 ? Math.round(data.days / data.count) : 0,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
        alerts,
      });
    } catch (error) {
      console.error("Error fetching inventory aging:", error);
      res.status(500).json({ error: "Failed to fetch inventory aging" });
    }
  });

  // Returns/RMA Analysis
  app.get("/api/insights/returns", async (_req: Request, res: Response) => {
    try {
      // Get returns data
      const returnsData = await db.select().from(returns).limit(5000);
      const totalSold = await db.select({ count: count() }).from(inventory)
        .where(isNotNull(inventory.salesId));
      
      const totalReturns = returnsData.length;
      const totalSoldCount = Number(totalSold[0]?.count) || 0;
      const returnRate = totalSoldCount > 0 ? (totalReturns / totalSoldCount) * 100 : 0;

      // Returns by reason
      const reasonCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      const customerReturns: Record<string, number> = {};
      let earlyFailures = 0;
      const serialCounts: Record<string, number> = {};
      let returnsLast30Days = 0;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      returnsData.forEach(r => {
        // Count by reason
        const reason = r.reasonForReturn || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

        // Count by status
        const status = r.rmaStatus || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        // Count by customer
        const customer = r.finalCustomer || r.caseCustomer || 'Unknown';
        customerReturns[customer] = (customerReturns[customer] || 0) + 1;

        // Check for early failures (within 30 days)
        if (r.createdOn) {
          const createdDate = new Date(r.createdOn);
          if (!isNaN(createdDate.getTime()) && createdDate >= thirtyDaysAgo) {
            returnsLast30Days++;
          }
        }

        // Track repeat failures by serial
        if (r.serialId) {
          serialCounts[r.serialId] = (serialCounts[r.serialId] || 0) + 1;
        }
      });

      const repeatFailures = Object.values(serialCounts).filter(c => c > 1).length;

      // Generate alerts
      const alerts: any[] = [];

      if (returnRate > 5) {
        alerts.push({
          type: 'early_failure',
          severity: returnRate > 10 ? 'high' : 'medium',
          title: 'Elevated Return Rate',
          description: `Return rate of ${returnRate.toFixed(1)}% exceeds target threshold`,
          value: returnRate,
          recommendation: 'Investigate root causes and implement quality improvements',
        });
      }

      if (repeatFailures > 10) {
        alerts.push({
          type: 'repeat_failure',
          severity: 'high',
          title: 'Multiple Repeat Failures Detected',
          description: `${repeatFailures} items have been returned multiple times`,
          affectedItems: repeatFailures,
          recommendation: 'Review quality control processes for repeat failure items',
        });
      }

      res.json({
        totalReturns,
        returnRate,
        returnsLast30Days,
        returnsByReason: Object.entries(reasonCounts)
          .map(([reason, count]) => ({
            reason,
            count,
            percent: totalReturns > 0 ? (count / totalReturns) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        returnsByStatus: Object.entries(statusCounts)
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
        topReturnCustomers: Object.entries(customerReturns)
          .map(([customer, count]) => ({
            customer,
            count,
            rate: 0, // Would need customer order data to calculate
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        earlyFailureCount: returnsLast30Days,
        repeatFailures,
        alerts,
      });
    } catch (error) {
      console.error("Error fetching returns analysis:", error);
      res.status(500).json({ error: "Failed to fetch returns analysis" });
    }
  });

  // Margin Analysis - comprehensive profitability insights
  app.get("/api/insights/margins", async (_req: Request, res: Response) => {
    try {
      // Overall margin
      const overallData = await db.select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        totalCost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        itemCount: count(),
      }).from(inventory);

      const totalRevenue = Number(overallData[0]?.totalRevenue) || 0;
      const totalCost = Number(overallData[0]?.totalCost) || 0;
      const overallProfit = totalRevenue - totalCost;
      const overallMargin = totalRevenue > 0 ? (overallProfit / totalRevenue) * 100 : 0;

      // Margin by category (case-insensitive grouping)
      const marginByCategory = await db.select({
        category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.category), ne(inventory.category, "")))
        .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`));

      // Margin by make (case-insensitive grouping)
      const marginByMake = await db.select({
        make: sql<string>`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.make), ne(inventory.make, "")))
        .groupBy(sql`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(15);

      // Negative margin items
      const negativeMarginData = await db.select({
        count: sql<number>`COUNT(*)`,
        value: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric) - CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(sql`CAST(${inventory.finalSalesPriceUSD} as numeric) < CAST(${inventory.finalTotalCostUSD} as numeric)`);

      const negativeMarginItems = Number(negativeMarginData[0]?.count) || 0;
      const negativeMarginValue = Math.abs(Number(negativeMarginData[0]?.value) || 0);

      // Margin trend by month
      const marginTrend = await db.select({
        month: sql<string>`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoiceDate), ne(inventory.invoiceDate, "")))
        .groupBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`)
        .limit(12);

      // Generate alerts
      const alerts: any[] = [];

      if (negativeMarginItems > 100) {
        alerts.push({
          type: 'negative_margin',
          severity: 'high',
          title: 'Significant Negative Margin Items',
          description: `${negativeMarginItems} items sold at a loss totaling $${negativeMarginValue.toLocaleString()}`,
          currentMargin: -100,
          impactValue: negativeMarginValue,
          recommendation: 'Review pricing strategy and cost controls for loss-making products',
        });
      }

      // Check for low margin categories
      marginByCategory.forEach(cat => {
        const revenue = Number(cat.revenue);
        const cost = Number(cat.cost);
        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        
        if (margin < 5 && revenue > 10000) {
          alerts.push({
            type: 'margin_erosion',
            severity: margin < 0 ? 'high' : 'medium',
            title: `Low Margin Category: ${cat.category}`,
            description: `${cat.category} has only ${margin.toFixed(1)}% margin on $${revenue.toLocaleString()} revenue`,
            category: cat.category,
            currentMargin: margin,
            impactValue: profit,
            recommendation: 'Analyze cost structure and consider price adjustments',
          });
        }
      });

      res.json({
        overallMargin,
        marginByCategory: marginByCategory.map(c => {
          const revenue = Number(c.revenue);
          const cost = Number(c.cost);
          const profit = revenue - cost;
          return {
            category: c.category || 'Unknown',
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            revenue,
            profit,
          };
        }).slice(0, 15),
        marginByMake: marginByMake.map(m => {
          const revenue = Number(m.revenue);
          const cost = Number(m.cost);
          const profit = revenue - cost;
          return {
            make: m.make || 'Unknown',
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            revenue,
            profit,
          };
        }),
        negativeMarginItems,
        negativeMarginValue,
        marginTrend: marginTrend.map(t => {
          const revenue = Number(t.revenue);
          const cost = Number(t.cost);
          return {
            period: t.month || 'Unknown',
            margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
          };
        }),
        alerts: alerts.slice(0, 5),
      });
    } catch (error) {
      console.error("Error fetching margin analysis:", error);
      res.status(500).json({ error: "Failed to fetch margin analysis" });
    }
  });

  // Orders Analysis - comprehensive order insights
  app.get("/api/insights/orders", async (_req: Request, res: Response) => {
    try {
      // Overall order metrics
      const orderMetrics = await db.select({
        totalOrders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        totalCost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        itemCount: count(),
      }).from(inventory)
        .where(and(isNotNull(inventory.salesId), ne(inventory.salesId, "")));

      const totalOrders = Number(orderMetrics[0]?.totalOrders) || 0;
      const totalRevenue = Number(orderMetrics[0]?.totalRevenue) || 0;
      const totalCost = Number(orderMetrics[0]?.totalCost) || 0;
      const totalItems = Number(orderMetrics[0]?.itemCount) || 0;

      // Orders by month
      const ordersByMonth = await db.select({
        month: sql<string>`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`,
        orders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoiceDate), ne(inventory.invoiceDate, "")))
        .groupBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`)
        .limit(12);

      // Orders by customer (case-insensitive grouping)
      const ordersByCustomer = await db.select({
        customer: sql<string>`UPPER(${inventory.invoicingName})`,
        orders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(15);

      // Orders by status (case-insensitive grouping)
      const ordersByStatus = await db.select({
        status: sql<string>`UPPER(COALESCE(${inventory.status}, 'UNKNOWN'))`,
        count: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.status}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COUNT(DISTINCT ${inventory.salesId})`));

      // Top orders by value
      const topOrders = await db.select({
        salesId: inventory.salesId,
        customer: inventory.invoicingName,
        value: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        items: count(),
        date: sql<string>`MAX(${inventory.invoiceDate})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.salesId), ne(inventory.salesId, "")))
        .groupBy(inventory.salesId, inventory.invoicingName)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(10);

      res.json({
        totalOrders,
        totalRevenue,
        totalProfit: totalRevenue - totalCost,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        itemsPerOrder: totalOrders > 0 ? totalItems / totalOrders : 0,
        ordersByMonth: ordersByMonth.map(m => ({
          month: m.month || 'Unknown',
          orders: Number(m.orders),
          revenue: Number(m.revenue),
          profit: Number(m.revenue) - Number(m.cost),
        })),
        ordersByCustomer: ordersByCustomer.map(c => {
          const revenue = Number(c.revenue);
          const orders = Number(c.orders);
          return {
            customer: c.customer || 'Unknown',
            orders,
            revenue,
            profit: revenue - Number(c.cost),
            avgValue: orders > 0 ? revenue / orders : 0,
          };
        }),
        ordersByStatus: ordersByStatus.map(s => ({
          status: s.status || 'Unknown',
          count: Number(s.count),
          revenue: Number(s.revenue),
        })),
        topOrdersByValue: topOrders.map(o => ({
          salesId: o.salesId || 'Unknown',
          customer: o.customer || 'Unknown',
          value: Number(o.value),
          items: Number(o.items),
          date: o.date || '',
        })),
      });
    } catch (error) {
      console.error("Error fetching orders analysis:", error);
      res.status(500).json({ error: "Failed to fetch orders analysis" });
    }
  });

  // Customer Analysis - comprehensive customer insights
  app.get("/api/insights/customers", async (_req: Request, res: Response) => {
    try {
      // Overall customer metrics
      const customerMetrics = await db.select({
        totalCustomers: sql<number>`COUNT(DISTINCT ${inventory.invoicingName})`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")));

      const totalCustomers = Number(customerMetrics[0]?.totalCustomers) || 0;
      const totalRevenue = Number(customerMetrics[0]?.totalRevenue) || 0;

      // Top customers by revenue (case-insensitive grouping)
      const topByRevenue = await db.select({
        customer: sql<string>`UPPER(${inventory.invoicingName})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(15);

      // Top customers by profit (case-insensitive grouping)
      const topByProfit = await db.select({
        customer: sql<string>`UPPER(${inventory.invoicingName})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0) - COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`))
        .limit(15);

      // Top customers by volume (case-insensitive grouping)
      const topByVolume = await db.select({
        customer: sql<string>`UPPER(${inventory.invoicingName})`,
        units: count(),
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
        .orderBy(desc(count()))
        .limit(15);

      // Customer concentration (top 5 % of revenue)
      const top5Revenue = topByRevenue.slice(0, 5).reduce((sum, c) => sum + Number(c.revenue), 0);
      const concentration = totalRevenue > 0 ? (top5Revenue / totalRevenue) * 100 : 0;

      res.json({
        totalCustomers,
        totalRevenue,
        averageRevenuePerCustomer: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
        topByRevenue: topByRevenue.map(c => {
          const revenue = Number(c.revenue);
          const cost = Number(c.cost);
          const profit = revenue - cost;
          return {
            customer: c.customer || 'Unknown',
            revenue,
            profit,
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            orders: Number(c.orders),
          };
        }),
        topByProfit: topByProfit.map(c => {
          const revenue = Number(c.revenue);
          const cost = Number(c.cost);
          const profit = revenue - cost;
          return {
            customer: c.customer || 'Unknown',
            revenue,
            profit,
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            orders: Number(c.orders),
          };
        }),
        topByVolume: topByVolume.map(c => ({
          customer: c.customer || 'Unknown',
          units: Number(c.units),
          revenue: Number(c.revenue),
          orders: Number(c.orders),
        })),
        customerConcentration: concentration,
        newCustomersLast90Days: 0, // Would need first order date tracking
        atRiskCustomers: [], // Would need last order tracking
      });
    } catch (error) {
      console.error("Error fetching customer analysis:", error);
      res.status(500).json({ error: "Failed to fetch customer analysis" });
    }
  });

  // Product Analysis - comprehensive product insights
  app.get("/api/insights/products", async (_req: Request, res: Response) => {
    try {
      // Overall product metrics
      const productMetrics = await db.select({
        totalProducts: sql<number>`COUNT(DISTINCT CONCAT(${inventory.make}, '-', ${inventory.modelNum}))`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
      }).from(inventory);

      const totalProducts = Number(productMetrics[0]?.totalProducts) || 0;
      const totalRevenue = Number(productMetrics[0]?.totalRevenue) || 0;

      // Top products by revenue (case-insensitive grouping)
      const topByRevenue = await db.select({
        make: sql<string>`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`,
        model: sql<string>`UPPER(COALESCE(${inventory.modelNum}, ''))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`, sql`UPPER(COALESCE(${inventory.modelNum}, ''))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(15);

      // Top products by profit (case-insensitive grouping)
      const topByProfit = await db.select({
        make: sql<string>`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`,
        model: sql<string>`UPPER(COALESCE(${inventory.modelNum}, ''))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`, sql`UPPER(COALESCE(${inventory.modelNum}, ''))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0) - COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`))
        .limit(15);

      // Top products by volume (case-insensitive grouping)
      const topByVolume = await db.select({
        make: sql<string>`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`,
        model: sql<string>`UPPER(COALESCE(${inventory.modelNum}, ''))`,
        units: count(),
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`, sql`UPPER(COALESCE(${inventory.modelNum}, ''))`)
        .orderBy(desc(count()))
        .limit(15);

      // Products by category (case-insensitive grouping)
      const productsByCategory = await db.select({
        category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
        products: sql<number>`COUNT(DISTINCT CONCAT(UPPER(COALESCE(${inventory.make}, '')), '-', UPPER(COALESCE(${inventory.modelNum}, ''))))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`));

      res.json({
        totalProducts,
        totalRevenue,
        topByRevenue: topByRevenue.map(p => {
          const revenue = Number(p.revenue);
          const cost = Number(p.cost);
          const profit = revenue - cost;
          return {
            product: `${p.make || ''} ${p.model || ''}`.trim() || 'Unknown',
            make: p.make || 'Unknown',
            revenue,
            profit,
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            units: Number(p.units),
          };
        }),
        topByProfit: topByProfit.map(p => {
          const revenue = Number(p.revenue);
          const cost = Number(p.cost);
          const profit = revenue - cost;
          return {
            product: `${p.make || ''} ${p.model || ''}`.trim() || 'Unknown',
            make: p.make || 'Unknown',
            revenue,
            profit,
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            units: Number(p.units),
          };
        }),
        topByVolume: topByVolume.map(p => ({
          product: `${p.make || ''} ${p.model || ''}`.trim() || 'Unknown',
          make: p.make || 'Unknown',
          units: Number(p.units),
          revenue: Number(p.revenue),
        })),
        productsByCategory: productsByCategory.map(c => ({
          category: c.category || 'Unknown',
          products: Number(c.products),
          revenue: Number(c.revenue),
          units: Number(c.units),
        })),
        slowMovers: [], // Would need inventory age tracking
      });
    } catch (error) {
      console.error("Error fetching product analysis:", error);
      res.status(500).json({ error: "Failed to fetch product analysis" });
    }
  });

  // Executive Summary - all critical insights in one call
  app.get("/api/insights/executive-summary", async (_req: Request, res: Response) => {
    try {
      // Get KPIs
      const kpiResult = await db.select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        totalCost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        unitsSold: count(),
        totalOrders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory);

      const totalRevenue = Number(kpiResult[0]?.totalRevenue) || 0;
      const totalCost = Number(kpiResult[0]?.totalCost) || 0;
      const totalProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const unitsSold = Number(kpiResult[0]?.unitsSold) || 0;
      const totalOrders = Number(kpiResult[0]?.totalOrders) || 0;

      // Best/worst performing categories (case-insensitive grouping)
      const categoryPerformance = await db.select({
        category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.category), ne(inventory.category, "")))
        .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0) - COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`));

      // Top customer (case-insensitive grouping)
      const topCustomer = await db.select({
        customer: sql<string>`UPPER(${inventory.invoicingName})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(1);

      // Returns count for alerts
      const returnsCount = await db.select({ count: count() }).from(returns);
      const returnRate = unitsSold > 0 ? (Number(returnsCount[0]?.count) / unitsSold) * 100 : 0;

      // Generate critical alerts
      const criticalAlerts: any[] = [];

      if (profitMargin < 10) {
        criticalAlerts.push({
          type: 'margin_erosion',
          severity: profitMargin < 5 ? 'high' : 'medium',
          title: 'Low Overall Profit Margin',
          description: `Overall margin at ${profitMargin.toFixed(1)}% requires attention`,
          currentMargin: profitMargin,
          impactValue: totalProfit,
          recommendation: 'Review pricing strategy and cost structure across all categories',
        });
      }

      if (returnRate > 5) {
        criticalAlerts.push({
          type: 'early_failure',
          severity: returnRate > 10 ? 'high' : 'medium',
          title: 'Elevated Return Rate',
          description: `Return rate at ${returnRate.toFixed(1)}% exceeds acceptable threshold`,
          value: returnRate,
          recommendation: 'Investigate quality issues and customer feedback patterns',
        });
      }

      res.json({
        kpis: {
          totalRevenue,
          totalCost,
          totalProfit,
          profitMargin,
          unitsSold,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          totalOrders,
        },
        criticalAlerts,
        recentTrends: {
          revenueChange: 0, // Would need historical data comparison
          profitChange: 0,
          marginChange: 0,
          returnRateChange: 0,
          period: 'vs. previous period',
        },
        quickInsights: {
          bestPerformingCategory: categoryPerformance[0]?.category || 'N/A',
          worstPerformingCategory: categoryPerformance[categoryPerformance.length - 1]?.category || 'N/A',
          topCustomer: topCustomer[0]?.customer || 'N/A',
          highestRiskSupplier: 'N/A', // Would need supplier quality tracking
        },
      });
    } catch (error) {
      console.error("Error fetching executive summary:", error);
      res.status(500).json({ error: "Failed to fetch executive summary" });
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
                sanitizeNumeric(item.PurchPriceUSD),
                item.PurchDate || null,
                item.VendComments || null,
                item.KeyLang || null,
                item.OsSticker || null,
                item.DisplaySize || null,
                sanitizeNumeric(item.LCDCostUSD),
                item.StorageSerialNum || null,
                item.VendName || null,
                item.Category || null,
                item.MadeIn || null,
                item.GradeCondition || null,
                sanitizeNumeric(item.PartsCostUSD),
                item.FingerprintStr || null,
                sanitizeNumeric(item.MiscCostUSD),
                item.ProcessorGen || null,
                item.ManufacturingDate || null,
                item.PurchaseCategory || null,
                item.KeyLayout || null,
                item.PONumber || null,
                item.Make || null,
                item.Processor || null,
                sanitizeNumeric(item.PackagingCostUSD),
                item.ReceivedDate || null,
                sanitizeNumeric(item.ITADTreesCostUSD),
                item.StorageType || null,
                item.SoldAsHDD || null,
                sanitizeNumeric(item.StandardisationCostUSD),
                item.Comments || null,
                sanitizeNumeric(item.PurchPriceRevisedUSD),
                item.Status || null,
                sanitizeNumeric(item.ConsumableCostUSD),
                item.Chassis || null,
                item.JournalNum || null,
                sanitizeNumeric(item.BatteryCostUSD),
                item.Ram || null,
                item.SoldAsRAM || null,
                sanitizeNumeric(item.FreightChargesUSD),
                item.HDD || null,
                sanitizeNumeric(item.COACostUSD),
                item.ManufacturerSerialNum || null,
                item.SupplierPalletNum || null,
                sanitizeNumeric(item.ResourceCostUSD),
                sanitizeNumeric(item.CustomsDutyUSD),
                item.Resolution || null,
                item.ModelNum || null,
                item.InvoiceAccount || null,
                item.TotalCostCurUSD || null,
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
                sanitizeNumeric(item.FinalSalesPriceUSD),
                sanitizeNumeric(item.FinalTotalCostUSD),
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

  // ============================================
  // AI INSIGHTS - OpenAI-powered recommendations
  // ============================================

  app.post("/api/ai/insights", requireAuth, async (req: Request, res: Response) => {
    try {
      const { context, data } = req.body as AIInsightRequest;

      if (!openai) {
        // Fallback to rule-based insights if no OpenAI key
        const fallbackInsights = generateRuleBasedInsights(context, data);
        return res.json(fallbackInsights);
      }

      const systemPrompt = `You are an expert business analyst providing executive insights for an inventory management dashboard. 
Analyze the provided data and return actionable insights in JSON format with the following structure:
{
  "summary": "A concise 2-3 sentence executive summary",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "risks": ["Risk 1", "Risk 2"],
  "opportunities": ["Opportunity 1", "Opportunity 2"]
}

Focus on:
- Revenue and profit optimization
- Cost reduction opportunities
- Inventory efficiency
- Customer relationship insights
- Supplier performance
- Market trends and patterns

Be specific with numbers and percentages when available. Prioritize actionable recommendations.`;

      const userPrompt = `Analyze this ${context} data and provide executive insights:\n\n${JSON.stringify(data, null, 2)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      const insights = JSON.parse(responseContent);
      
      res.json({
        ...insights,
        generatedAt: new Date().toISOString(),
      } as AIInsightResponse);
    } catch (error) {
      console.error("Error generating AI insights:", error);
      // Fallback to rule-based insights on error
      const fallbackInsights = generateRuleBasedInsights(req.body.context, req.body.data);
      res.json(fallbackInsights);
    }
  });

  // Helper function for rule-based insights when OpenAI is not available
  function generateRuleBasedInsights(context: string, data: Record<string, any>): AIInsightResponse {
    const insights: AIInsightResponse = {
      summary: "",
      keyFindings: [],
      recommendations: [],
      risks: [],
      opportunities: [],
      generatedAt: new Date().toISOString(),
    };

    switch (context) {
      case 'executive_summary':
        const kpis = data.kpis || {};
        insights.summary = `Total revenue is $${(kpis.totalRevenue || 0).toLocaleString()} with a ${(kpis.profitMargin || 0).toFixed(1)}% profit margin across ${kpis.unitsSold || 0} units sold.`;
        if (kpis.profitMargin < 15) {
          insights.keyFindings.push(`Profit margin of ${kpis.profitMargin?.toFixed(1)}% is below the target threshold of 15%`);
          insights.recommendations.push("Review pricing strategy and negotiate better supplier terms to improve margins");
        }
        if (kpis.averageOrderValue > 0) {
          insights.keyFindings.push(`Average order value is $${kpis.averageOrderValue?.toFixed(2)}`);
        }
        break;

      case 'freight':
        if (data.freightAsPercentOfCost > 10) {
          insights.keyFindings.push(`Freight costs represent ${data.freightAsPercentOfCost?.toFixed(1)}% of total costs`);
          insights.recommendations.push("Consolidate shipments and negotiate volume discounts with carriers");
        }
        if (data.freightConcentrationRisk > 50) {
          insights.risks.push(`High supplier concentration: ${data.freightConcentrationRisk?.toFixed(0)}% of freight from top 3 suppliers`);
        }
        break;

      case 'inventory':
        if (data.deadStockValue > 0) {
          insights.risks.push(`Dead stock valued at $${data.deadStockValue?.toLocaleString()} requires attention`);
          insights.recommendations.push("Consider liquidation strategies or promotional campaigns for aging inventory");
        }
        if (data.averageDaysHeld > 90) {
          insights.keyFindings.push(`Average inventory holding period of ${data.averageDaysHeld} days exceeds 90-day target`);
        }
        break;

      case 'margins':
        if (data.negativeMarginItems > 0) {
          insights.risks.push(`${data.negativeMarginItems} items sold at negative margin totaling $${data.negativeMarginValue?.toLocaleString()} in losses`);
          insights.recommendations.push("Review pricing for negative margin products and consider discontinuation");
        }
        break;

      case 'customers':
        if (data.customerConcentration > 40) {
          insights.risks.push(`Top 5 customers account for ${data.customerConcentration?.toFixed(0)}% of revenue - high concentration risk`);
          insights.recommendations.push("Diversify customer base through targeted marketing and new customer acquisition");
        }
        break;

      default:
        insights.summary = "Analysis complete. Review the data for detailed insights.";
    }

    if (insights.keyFindings.length === 0) {
      insights.keyFindings.push("Data patterns are within expected ranges");
    }
    if (!insights.summary) {
      insights.summary = `${context.charAt(0).toUpperCase() + context.slice(1)} analysis indicates stable operations with opportunities for optimization.`;
    }
    if (insights.opportunities.length === 0) {
      insights.opportunities.push("Continue monitoring key metrics for emerging trends");
    }

    return insights;
  }

  // ============================================
  // SAVED COLLECTIONS - CRUD endpoints
  // ============================================

  // Get all saved collections for current user
  app.get("/api/collections", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const collections = await db.select()
        .from(savedCollections)
        .where(eq(savedCollections.userId, user.id))
        .orderBy(desc(savedCollections.createdAt));
      
      res.json(collections);
    } catch (error) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  // Get single collection
  app.get("/api/collections/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const collectionId = parseInt(req.params.id);
      
      const collection = await db.select()
        .from(savedCollections)
        .where(and(
          eq(savedCollections.id, collectionId),
          eq(savedCollections.userId, user.id)
        ))
        .limit(1);
      
      if (collection.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      res.json(collection[0]);
    } catch (error) {
      console.error("Error fetching collection:", error);
      res.status(500).json({ error: "Failed to fetch collection" });
    }
  });

  // Create new collection
  app.post("/api/collections", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { name, description, insightType, queryConfig, chartType } = req.body;

      if (!name || !insightType || !queryConfig) {
        return res.status(400).json({ error: "Name, insightType, and queryConfig are required" });
      }

      // Validate insightType
      const validInsightTypes = ['category', 'customer', 'vendor', 'product', 'monthly', 'status', 'make'];
      if (!validInsightTypes.includes(insightType)) {
        return res.status(400).json({ error: `Invalid insightType. Must be one of: ${validInsightTypes.join(', ')}` });
      }

      // Validate queryConfig structure
      let parsedConfig: DrillDownConfig;
      try {
        parsedConfig = typeof queryConfig === 'string' ? JSON.parse(queryConfig) : queryConfig;
        if (typeof parsedConfig !== 'object' || parsedConfig === null) {
          throw new Error("Invalid queryConfig format");
        }
      } catch (e) {
        return res.status(400).json({ error: "queryConfig must be a valid JSON object" });
      }

      const result = await db.insert(savedCollections)
        .values({
          userId: user.id,
          name,
          description: description || null,
          insightType,
          queryConfig: typeof queryConfig === 'string' ? queryConfig : JSON.stringify(queryConfig),
          chartType: chartType || null,
        })
        .returning();

      res.status(201).json(result[0]);
    } catch (error) {
      console.error("Error creating collection:", error);
      res.status(500).json({ error: "Failed to create collection" });
    }
  });

  // Update collection
  app.patch("/api/collections/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const collectionId = parseInt(req.params.id);
      const { name, description, queryConfig, chartType } = req.body;

      const updateData: Partial<typeof savedCollections.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (queryConfig !== undefined) {
        updateData.queryConfig = typeof queryConfig === 'string' ? queryConfig : JSON.stringify(queryConfig);
      }
      if (chartType !== undefined) updateData.chartType = chartType;

      const result = await db.update(savedCollections)
        .set(updateData)
        .where(and(
          eq(savedCollections.id, collectionId),
          eq(savedCollections.userId, user.id)
        ))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Error updating collection:", error);
      res.status(500).json({ error: "Failed to update collection" });
    }
  });

  // Delete collection
  app.delete("/api/collections/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const collectionId = parseInt(req.params.id);

      const result = await db.delete(savedCollections)
        .where(and(
          eq(savedCollections.id, collectionId),
          eq(savedCollections.userId, user.id)
        ))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Collection not found" });
      }

      res.json({ success: true, deleted: result[0] });
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  // ============================================
  // DRILL-DOWN - Dynamic data exploration
  // ============================================

  app.post("/api/explore/:insightType", requireAuth, async (req: Request, res: Response) => {
    try {
      const { insightType } = req.params;
      const config = req.body as DrillDownConfig;
      
      let result: any[] = [];
      const limit = config.limit || 50;

      switch (insightType) {
        case 'category':
          result = await db.select({
            category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
            revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
            cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0) - COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            units: count(),
          }).from(inventory)
            .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
            .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
            .limit(limit);
          break;

        case 'customer':
          result = await db.select({
            customer: sql<string>`UPPER(${inventory.invoicingName})`,
            revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
            cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0) - COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            units: count(),
            orders: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
          }).from(inventory)
            .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
            .groupBy(sql`UPPER(${inventory.invoicingName})`)
            .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
            .limit(limit);
          break;

        case 'vendor':
          result = await db.select({
            vendor: sql<string>`UPPER(COALESCE(${inventory.vendName}, 'UNKNOWN'))`,
            cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            freight: sql<number>`COALESCE(SUM(CAST(${inventory.freightChargesUSD} as numeric)), 0)`,
            units: count(),
          }).from(inventory)
            .groupBy(sql`UPPER(COALESCE(${inventory.vendName}, 'UNKNOWN'))`)
            .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`))
            .limit(limit);
          break;

        case 'product':
          result = await db.select({
            make: sql<string>`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`,
            model: inventory.modelNum,
            revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
            cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0) - COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            units: count(),
          }).from(inventory)
            .groupBy(sql`UPPER(COALESCE(${inventory.make}, 'UNKNOWN'))`, inventory.modelNum)
            .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
            .limit(limit);
          break;

        case 'monthly':
          result = await db.select({
            month: sql<string>`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`,
            revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
            cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0) - COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
            units: count(),
          }).from(inventory)
            .where(isNotNull(inventory.invoiceDate))
            .groupBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`)
            .orderBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`)
            .limit(limit);
          break;

        default:
          return res.status(400).json({ error: "Invalid insight type" });
      }

      res.json({
        insightType,
        config,
        data: result.map(row => ({
          ...row,
          revenue: Number(row.revenue) || 0,
          cost: Number(row.cost) || 0,
          profit: Number(row.profit) || 0,
          freight: Number(row.freight) || 0,
          units: Number(row.units) || 0,
          orders: Number(row.orders) || 0,
          margin: row.revenue > 0 ? ((Number(row.profit) / Number(row.revenue)) * 100) : 0,
        })),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error executing drill-down:", error);
      res.status(500).json({ error: "Failed to execute drill-down query" });
    }
  });

  return httpServer;
}
