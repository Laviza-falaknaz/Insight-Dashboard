import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { db, pool } from "./db";
import { inventory, dataUploads, returns, users, themePresets, savedCollections, entityConfigs, entityJoinKeys, type ThemeId } from "@shared/schema";
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
  DrillDownConfig,
  QueryBuilderConfig,
  QueryResult,
  QueryColumn,
  QueryAIInterpretation,
  ChartConfig
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
  
  // Admin: Get all entity configurations
  app.get("/api/admin/entities", requireAuth, async (_req: Request, res: Response) => {
    try {
      const configs = await db.select().from(entityConfigs);
      const joinKeys = await db.select().from(entityJoinKeys);
      res.json({ entities: configs, joinKeys });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entity configs" });
    }
  });
  
  // Admin: Update entity visibility
  app.put("/api/admin/entities/:entityId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { entityId } = req.params;
      const { isVisible, displayName, description, icon, color } = req.body;
      
      const updated = await db
        .update(entityConfigs)
        .set({ 
          isVisible: isVisible ? 'true' : 'false',
          displayName,
          description,
          icon,
          color
        })
        .where(eq(entityConfigs.entityId, entityId))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ error: "Entity not found" });
      }
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update entity" });
    }
  });
  
  // Admin: Create new entity config
  app.post("/api/admin/entities", requireAuth, async (req: Request, res: Response) => {
    try {
      const { entityId, displayName, description, isVisible, icon, color } = req.body;
      
      const created = await db
        .insert(entityConfigs)
        .values({ entityId, displayName, description, isVisible: isVisible ? 'true' : 'false', icon, color })
        .returning();
      
      res.json(created[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to create entity config" });
    }
  });
  
  // Admin: Get all join keys
  app.get("/api/admin/join-keys", requireAuth, async (_req: Request, res: Response) => {
    try {
      const joinKeys = await db.select().from(entityJoinKeys);
      res.json(joinKeys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch join keys" });
    }
  });
  
  // Admin: Create join key
  app.post("/api/admin/join-keys", requireAuth, async (req: Request, res: Response) => {
    try {
      const { sourceEntityId, targetEntityId, name, fieldPairs, bidirectional, isDefault, supportedJoinTypes, defaultJoinType } = req.body;
      
      // Validate fieldPairs
      if (!fieldPairs || !Array.isArray(fieldPairs) || fieldPairs.length === 0) {
        return res.status(400).json({ error: "At least one field pair is required" });
      }
      
      // If this is default, unset other defaults for this pair
      if (isDefault) {
        await db
          .update(entityJoinKeys)
          .set({ isDefault: 'false' })
          .where(
            and(
              eq(entityJoinKeys.sourceEntityId, sourceEntityId),
              eq(entityJoinKeys.targetEntityId, targetEntityId)
            )
          );
      }
      
      // Use first pair for legacy sourceField/targetField columns
      const firstPair = fieldPairs[0];
      
      const created = await db
        .insert(entityJoinKeys)
        .values({ 
          sourceEntityId, 
          targetEntityId, 
          name, 
          sourceField: firstPair.sourceField,
          targetField: firstPair.targetField,
          fieldPairs: fieldPairs,
          bidirectional: bidirectional || false,
          isDefault: isDefault ? 'true' : 'false',
          supportedJoinTypes: supportedJoinTypes || 'inner,left,right',
          defaultJoinType: defaultJoinType || 'left'
        })
        .returning();
      
      res.json(created[0]);
    } catch (error) {
      console.error("Failed to create join key:", error);
      res.status(500).json({ error: "Failed to create join key" });
    }
  });
  
  // Admin: Update join key
  app.put("/api/admin/join-keys/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, fieldPairs, bidirectional, isDefault, supportedJoinTypes, defaultJoinType } = req.body;
      
      // If setting as default, unset others
      if (isDefault) {
        const existing = await db.select().from(entityJoinKeys).where(eq(entityJoinKeys.id, parseInt(id)));
        if (existing.length > 0) {
          await db
            .update(entityJoinKeys)
            .set({ isDefault: 'false' })
            .where(
              and(
                eq(entityJoinKeys.sourceEntityId, existing[0].sourceEntityId),
                eq(entityJoinKeys.targetEntityId, existing[0].targetEntityId)
              )
            );
        }
      }
      
      const updateData: Record<string, unknown> = { 
        name, 
        isDefault: isDefault ? 'true' : 'false',
        supportedJoinTypes
      };
      
      // Handle defaultJoinType
      if (defaultJoinType) {
        updateData.defaultJoinType = defaultJoinType;
      }
      
      // Handle fieldPairs if provided
      if (fieldPairs && Array.isArray(fieldPairs) && fieldPairs.length > 0) {
        updateData.fieldPairs = fieldPairs;
        updateData.sourceField = fieldPairs[0].sourceField;
        updateData.targetField = fieldPairs[0].targetField;
      }
      
      // Handle bidirectional if provided
      if (bidirectional !== undefined) {
        updateData.bidirectional = bidirectional;
      }
      
      const updated = await db
        .update(entityJoinKeys)
        .set(updateData)
        .where(eq(entityJoinKeys.id, parseInt(id)))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ error: "Join key not found" });
      }
      res.json(updated[0]);
    } catch (error) {
      console.error("Failed to update join key:", error);
      res.status(500).json({ error: "Failed to update join key" });
    }
  });
  
  // Admin: Delete join key
  app.delete("/api/admin/join-keys/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(entityJoinKeys).where(eq(entityJoinKeys.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete join key" });
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
  // Uses batch multi-row inserts with transaction wrapping for high throughput
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
      // PostgreSQL has ~65535 parameter limit. With 66 columns, max rows = 65535/66 ≈ 993
      // Use 500 to stay safely under the limit
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
      
      // Get a client from the pool for transaction
      const client = await pool.connect();
      
      try {
        // Start transaction for all batches
        await client.query('BEGIN');
        
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize).filter((item: Record<string, unknown>) => item.InventSerialId);
          if (batch.length === 0) continue;
          
          const allValues: unknown[] = [];
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
            
            for (const val of rowValues) {
              allValues.push(val);
            }
            const placeholders = rowValues.map(() => `$${paramIndex++}`);
            valuePlaceholders.push(`(${placeholders.join(', ')})`);
          }
          
          // Use WHERE clause to skip unchanged rows - only update if data actually changed
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
            WHERE inventory.status IS DISTINCT FROM EXCLUDED.status
               OR inventory.final_sales_price_usd IS DISTINCT FROM EXCLUDED.final_sales_price_usd
               OR inventory.final_total_cost_usd IS DISTINCT FROM EXCLUDED.final_total_cost_usd
               OR inventory.invoicing_name IS DISTINCT FROM EXCLUDED.invoicing_name
               OR inventory.invoice_date IS DISTINCT FROM EXCLUDED.invoice_date
          `;
          
          await client.query(query, allValues);
          totalProcessed += batch.length;
        }
        
        // Commit the transaction
        await client.query('COMMIT');
      } catch (txError) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        // Release the client back to the pool
        client.release();
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
  // Uses batch multi-row inserts with transaction wrapping for high throughput
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
      const batchSize = 1000; // Increased batch size for better throughput
      const columns = [
        'final_customer', 'related_order_name', 'case_id', 'rma_number', 'reason_for_return',
        'created_on', 'warehouse_notes', 'final_reseller_name', 'expected_shipping_date', 'rma_line_item_guid',
        'rma_line_name', 'case_end_user', 'uae_warehouse_notes', 'notes_description', 'rma_guid',
        'related_serial_guid', 'modified_on', 'opportunity_number', 'item_testing_date', 'final_distributor_name',
        'case_customer', 'item_received_date', 'case_description', 'dispatch_date', 'replacement_serial_guid',
        'rma_status', 'type_of_unit', 'line_status', 'line_solution', 'uae_final_outcome',
        'rma_topic_label', 'uk_final_outcome', 'serial_id', 'area_id', 'item_id'
      ];
      
      // Get a client from the pool for transaction
      const client = await pool.connect();
      
      try {
        // Start transaction for all batches
        await client.query('BEGIN');
        
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
          
          // Use WHERE clause to skip unchanged rows - only update if data actually changed
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
            WHERE returns.rma_status IS DISTINCT FROM EXCLUDED.rma_status
               OR returns.line_status IS DISTINCT FROM EXCLUDED.line_status
               OR returns.line_solution IS DISTINCT FROM EXCLUDED.line_solution
          `;
          
          await client.query(query, values);
          totalProcessed += batch.length;
        }
        
        // Commit the transaction
        await client.query('COMMIT');
      } catch (txError) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        // Release the client back to the pool
        client.release();
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
  app.get("/api/insights/products", async (req: Request, res: Response) => {
    try {
      // Parse filter parameters
      const { startDate, endDate, category, make, customer, vendor, gradeCondition } = req.query;
      
      // Build WHERE clause conditions
      const whereConditions: string[] = [];
      if (startDate) whereConditions.push(`invoice_date >= '${startDate}'`);
      if (endDate) whereConditions.push(`invoice_date <= '${endDate}'`);
      if (category) {
        const cats = (category as string).split(',').map(c => `'${c.replace(/'/g, "''")}'`).join(',');
        whereConditions.push(`UPPER(category) IN (${cats.toUpperCase()})`);
      }
      if (make) {
        const makes = (make as string).split(',').map(m => `'${m.replace(/'/g, "''")}'`).join(',');
        whereConditions.push(`UPPER(make) IN (${makes.toUpperCase()})`);
      }
      if (customer) {
        const customers = (customer as string).split(',').map(c => `'${c.replace(/'/g, "''")}'`).join(',');
        whereConditions.push(`UPPER(invoicing_name) IN (${customers.toUpperCase()})`);
      }
      if (vendor) {
        const vendors = (vendor as string).split(',').map(v => `'${v.replace(/'/g, "''")}'`).join(',');
        whereConditions.push(`UPPER(vendor_name) IN (${vendors.toUpperCase()})`);
      }
      if (gradeCondition) {
        const grades = (gradeCondition as string).split(',').map(g => `'${g.replace(/'/g, "''")}'`).join(',');
        whereConditions.push(`UPPER(grade_condition) IN (${grades.toUpperCase()})`);
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

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

      // Build filter for raw SQL (different column naming)
      const sqlFilterConditions: string[] = [];
      if (startDate) sqlFilterConditions.push(`invoice_date >= '${startDate}'`);
      if (endDate) sqlFilterConditions.push(`invoice_date <= '${endDate}'`);
      if (category) {
        const cats = (category as string).split(',').map(c => `'${c.replace(/'/g, "''").toUpperCase()}'`).join(',');
        sqlFilterConditions.push(`UPPER(category) IN (${cats})`);
      }
      if (make) {
        const makes = (make as string).split(',').map(m => `'${m.replace(/'/g, "''").toUpperCase()}'`).join(',');
        sqlFilterConditions.push(`UPPER(make) IN (${makes})`);
      }
      const sqlFilterBase = sqlFilterConditions.length > 0 ? ` AND ${sqlFilterConditions.join(' AND ')}` : '';

      // Return-prone products with return rates
      const returnProneProducts = await pool.query(`
        WITH product_sales AS (
          SELECT 
            CONCAT(UPPER(make), ' ', UPPER(model_num)) as product,
            COUNT(*) as units_sold,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost
          FROM inventory 
          WHERE trans_type = 'SalesOrder' ${sqlFilterBase}
          GROUP BY CONCAT(UPPER(make), ' ', UPPER(model_num))
          HAVING COUNT(*) >= 5
        ),
        product_returns AS (
          SELECT 
            CONCAT(UPPER(i.make), ' ', UPPER(i.model_num)) as product,
            COUNT(DISTINCT i.id) as return_count,
            COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as profit_lost
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE i.trans_type = 'SalesOrder' ${sqlFilterBase.replace(/invoice_date/g, 'i.invoice_date').replace(/category/g, 'i.category').replace(/make/g, 'i.make')}
          GROUP BY CONCAT(UPPER(i.make), ' ', UPPER(i.model_num))
        )
        SELECT 
          ps.product,
          ps.units_sold,
          ps.revenue,
          ps.revenue - ps.cost as profit,
          CASE WHEN ps.revenue > 0 THEN ((ps.revenue - ps.cost) / ps.revenue) * 100 ELSE 0 END as margin,
          COALESCE(pr.return_count, 0) as return_count,
          CASE WHEN ps.units_sold > 0 THEN (COALESCE(pr.return_count, 0)::float / ps.units_sold) * 100 ELSE 0 END as return_rate,
          COALESCE(pr.profit_lost, 0) as profit_lost
        FROM product_sales ps
        LEFT JOIN product_returns pr ON ps.product = pr.product
        WHERE COALESCE(pr.return_count, 0) > 0
        ORDER BY return_rate DESC, return_count DESC
        LIMIT 15
      `);

      // Products with cost breakdown
      const productCostBreakdown = await pool.query(`
        SELECT 
          CONCAT(UPPER(make), ' ', UPPER(model_num)) as product,
          COUNT(*) as units,
          COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
          COALESCE(SUM(CAST(purch_price_usd AS numeric)), 0) as purchase_cost,
          COALESCE(SUM(CAST(parts_cost_usd AS numeric)), 0) as parts_cost,
          COALESCE(SUM(CAST(freight_charges_usd AS numeric)), 0) as freight_cost,
          COALESCE(SUM(CAST(resource_cost_usd AS numeric)) + SUM(CAST(standardisation_cost_usd AS numeric)), 0) as labor_cost,
          COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as total_cost,
          CASE WHEN SUM(CAST(final_sales_price_usd AS numeric)) > 0 
            THEN ((SUM(CAST(final_sales_price_usd AS numeric)) - SUM(CAST(final_total_cost_usd AS numeric))) / 
                  SUM(CAST(final_sales_price_usd AS numeric))) * 100 
            ELSE 0 END as margin
        FROM inventory 
        WHERE trans_type = 'SalesOrder' ${sqlFilterBase}
        GROUP BY CONCAT(UPPER(make), ' ', UPPER(model_num))
        HAVING COUNT(*) >= 5
        ORDER BY revenue DESC
        LIMIT 20
      `);

      // Negative margin products (losing money)
      const negativeMarginProducts = await pool.query(`
        SELECT 
          CONCAT(UPPER(make), ' ', UPPER(model_num)) as product,
          COUNT(*) as units,
          COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
          COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost,
          COALESCE(SUM(CAST(final_sales_price_usd AS numeric)) - SUM(CAST(final_total_cost_usd AS numeric)), 0) as profit,
          CASE WHEN SUM(CAST(final_sales_price_usd AS numeric)) > 0 
            THEN ((SUM(CAST(final_sales_price_usd AS numeric)) - SUM(CAST(final_total_cost_usd AS numeric))) / 
                  SUM(CAST(final_sales_price_usd AS numeric))) * 100 
            ELSE 0 END as margin
        FROM inventory 
        WHERE trans_type = 'SalesOrder' ${sqlFilterBase}
        GROUP BY CONCAT(UPPER(make), ' ', UPPER(model_num))
        HAVING SUM(CAST(final_sales_price_usd AS numeric)) - SUM(CAST(final_total_cost_usd AS numeric)) < 0
        ORDER BY profit ASC
        LIMIT 15
      `);

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
        slowMovers: [],
        
        // Strategic product insights
        returnProneProducts: returnProneProducts.rows.map(p => ({
          product: p.product,
          unitsSold: parseInt(p.units_sold),
          revenue: parseFloat(p.revenue),
          profit: parseFloat(p.profit),
          margin: parseFloat(p.margin),
          returnCount: parseInt(p.return_count),
          returnRate: parseFloat(p.return_rate),
          profitLost: parseFloat(p.profit_lost),
        })),
        productCostBreakdown: productCostBreakdown.rows.map(p => ({
          product: p.product,
          units: parseInt(p.units),
          revenue: parseFloat(p.revenue),
          purchaseCost: parseFloat(p.purchase_cost),
          partsCost: parseFloat(p.parts_cost),
          freightCost: parseFloat(p.freight_cost),
          laborCost: parseFloat(p.labor_cost),
          totalCost: parseFloat(p.total_cost),
          margin: parseFloat(p.margin),
        })),
        negativeMarginProducts: negativeMarginProducts.rows.map(p => ({
          product: p.product,
          units: parseInt(p.units),
          revenue: parseFloat(p.revenue),
          cost: parseFloat(p.cost),
          profit: parseFloat(p.profit),
          margin: parseFloat(p.margin),
        })),
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
  // STRATEGIC EXECUTIVE INSIGHTS
  // Leverages inventory-returns relationship:
  // inventory (invent_serial_id, data_area_id, item_id, crm_ref) 
  // joins to returns (serial_id, area_id, item_id, sales_order_number)
  // Only for TransType='SalesOrder'
  // ============================================

  // Strategic Dashboard - Comprehensive executive view with return impact
  app.get("/api/strategic/dashboard", async (req: Request, res: Response) => {
    try {
      // Parse filter parameters
      const { startDate, endDate, category, make, customer, vendor, gradeCondition } = req.query;
      
      // Build WHERE conditions for filters
      const conditions: string[] = ["trans_type = 'SalesOrder'"];
      const params: any[] = [];
      let paramIdx = 1;
      
      if (startDate) {
        conditions.push(`invoice_date >= $${paramIdx}`);
        params.push(startDate);
        paramIdx++;
      }
      if (endDate) {
        conditions.push(`invoice_date <= $${paramIdx}`);
        params.push(endDate);
        paramIdx++;
      }
      if (category) {
        const cats = String(category).split(',');
        conditions.push(`UPPER(category) = ANY($${paramIdx}::text[])`);
        params.push(cats.map(c => c.toUpperCase()));
        paramIdx++;
      }
      if (make) {
        const makes = String(make).split(',');
        conditions.push(`UPPER(make) = ANY($${paramIdx}::text[])`);
        params.push(makes.map(m => m.toUpperCase()));
        paramIdx++;
      }
      if (customer) {
        const customers = String(customer).split(',');
        conditions.push(`UPPER(invoicing_name) = ANY($${paramIdx}::text[])`);
        params.push(customers.map(c => c.toUpperCase()));
        paramIdx++;
      }
      if (vendor) {
        const vendors = String(vendor).split(',');
        conditions.push(`UPPER(vend_name) = ANY($${paramIdx}::text[])`);
        params.push(vendors.map(v => v.toUpperCase()));
        paramIdx++;
      }
      if (gradeCondition) {
        const grades = String(gradeCondition).split(',');
        conditions.push(`UPPER(grade_condition) = ANY($${paramIdx}::text[])`);
        params.push(grades.map(g => g.toUpperCase()));
        paramIdx++;
      }
      
      const whereClause = conditions.join(' AND ');
      
      // For aliased queries (i.column_name) - derive from base conditions with i. prefix
      const whereClauseAliased = whereClause
        .replace(/trans_type/g, 'i.trans_type')
        .replace(/invoice_date/g, 'i.invoice_date')
        .replace(/UPPER\(category\)/g, 'UPPER(i.category)')
        .replace(/UPPER\(make\)/g, 'UPPER(i.make)')
        .replace(/UPPER\(invoicing_name\)/g, 'UPPER(i.invoicing_name)')
        .replace(/UPPER\(vend_name\)/g, 'UPPER(i.vend_name)')
        .replace(/UPPER\(grade_condition\)/g, 'UPPER(i.grade_condition)');
      
      // Sales-only metrics (TransType='SalesOrder')
      const salesMetrics = await pool.query(`
        SELECT 
          COUNT(*) as units_sold,
          COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as total_revenue,
          COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as total_cost,
          COALESCE(SUM(CAST(purch_price_usd AS numeric)), 0) as purchase_cost,
          COALESCE(SUM(CAST(parts_cost_usd AS numeric)), 0) as parts_cost,
          COALESCE(SUM(CAST(freight_charges_usd AS numeric)), 0) as freight_cost,
          COALESCE(SUM(CAST(resource_cost_usd AS numeric)), 0) + 
            COALESCE(SUM(CAST(standardisation_cost_usd AS numeric)), 0) as labor_cost,
          COALESCE(SUM(CAST(packaging_cost_usd AS numeric)), 0) as packaging_cost,
          COALESCE(SUM(CAST(misc_cost_usd AS numeric)), 0) + 
            COALESCE(SUM(CAST(consumable_cost_usd AS numeric)), 0) + 
            COALESCE(SUM(CAST(battery_cost_usd AS numeric)), 0) + 
            COALESCE(SUM(CAST(lcd_cost_usd AS numeric)), 0) + 
            COALESCE(SUM(CAST(coa_cost_usd AS numeric)), 0) as other_costs,
          COUNT(DISTINCT invoicing_name) as unique_customers,
          COUNT(DISTINCT model_num) as unique_products
        FROM inventory 
        WHERE ${whereClause}
      `, params);

      const sales = salesMetrics.rows[0];
      const totalRevenue = parseFloat(sales.total_revenue) || 0;
      const totalCost = parseFloat(sales.total_cost) || 0;
      const unitsSold = parseInt(sales.units_sold) || 0;
      const grossProfit = totalRevenue - totalCost;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      // Join sales to returns to find units that were returned
      // Only TransType='SalesOrder' connects to returns
      const returnsImpact = await pool.query(`
        SELECT 
          COUNT(DISTINCT i.id) as units_with_returns,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric)), 0) as revenue_at_risk,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as profit_lost
        FROM inventory i
        INNER JOIN returns r ON 
          i.invent_serial_id = r.serial_id AND
          i.data_area_id = r.area_id AND
          i.item_id = r.item_id
        WHERE ${whereClauseAliased}
      `, params);

      const returnData = returnsImpact.rows[0];
      const unitsReturned = parseInt(returnData.units_with_returns) || 0;
      const revenueAtRisk = parseFloat(returnData.revenue_at_risk) || 0;
      const profitLost = parseFloat(returnData.profit_lost) || 0;
      const returnRate = unitsSold > 0 ? (unitsReturned / unitsSold) * 100 : 0;
      const netProfit = grossProfit - profitLost;
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Profitability waterfall
      const purchaseCost = parseFloat(sales.purchase_cost) || 0;
      const partsCost = parseFloat(sales.parts_cost) || 0;
      const freightCost = parseFloat(sales.freight_cost) || 0;
      const laborCost = parseFloat(sales.labor_cost) || 0;
      const packagingCost = parseFloat(sales.packaging_cost) || 0;
      const otherCosts = parseFloat(sales.other_costs) || 0;

      // Category performance with return rates
      const categoryPerf = await pool.query(`
        WITH sales_data AS (
          SELECT 
            UPPER(COALESCE(category, 'UNKNOWN')) as category,
            COUNT(*) as units,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost
          FROM inventory 
          WHERE ${whereClause}
          GROUP BY UPPER(COALESCE(category, 'UNKNOWN'))
        ),
        return_data AS (
          SELECT 
            UPPER(COALESCE(i.category, 'UNKNOWN')) as category,
            COUNT(DISTINCT i.id) as return_count
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE ${whereClauseAliased}
          GROUP BY UPPER(COALESCE(i.category, 'UNKNOWN'))
        )
        SELECT 
          s.category,
          s.units,
          s.revenue,
          s.cost,
          s.revenue - s.cost as profit,
          CASE WHEN s.revenue > 0 THEN ((s.revenue - s.cost) / s.revenue) * 100 ELSE 0 END as margin,
          COALESCE(r.return_count, 0) as return_count,
          CASE WHEN s.units > 0 THEN (COALESCE(r.return_count, 0)::float / s.units) * 100 ELSE 0 END as return_rate
        FROM sales_data s
        LEFT JOIN return_data r ON s.category = r.category
        ORDER BY s.revenue - s.cost DESC
        LIMIT 10
      `, params);

      const topCategory = categoryPerf.rows[0];
      const worstCategory = categoryPerf.rows[categoryPerf.rows.length - 1];

      // Top customer
      const topCustomerResult = await pool.query(`
        SELECT 
          UPPER(invoicing_name) as customer,
          COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
          CASE WHEN SUM(CAST(final_sales_price_usd AS numeric)) > 0 
            THEN ((SUM(CAST(final_sales_price_usd AS numeric)) - SUM(CAST(final_total_cost_usd AS numeric))) / 
                  SUM(CAST(final_sales_price_usd AS numeric))) * 100 
            ELSE 0 END as margin
        FROM inventory 
        WHERE ${whereClause} AND invoicing_name IS NOT NULL AND invoicing_name != ''
        GROUP BY UPPER(invoicing_name)
        ORDER BY revenue DESC
        LIMIT 1
      `, params);

      // Highest return rate product
      const highReturnProduct = await pool.query(`
        WITH product_sales AS (
          SELECT 
            CONCAT(make, ' ', model_num) as product,
            COUNT(*) as units,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric) - CAST(final_total_cost_usd AS numeric)), 0) as profit
          FROM inventory 
          WHERE ${whereClause}
          GROUP BY CONCAT(make, ' ', model_num)
          HAVING COUNT(*) >= 5
        ),
        product_returns AS (
          SELECT 
            CONCAT(i.make, ' ', i.model_num) as product,
            COUNT(DISTINCT i.id) as return_count,
            COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as lost_profit
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE ${whereClauseAliased}
          GROUP BY CONCAT(i.make, ' ', i.model_num)
        )
        SELECT 
          ps.product,
          CASE WHEN ps.units > 0 THEN (COALESCE(pr.return_count, 0)::float / ps.units) * 100 ELSE 0 END as return_rate,
          COALESCE(pr.lost_profit, 0) as lost_profit
        FROM product_sales ps
        LEFT JOIN product_returns pr ON ps.product = pr.product
        WHERE COALESCE(pr.return_count, 0) > 0
        ORDER BY return_rate DESC
        LIMIT 1
      `, params);

      // Regional performance (UAE vs UK)
      const regionalPerf = await pool.query(`
        WITH region_sales AS (
          SELECT 
            UPPER(data_area_id) as region,
            COUNT(*) as units,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost
          FROM inventory 
          WHERE ${whereClause}
          GROUP BY UPPER(data_area_id)
        ),
        region_returns AS (
          SELECT 
            UPPER(i.data_area_id) as region,
            COUNT(DISTINCT i.id) as return_count
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE ${whereClauseAliased}
          GROUP BY UPPER(i.data_area_id)
        )
        SELECT 
          s.region,
          s.units,
          s.revenue,
          s.cost,
          s.revenue - s.cost as profit,
          CASE WHEN s.units > 0 THEN (COALESCE(r.return_count, 0)::float / s.units) * 100 ELSE 0 END as return_rate
        FROM region_sales s
        LEFT JOIN region_returns r ON s.region = r.region
        ORDER BY s.revenue DESC
      `, params);

      // Monthly trends
      const monthlyTrends = await pool.query(`
        WITH monthly_sales AS (
          SELECT 
            TO_CHAR(TO_DATE(invoice_date, 'YYYY-MM-DD'), 'YYYY-MM') as month,
            COUNT(*) as units,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost
          FROM inventory 
          WHERE ${whereClause}
            AND invoice_date IS NOT NULL 
            AND invoice_date != ''
            AND invoice_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          GROUP BY TO_CHAR(TO_DATE(invoice_date, 'YYYY-MM-DD'), 'YYYY-MM')
        ),
        monthly_returns AS (
          SELECT 
            TO_CHAR(TO_DATE(i.invoice_date, 'YYYY-MM-DD'), 'YYYY-MM') as month,
            COUNT(DISTINCT i.id) as return_count
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE ${whereClauseAliased}
            AND i.invoice_date IS NOT NULL 
            AND i.invoice_date != ''
            AND i.invoice_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          GROUP BY TO_CHAR(TO_DATE(i.invoice_date, 'YYYY-MM-DD'), 'YYYY-MM')
        )
        SELECT 
          s.month,
          s.revenue,
          s.revenue - s.cost as profit,
          CASE WHEN s.revenue > 0 THEN ((s.revenue - s.cost) / s.revenue) * 100 ELSE 0 END as margin,
          CASE WHEN s.units > 0 THEN (COALESCE(r.return_count, 0)::float / s.units) * 100 ELSE 0 END as return_rate
        FROM monthly_sales s
        LEFT JOIN monthly_returns r ON s.month = r.month
        ORDER BY s.month DESC
        LIMIT 12
      `, params);

      // Returns analysis - Reasons breakdown
      const returnsReasons = await pool.query(`
        SELECT 
          COALESCE(UPPER(NULLIF(r.reason_for_return, '')), 'NOT SPECIFIED') as reason,
          COUNT(*) as count,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric)), 0) as revenue_impact,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as profit_impact
        FROM returns r
        INNER JOIN inventory i ON 
          i.invent_serial_id = r.serial_id AND
          i.data_area_id = r.area_id AND
          i.item_id = r.item_id
        WHERE ${whereClauseAliased}
        GROUP BY COALESCE(UPPER(NULLIF(r.reason_for_return, '')), 'NOT SPECIFIED')
        ORDER BY count DESC
        LIMIT 10
      `, params);

      // Returns by category - which categories have most returns
      const returnsByCategory = await pool.query(`
        SELECT 
          UPPER(COALESCE(i.category, 'UNKNOWN')) as category,
          COUNT(DISTINCT i.id) as return_count,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric)), 0) as revenue_at_risk,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as profit_lost
        FROM inventory i
        INNER JOIN returns r ON 
          i.invent_serial_id = r.serial_id AND
          i.data_area_id = r.area_id AND
          i.item_id = r.item_id
        WHERE ${whereClauseAliased}
        GROUP BY UPPER(COALESCE(i.category, 'UNKNOWN'))
        ORDER BY return_count DESC
        LIMIT 10
      `, params);

      // Returns by status/solution - what happens to returned items
      const returnsSolutions = await pool.query(`
        SELECT 
          COALESCE(UPPER(NULLIF(r.line_solution, '')), 'PENDING') as solution,
          COUNT(*) as count,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric)), 0) as value
        FROM returns r
        INNER JOIN inventory i ON 
          i.invent_serial_id = r.serial_id AND
          i.data_area_id = r.area_id AND
          i.item_id = r.item_id
        WHERE ${whereClauseAliased}
        GROUP BY COALESCE(UPPER(NULLIF(r.line_solution, '')), 'PENDING')
        ORDER BY count DESC
      `, params);

      // Cost bottleneck analysis - which cost categories eat into margins
      const costBottlenecks = await pool.query(`
        SELECT 
          UPPER(COALESCE(category, 'UNKNOWN')) as category,
          COUNT(*) as units,
          COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
          COALESCE(SUM(CAST(purch_price_usd AS numeric)), 0) as purchase_cost,
          COALESCE(SUM(CAST(parts_cost_usd AS numeric)), 0) as parts_cost,
          COALESCE(SUM(CAST(freight_charges_usd AS numeric)), 0) as freight_cost,
          COALESCE(SUM(CAST(resource_cost_usd AS numeric)) + 
            SUM(CAST(standardisation_cost_usd AS numeric)), 0) as labor_cost,
          COALESCE(SUM(CAST(packaging_cost_usd AS numeric)), 0) as packaging_cost,
          COALESCE(SUM(CAST(misc_cost_usd AS numeric)) + 
            SUM(CAST(consumable_cost_usd AS numeric)) + 
            SUM(CAST(battery_cost_usd AS numeric)) + 
            SUM(CAST(lcd_cost_usd AS numeric)) + 
            SUM(CAST(coa_cost_usd AS numeric)), 0) as other_costs,
          COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as total_cost,
          CASE WHEN SUM(CAST(final_sales_price_usd AS numeric)) > 0 
            THEN ((SUM(CAST(final_sales_price_usd AS numeric)) - SUM(CAST(final_total_cost_usd AS numeric))) / 
                  SUM(CAST(final_sales_price_usd AS numeric))) * 100 
            ELSE 0 END as margin
        FROM inventory 
        WHERE ${whereClause}
        GROUP BY UPPER(COALESCE(category, 'UNKNOWN'))
        ORDER BY revenue DESC
        LIMIT 15
      `, params);

      // High-cost products - products where costs significantly impact margin
      const highCostProducts = await pool.query(`
        SELECT 
          CONCAT(make, ' ', model_num) as product,
          COUNT(*) as units,
          COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
          COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as total_cost,
          CASE WHEN SUM(CAST(final_sales_price_usd AS numeric)) > 0 
            THEN (SUM(CAST(final_total_cost_usd AS numeric)) / SUM(CAST(final_sales_price_usd AS numeric))) * 100 
            ELSE 0 END as cost_ratio,
          CASE WHEN SUM(CAST(final_sales_price_usd AS numeric)) > 0 
            THEN ((SUM(CAST(final_sales_price_usd AS numeric)) - SUM(CAST(final_total_cost_usd AS numeric))) / 
                  SUM(CAST(final_sales_price_usd AS numeric))) * 100 
            ELSE 0 END as margin
        FROM inventory 
        WHERE ${whereClause}
        GROUP BY CONCAT(make, ' ', model_num)
        HAVING COUNT(*) >= 10
        ORDER BY cost_ratio DESC
        LIMIT 10
      `, params);

      // Warranty analysis - products under warranty
      const warrantyAnalysis = await pool.query(`
        SELECT 
          COUNT(CASE WHEN warranty_end_date IS NOT NULL AND warranty_end_date != '' 
            AND warranty_end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            AND TO_DATE(warranty_end_date, 'YYYY-MM-DD') >= CURRENT_DATE THEN 1 END) as under_warranty,
          COUNT(CASE WHEN warranty_end_date IS NOT NULL AND warranty_end_date != '' 
            AND warranty_end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            AND TO_DATE(warranty_end_date, 'YYYY-MM-DD') >= CURRENT_DATE 
            AND TO_DATE(warranty_end_date, 'YYYY-MM-DD') < CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as expiring_soon,
          COALESCE(SUM(CASE WHEN warranty_end_date IS NOT NULL AND warranty_end_date != '' 
            AND warranty_end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            AND TO_DATE(warranty_end_date, 'YYYY-MM-DD') >= CURRENT_DATE 
            THEN CAST(final_sales_price_usd AS numeric) ELSE 0 END), 0) as warranty_value
        FROM inventory 
        WHERE ${whereClause}
      `, params);

      // Generate critical alerts
      const criticalAlerts: any[] = [];

      if (netMargin < 5) {
        criticalAlerts.push({
          type: 'margin',
          severity: netMargin < 0 ? 'critical' : 'warning',
          title: 'Net Margin Alert',
          description: `Net margin after returns is ${netMargin.toFixed(1)}% - below target`,
          impact: profitLost,
          recommendation: 'Focus on reducing return rates and improving product quality'
        });
      }

      if (returnRate > 5) {
        criticalAlerts.push({
          type: 'returns',
          severity: returnRate > 10 ? 'critical' : 'warning',
          title: 'High Return Rate',
          description: `${returnRate.toFixed(1)}% of sales are being returned`,
          impact: revenueAtRisk,
          recommendation: 'Analyze return reasons and address quality issues'
        });
      }

      // Check for negative margin categories
      const negMarginCats = categoryPerf.rows.filter(c => parseFloat(c.margin) < 0);
      if (negMarginCats.length > 0) {
        criticalAlerts.push({
          type: 'product',
          severity: 'critical',
          title: 'Negative Margin Categories',
          description: `${negMarginCats.length} categories are losing money`,
          impact: negMarginCats.reduce((sum, c) => sum + Math.abs(parseFloat(c.profit)), 0),
          recommendation: 'Review pricing or discontinue unprofitable categories'
        });
      }

      res.json({
        salesRevenue: totalRevenue,
        salesCost: totalCost,
        grossProfit,
        grossMargin,
        returnImpact: profitLost,
        netProfit,
        netMargin,
        unitsSold,
        unitsReturned,
        returnRate,
        uniqueCustomers: parseInt(sales.unique_customers) || 0,
        uniqueProducts: parseInt(sales.unique_products) || 0,
        profitabilityWaterfall: {
          grossRevenue: totalRevenue,
          purchaseCost,
          partsCost,
          freightCost,
          laborCost,
          packagingCost,
          otherCosts,
          grossProfit,
          returnImpact: profitLost,
          netProfit,
          grossMargin,
          netMargin,
        },
        topPerformingCategory: topCategory ? {
          name: topCategory.category,
          profit: parseFloat(topCategory.profit),
          margin: parseFloat(topCategory.margin),
        } : { name: 'N/A', profit: 0, margin: 0 },
        worstPerformingCategory: worstCategory ? {
          name: worstCategory.category,
          profit: parseFloat(worstCategory.profit),
          margin: parseFloat(worstCategory.margin),
        } : { name: 'N/A', profit: 0, margin: 0 },
        topCustomer: topCustomerResult.rows[0] ? {
          name: topCustomerResult.rows[0].customer,
          revenue: parseFloat(topCustomerResult.rows[0].revenue),
          margin: parseFloat(topCustomerResult.rows[0].margin),
        } : { name: 'N/A', revenue: 0, margin: 0 },
        highestReturnProduct: highReturnProduct.rows[0] ? {
          name: highReturnProduct.rows[0].product,
          returnRate: parseFloat(highReturnProduct.rows[0].return_rate),
          lostProfit: parseFloat(highReturnProduct.rows[0].lost_profit),
        } : { name: 'N/A', returnRate: 0, lostProfit: 0 },
        regionPerformance: regionalPerf.rows.map(r => ({
          region: r.region || 'Unknown',
          revenue: parseFloat(r.revenue),
          profit: parseFloat(r.profit),
          returnRate: parseFloat(r.return_rate),
        })),
        criticalAlerts,
        monthlyTrends: monthlyTrends.rows.map(m => ({
          month: m.month,
          revenue: parseFloat(m.revenue),
          profit: parseFloat(m.profit),
          margin: parseFloat(m.margin),
          returnRate: parseFloat(m.return_rate),
        })).reverse(),
        
        // Returns & Warranty Analysis
        returnsAnalysis: {
          reasonsBreakdown: returnsReasons.rows.map(r => ({
            reason: r.reason,
            count: parseInt(r.count),
            revenueImpact: parseFloat(r.revenue_impact),
            profitImpact: parseFloat(r.profit_impact),
          })),
          byCategory: returnsByCategory.rows.map(c => ({
            category: c.category,
            returnCount: parseInt(c.return_count),
            revenueAtRisk: parseFloat(c.revenue_at_risk),
            profitLost: parseFloat(c.profit_lost),
          })),
          solutionsBreakdown: returnsSolutions.rows.map(s => ({
            solution: s.solution,
            count: parseInt(s.count),
            value: parseFloat(s.value),
          })),
        },
        warrantyExposure: {
          underWarranty: parseInt(warrantyAnalysis.rows[0]?.under_warranty) || 0,
          expiringSoon: parseInt(warrantyAnalysis.rows[0]?.expiring_soon) || 0,
          warrantyValue: parseFloat(warrantyAnalysis.rows[0]?.warranty_value) || 0,
        },
        
        // Cost Bottleneck Analysis
        costBottlenecks: costBottlenecks.rows.map(c => ({
          category: c.category,
          units: parseInt(c.units),
          revenue: parseFloat(c.revenue),
          purchaseCost: parseFloat(c.purchase_cost),
          partsCost: parseFloat(c.parts_cost),
          freightCost: parseFloat(c.freight_cost),
          laborCost: parseFloat(c.labor_cost),
          packagingCost: parseFloat(c.packaging_cost),
          otherCosts: parseFloat(c.other_costs),
          totalCost: parseFloat(c.total_cost),
          margin: parseFloat(c.margin),
        })),
        highCostProducts: highCostProducts.rows.map(p => ({
          product: p.product,
          units: parseInt(p.units),
          revenue: parseFloat(p.revenue),
          totalCost: parseFloat(p.total_cost),
          costRatio: parseFloat(p.cost_ratio),
          margin: parseFloat(p.margin),
        })),
      });
    } catch (error) {
      console.error("Error fetching strategic dashboard:", error);
      res.status(500).json({ error: "Failed to fetch strategic dashboard data" });
    }
  });

  // Customer Intelligence - Value segmentation with return impact
  app.get("/api/strategic/customers", async (_req: Request, res: Response) => {
    try {
      const customerData = await pool.query(`
        WITH customer_sales AS (
          SELECT 
            UPPER(COALESCE(invoicing_name, 'UNKNOWN')) as customer,
            COUNT(*) as units_sold,
            COUNT(DISTINCT sales_id) as orders,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost,
            MAX(invoice_date) as last_order
          FROM inventory 
          WHERE trans_type = 'SalesOrder'
          GROUP BY UPPER(COALESCE(invoicing_name, 'UNKNOWN'))
        ),
        customer_returns AS (
          SELECT 
            UPPER(COALESCE(i.invoicing_name, 'UNKNOWN')) as customer,
            COUNT(DISTINCT i.id) as units_returned,
            COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as profit_lost
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE i.trans_type = 'SalesOrder'
          GROUP BY UPPER(COALESCE(i.invoicing_name, 'UNKNOWN'))
        )
        SELECT 
          s.customer,
          s.units_sold,
          s.orders,
          s.revenue,
          s.cost,
          s.revenue - s.cost as gross_profit,
          CASE WHEN s.revenue > 0 THEN ((s.revenue - s.cost) / s.revenue) * 100 ELSE 0 END as gross_margin,
          COALESCE(r.units_returned, 0) as units_returned,
          CASE WHEN s.units_sold > 0 THEN (COALESCE(r.units_returned, 0)::float / s.units_sold) * 100 ELSE 0 END as return_rate,
          (s.revenue - s.cost) - COALESCE(r.profit_lost, 0) as profit_after_returns,
          s.last_order
        FROM customer_sales s
        LEFT JOIN customer_returns r ON s.customer = r.customer
        ORDER BY s.revenue DESC
      `);

      const totalRevenue = customerData.rows.reduce((sum, c) => sum + parseFloat(c.revenue), 0);
      const top5Revenue = customerData.rows.slice(0, 5).reduce((sum, c) => sum + parseFloat(c.revenue), 0);
      const customerConcentration = totalRevenue > 0 ? (top5Revenue / totalRevenue) * 100 : 0;

      const customers = customerData.rows.map(c => {
        const revenue = parseFloat(c.revenue);
        const grossMargin = parseFloat(c.gross_margin);
        const returnRate = parseFloat(c.return_rate);
        
        // Determine customer value tier
        let customerValue: 'platinum' | 'gold' | 'silver' | 'bronze' | 'at-risk';
        if (revenue > 100000 && grossMargin > 15 && returnRate < 5) customerValue = 'platinum';
        else if (revenue > 50000 && grossMargin > 10) customerValue = 'gold';
        else if (revenue > 10000 && grossMargin > 5) customerValue = 'silver';
        else if (returnRate > 15 || grossMargin < 0) customerValue = 'at-risk';
        else customerValue = 'bronze';

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high';
        if (returnRate > 15 || grossMargin < 0) riskLevel = 'high';
        else if (returnRate > 10 || grossMargin < 5) riskLevel = 'medium';
        else riskLevel = 'low';

        return {
          customer: c.customer,
          totalRevenue: revenue,
          totalCost: parseFloat(c.cost),
          grossProfit: parseFloat(c.gross_profit),
          grossMargin,
          unitsSold: parseInt(c.units_sold),
          unitsReturned: parseInt(c.units_returned),
          returnRate,
          profitAfterReturns: parseFloat(c.profit_after_returns),
          netMargin: revenue > 0 ? (parseFloat(c.profit_after_returns) / revenue) * 100 : 0,
          customerValue,
          riskLevel,
          orders: parseInt(c.orders),
          avgOrderValue: parseInt(c.orders) > 0 ? revenue / parseInt(c.orders) : 0,
          lastOrderDate: c.last_order,
        };
      });

      res.json({
        totalCustomers: customers.length,
        platinumCustomers: customers.filter(c => c.customerValue === 'platinum').slice(0, 10),
        atRiskCustomers: customers.filter(c => c.customerValue === 'at-risk').slice(0, 10),
        highReturnCustomers: customers.filter(c => c.returnRate > 10).sort((a, b) => b.returnRate - a.returnRate).slice(0, 10),
        customerConcentration,
        avgCustomerLifetimeValue: customers.length > 0 ? totalRevenue / customers.length : 0,
        avgReturnRate: customers.length > 0 ? customers.reduce((sum, c) => sum + c.returnRate, 0) / customers.length : 0,
      });
    } catch (error) {
      console.error("Error fetching customer intelligence:", error);
      res.status(500).json({ error: "Failed to fetch customer intelligence" });
    }
  });

  // Product Intelligence - Risk/Reward matrix with return impact
  app.get("/api/strategic/products", async (_req: Request, res: Response) => {
    try {
      const productData = await pool.query(`
        WITH product_sales AS (
          SELECT 
            CONCAT(make, ' ', model_num) as product,
            make,
            UPPER(COALESCE(category, 'UNKNOWN')) as category,
            COUNT(*) as units_sold,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost
          FROM inventory 
          WHERE trans_type = 'SalesOrder'
          GROUP BY CONCAT(make, ' ', model_num), make, UPPER(COALESCE(category, 'UNKNOWN'))
        ),
        product_returns AS (
          SELECT 
            CONCAT(i.make, ' ', i.model_num) as product,
            COUNT(DISTINCT i.id) as units_returned,
            COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as profit_lost
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE i.trans_type = 'SalesOrder'
          GROUP BY CONCAT(i.make, ' ', i.model_num)
        )
        SELECT 
          s.product,
          s.make,
          s.category,
          s.units_sold,
          s.revenue,
          s.cost,
          s.revenue - s.cost as gross_profit,
          CASE WHEN s.revenue > 0 THEN ((s.revenue - s.cost) / s.revenue) * 100 ELSE 0 END as gross_margin,
          COALESCE(r.units_returned, 0) as units_returned,
          CASE WHEN s.units_sold > 0 THEN (COALESCE(r.units_returned, 0)::float / s.units_sold) * 100 ELSE 0 END as return_rate,
          (s.revenue - s.cost) - COALESCE(r.profit_lost, 0) as profit_after_returns
        FROM product_sales s
        LEFT JOIN product_returns r ON s.product = r.product
        WHERE s.units_sold >= 3
        ORDER BY s.revenue DESC
      `);

      // Calculate max values for scoring
      const maxProfit = Math.max(...productData.rows.map(p => parseFloat(p.gross_profit)));
      const maxVolume = Math.max(...productData.rows.map(p => parseInt(p.units_sold)));

      const products = productData.rows.map(p => {
        const grossProfit = parseFloat(p.gross_profit);
        const grossMargin = parseFloat(p.gross_margin);
        const returnRate = parseFloat(p.return_rate);
        const volume = parseInt(p.units_sold);
        const revenue = parseFloat(p.revenue);

        // Risk score (0-100, higher = riskier) based on return rate and low margin
        const riskScore = Math.min(100, (returnRate * 5) + (grossMargin < 5 ? 30 : 0) + (grossMargin < 0 ? 50 : 0));
        
        // Reward score (0-100) based on profit and volume
        const profitScore = maxProfit > 0 ? (grossProfit / maxProfit) * 50 : 0;
        const volumeScore = maxVolume > 0 ? (volume / maxVolume) * 50 : 0;
        const rewardScore = Math.min(100, profitScore + volumeScore);

        // Quadrant classification
        let quadrant: 'star' | 'cash-cow' | 'question-mark' | 'dog';
        if (rewardScore > 50 && riskScore < 30) quadrant = 'star';
        else if (rewardScore > 30 && riskScore < 50) quadrant = 'cash-cow';
        else if (rewardScore > 30 && riskScore >= 50) quadrant = 'question-mark';
        else quadrant = 'dog';

        return {
          product: p.product,
          make: p.make || 'Unknown',
          category: p.category,
          unitsSold: volume,
          revenue,
          cost: parseFloat(p.cost),
          grossProfit,
          grossMargin,
          unitsReturned: parseInt(p.units_returned),
          returnRate,
          profitAfterReturns: parseFloat(p.profit_after_returns),
          netMargin: revenue > 0 ? (parseFloat(p.profit_after_returns) / revenue) * 100 : 0,
          riskScore,
          rewardScore,
          quadrant,
        };
      });

      // Category performance
      const categoryPerf = await pool.query(`
        WITH cat_sales AS (
          SELECT 
            UPPER(COALESCE(category, 'UNKNOWN')) as category,
            COUNT(*) as units,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost
          FROM inventory 
          WHERE trans_type = 'SalesOrder'
          GROUP BY UPPER(COALESCE(category, 'UNKNOWN'))
        ),
        cat_returns AS (
          SELECT 
            UPPER(COALESCE(i.category, 'UNKNOWN')) as category,
            COUNT(DISTINCT i.id) as return_count
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE i.trans_type = 'SalesOrder'
          GROUP BY UPPER(COALESCE(i.category, 'UNKNOWN'))
        )
        SELECT 
          s.category,
          s.units,
          s.revenue,
          s.revenue - s.cost as profit,
          CASE WHEN s.revenue > 0 THEN ((s.revenue - s.cost) / s.revenue) * 100 ELSE 0 END as margin,
          CASE WHEN s.units > 0 THEN (COALESCE(r.return_count, 0)::float / s.units) * 100 ELSE 0 END as return_rate
        FROM cat_sales s
        LEFT JOIN cat_returns r ON s.category = r.category
        ORDER BY s.revenue DESC
      `);

      // Make performance
      const makePerf = await pool.query(`
        WITH make_sales AS (
          SELECT 
            UPPER(COALESCE(make, 'UNKNOWN')) as make,
            COUNT(*) as units,
            COALESCE(SUM(CAST(final_sales_price_usd AS numeric)), 0) as revenue,
            COALESCE(SUM(CAST(final_total_cost_usd AS numeric)), 0) as cost
          FROM inventory 
          WHERE trans_type = 'SalesOrder'
          GROUP BY UPPER(COALESCE(make, 'UNKNOWN'))
        ),
        make_returns AS (
          SELECT 
            UPPER(COALESCE(i.make, 'UNKNOWN')) as make,
            COUNT(DISTINCT i.id) as return_count
          FROM inventory i
          INNER JOIN returns r ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE i.trans_type = 'SalesOrder'
          GROUP BY UPPER(COALESCE(i.make, 'UNKNOWN'))
        )
        SELECT 
          s.make,
          s.units,
          s.revenue,
          s.revenue - s.cost as profit,
          CASE WHEN s.revenue > 0 THEN ((s.revenue - s.cost) / s.revenue) * 100 ELSE 0 END as margin,
          CASE WHEN s.units > 0 THEN (COALESCE(r.return_count, 0)::float / s.units) * 100 ELSE 0 END as return_rate
        FROM make_sales s
        LEFT JOIN make_returns r ON s.make = r.make
        ORDER BY s.revenue DESC
      `);

      res.json({
        totalProducts: products.length,
        totalModels: new Set(products.map(p => p.product)).size,
        stars: products.filter(p => p.quadrant === 'star').slice(0, 10),
        cashCows: products.filter(p => p.quadrant === 'cash-cow').slice(0, 10),
        questionMarks: products.filter(p => p.quadrant === 'question-mark').slice(0, 10),
        dogs: products.filter(p => p.quadrant === 'dog').slice(0, 10),
        categoryPerformance: categoryPerf.rows.map(c => ({
          category: c.category,
          revenue: parseFloat(c.revenue),
          profit: parseFloat(c.profit),
          margin: parseFloat(c.margin),
          returnRate: parseFloat(c.return_rate),
          units: parseInt(c.units),
        })),
        makePerformance: makePerf.rows.map(m => ({
          make: m.make,
          revenue: parseFloat(m.revenue),
          profit: parseFloat(m.profit),
          margin: parseFloat(m.margin),
          returnRate: parseFloat(m.return_rate),
          units: parseInt(m.units),
        })),
      });
    } catch (error) {
      console.error("Error fetching product intelligence:", error);
      res.status(500).json({ error: "Failed to fetch product intelligence" });
    }
  });

  // Returns Deep Dive - Linked returns analysis
  app.get("/api/strategic/returns", async (_req: Request, res: Response) => {
    try {
      // Linked vs unlinked returns
      const linkedReturns = await pool.query(`
        SELECT COUNT(DISTINCT r.id) as linked_count
        FROM returns r
        INNER JOIN inventory i ON 
          i.invent_serial_id = r.serial_id AND
          i.data_area_id = r.area_id AND
          i.item_id = r.item_id
        WHERE i.trans_type = 'SalesOrder'
      `);

      const totalReturns = await pool.query(`SELECT COUNT(*) as total FROM returns`);
      
      const linkedCount = parseInt(linkedReturns.rows[0]?.linked_count) || 0;
      const totalCount = parseInt(totalReturns.rows[0]?.total) || 0;

      // Return reasons impact
      const reasonImpact = await pool.query(`
        SELECT 
          COALESCE(r.reason_for_return, 'Unknown') as reason,
          COUNT(*) as count,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric) - CAST(i.final_total_cost_usd AS numeric)), 0) as estimated_cost
        FROM returns r
        LEFT JOIN inventory i ON 
          i.invent_serial_id = r.serial_id AND
          i.data_area_id = r.area_id AND
          i.item_id = r.item_id AND
          i.trans_type = 'SalesOrder'
        GROUP BY COALESCE(r.reason_for_return, 'Unknown')
        ORDER BY count DESC
        LIMIT 10
      `);

      const totalReasonCount = reasonImpact.rows.reduce((sum, r) => sum + parseInt(r.count), 0);

      // Monthly returns trend
      const monthlyReturns = await pool.query(`
        SELECT 
          TO_CHAR(TO_DATE(r.created_on, 'YYYY-MM-DD'), 'YYYY-MM') as month,
          COUNT(*) as count,
          COALESCE(SUM(CAST(i.final_sales_price_usd AS numeric)), 0) as linked_revenue
        FROM returns r
        LEFT JOIN inventory i ON 
          i.invent_serial_id = r.serial_id AND
          i.data_area_id = r.area_id AND
          i.item_id = r.item_id AND
          i.trans_type = 'SalesOrder'
        WHERE r.created_on IS NOT NULL 
          AND r.created_on != ''
          AND r.created_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        GROUP BY TO_CHAR(TO_DATE(r.created_on, 'YYYY-MM-DD'), 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `);

      // Top return products
      const topReturnProducts = await pool.query(`
        WITH product_sales AS (
          SELECT 
            CONCAT(make, ' ', model_num) as product,
            COUNT(*) as sold
          FROM inventory 
          WHERE trans_type = 'SalesOrder'
          GROUP BY CONCAT(make, ' ', model_num)
        ),
        product_returns AS (
          SELECT 
            CONCAT(i.make, ' ', i.model_num) as product,
            COUNT(DISTINCT r.id) as return_count
          FROM returns r
          INNER JOIN inventory i ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE i.trans_type = 'SalesOrder'
          GROUP BY CONCAT(i.make, ' ', i.model_num)
        )
        SELECT 
          pr.product,
          pr.return_count,
          CASE WHEN ps.sold > 0 THEN (pr.return_count::float / ps.sold) * 100 ELSE 0 END as return_rate
        FROM product_returns pr
        LEFT JOIN product_sales ps ON pr.product = ps.product
        ORDER BY pr.return_count DESC
        LIMIT 10
      `);

      // Top return customers
      const topReturnCustomers = await pool.query(`
        WITH customer_sales AS (
          SELECT 
            UPPER(invoicing_name) as customer,
            COUNT(*) as sold
          FROM inventory 
          WHERE trans_type = 'SalesOrder'
          GROUP BY UPPER(invoicing_name)
        ),
        customer_returns AS (
          SELECT 
            UPPER(i.invoicing_name) as customer,
            COUNT(DISTINCT r.id) as return_count
          FROM returns r
          INNER JOIN inventory i ON 
            i.invent_serial_id = r.serial_id AND
            i.data_area_id = r.area_id AND
            i.item_id = r.item_id
          WHERE i.trans_type = 'SalesOrder'
          GROUP BY UPPER(i.invoicing_name)
        )
        SELECT 
          cr.customer,
          cr.return_count,
          CASE WHEN cs.sold > 0 THEN (cr.return_count::float / cs.sold) * 100 ELSE 0 END as return_rate
        FROM customer_returns cr
        LEFT JOIN customer_sales cs ON cr.customer = cs.customer
        ORDER BY cr.return_count DESC
        LIMIT 10
      `);

      res.json({
        totalReturnsLinked: linkedCount,
        totalReturnsUnlinked: totalCount - linkedCount,
        avgDaysToReturn: 0, // Would need date comparison
        returnReasonImpact: reasonImpact.rows.map(r => ({
          reason: r.reason,
          count: parseInt(r.count),
          percentOfReturns: totalReasonCount > 0 ? (parseInt(r.count) / totalReasonCount) * 100 : 0,
          estimatedCost: parseFloat(r.estimated_cost),
          avgDaysToReturn: 0,
          topProducts: [],
          trend: 'stable' as const,
        })),
        returnsByMonth: monthlyReturns.rows.map(m => ({
          month: m.month,
          count: parseInt(m.count),
          linkedRevenue: parseFloat(m.linked_revenue),
        })).reverse(),
        repeatReturnSerials: 0,
        topReturnProducts: topReturnProducts.rows.map(p => ({
          product: p.product,
          returnCount: parseInt(p.return_count),
          returnRate: parseFloat(p.return_rate),
        })),
        topReturnCustomers: topReturnCustomers.rows.map(c => ({
          customer: c.customer,
          returnCount: parseInt(c.return_count),
          returnRate: parseFloat(c.return_rate),
        })),
      });
    } catch (error) {
      console.error("Error fetching returns deep dive:", error);
      res.status(500).json({ error: "Failed to fetch returns analysis" });
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
      const validInsightTypes = ['category', 'customer', 'vendor', 'product', 'monthly', 'status', 'make', 'custom', 'pivot'];
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
  // QUERY BUILDER - Advanced BI query execution
  // ============================================

  // Get available columns for query builder
  app.get("/api/query-builder/columns", async (_req: Request, res: Response) => {
    const inventoryColumns: QueryColumn[] = [
      // Text/Dimension fields
      { entity: 'inventory', field: 'dataAreaId', label: 'Data Area ID', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'itemId', label: 'Item ID', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'inventSerialId', label: 'Serial ID', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'dealRef', label: 'Deal Reference', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'category', label: 'Category', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'make', label: 'Make/Brand', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'modelNum', label: 'Model', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'invoicingName', label: 'Customer', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'vendName', label: 'Vendor', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'gradeCondition', label: 'Grade/Condition', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'status', label: 'Status', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'transType', label: 'Transaction Type', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'segregation', label: 'Region', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'processor', label: 'Processor', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'processorGen', label: 'Processor Generation', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'ram', label: 'RAM', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'soldAsRAM', label: 'Sold As RAM', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'hdd', label: 'Storage', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'soldAsHDD', label: 'Sold As HDD', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'storageType', label: 'Storage Type', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'chassis', label: 'Chassis', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'displaySize', label: 'Display Size', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'resolution', label: 'Resolution', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'keyLayout', label: 'Keyboard Layout', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'keyLang', label: 'Keyboard Language', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'osSticker', label: 'OS Sticker', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'madeIn', label: 'Made In', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'purchaseCategory', label: 'Purchase Category', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'poNumber', label: 'PO Number', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'salesId', label: 'Sales ID', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'salesInvoiceId', label: 'Invoice ID', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'invoiceAccount', label: 'Invoice Account', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'customerRef', label: 'Customer Ref', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'crmRef', label: 'CRM Ref', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'orderTaker', label: 'Order Taker', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'orderResponsible', label: 'Order Responsible', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'manufacturerSerialNum', label: 'Manufacturer Serial', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'storageSerialNum', label: 'Storage Serial', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'warrantyDescription', label: 'Warranty Description', type: 'text', aggregatable: false },
      { entity: 'inventory', field: 'productSpecification', label: 'Product Spec', type: 'text', aggregatable: false },
      // Date fields
      { entity: 'inventory', field: 'invoiceDate', label: 'Invoice Date', type: 'date', aggregatable: false },
      { entity: 'inventory', field: 'salesOrderDate', label: 'Sales Order Date', type: 'date', aggregatable: false },
      { entity: 'inventory', field: 'purchDate', label: 'Purchase Date', type: 'date', aggregatable: false },
      { entity: 'inventory', field: 'receivedDate', label: 'Received Date', type: 'date', aggregatable: false },
      { entity: 'inventory', field: 'manufacturingDate', label: 'Manufacturing Date', type: 'date', aggregatable: false },
      { entity: 'inventory', field: 'warrantyStartDate', label: 'Warranty Start', type: 'date', aggregatable: false },
      { entity: 'inventory', field: 'warrantyEndDate', label: 'Warranty End', type: 'date', aggregatable: false },
      // Numeric/Measure fields
      { entity: 'inventory', field: 'finalSalesPriceUSD', label: 'Sales Price (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'finalTotalCostUSD', label: 'Total Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'purchPriceUSD', label: 'Purchase Price (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'purchPriceRevisedUSD', label: 'Purchase Price Revised (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'partsCostUSD', label: 'Parts Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'freightChargesUSD', label: 'Freight (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'resourceCostUSD', label: 'Labor Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'lcdCostUSD', label: 'LCD Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'miscCostUSD', label: 'Misc Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'packagingCostUSD', label: 'Packaging Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'itadTreesCostUSD', label: 'ITAD Trees Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'standardisationCostUSD', label: 'Standardisation Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'consumableCostUSD', label: 'Consumable Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'batteryCostUSD', label: 'Battery Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'coaCostUSD', label: 'COA Cost (USD)', type: 'numeric', aggregatable: true },
      { entity: 'inventory', field: 'customsDutyUSD', label: 'Customs Duty (USD)', type: 'numeric', aggregatable: true },
    ];
    
    const returnsColumns: QueryColumn[] = [
      // Text/Dimension fields
      { entity: 'returns', field: 'rmaNumber', label: 'RMA Number', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'rmaStatus', label: 'RMA Status', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'reasonForReturn', label: 'Reason for Return', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'lineStatus', label: 'Line Status', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'lineSolution', label: 'Solution', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'finalCustomer', label: 'Final Customer', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'caseCustomer', label: 'Case Customer', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'caseEndUser', label: 'Case End User', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'typeOfUnit', label: 'Unit Type', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'caseId', label: 'Case ID', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'rmaLineName', label: 'RMA Line Name', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'relatedOrderName', label: 'Related Order', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'finalResellerName', label: 'Final Reseller', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'finalDistributorName', label: 'Final Distributor', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'opportunityNumber', label: 'Opportunity Number', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'rmaTopicLabel', label: 'RMA Topic', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'ukFinalOutcome', label: 'UK Final Outcome', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'uaeFinalOutcome', label: 'UAE Final Outcome', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'serialId', label: 'Serial ID', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'areaId', label: 'Area ID', type: 'text', aggregatable: false },
      { entity: 'returns', field: 'itemId', label: 'Item ID', type: 'text', aggregatable: false },
      // Date fields
      { entity: 'returns', field: 'createdOn', label: 'Created Date', type: 'date', aggregatable: false },
      { entity: 'returns', field: 'modifiedOn', label: 'Modified Date', type: 'date', aggregatable: false },
      { entity: 'returns', field: 'itemReceivedDate', label: 'Item Received Date', type: 'date', aggregatable: false },
      { entity: 'returns', field: 'itemTestingDate', label: 'Item Testing Date', type: 'date', aggregatable: false },
      { entity: 'returns', field: 'dispatchDate', label: 'Dispatch Date', type: 'date', aggregatable: false },
      { entity: 'returns', field: 'expectedShippingDate', label: 'Expected Shipping Date', type: 'date', aggregatable: false },
    ];

    // Fetch entity configs from database
    const entityConfigsData = await db.select().from(entityConfigs);
    const joinKeysData = await db.select().from(entityJoinKeys);
    
    // Build entities list from database (fall back to defaults if empty)
    const entities = entityConfigsData.length > 0 
      ? entityConfigsData
          .filter(e => e.isVisible === 'true')
          .map(e => ({
            id: e.entityId,
            name: e.displayName,
            description: e.description || '',
            icon: e.icon || 'Database',
            color: e.color || '#6b7280'
          }))
      : [
          { id: 'inventory', name: 'Inventory', description: 'Main inventory and sales data', icon: 'Package', color: '#3b82f6' },
          { id: 'returns', name: 'Returns', description: 'Return and warranty claims', icon: 'RotateCcw', color: '#f59e0b' },
        ];
    
    // Filter columns based on visible entities
    const visibleEntityIds = entities.map(e => e.id);
    const filteredColumns: Record<string, QueryColumn[]> = {};
    if (visibleEntityIds.includes('inventory')) {
      filteredColumns.inventory = inventoryColumns;
    }
    if (visibleEntityIds.includes('returns')) {
      filteredColumns.returns = returnsColumns;
    }
    
    // Build relationships/join keys from database
    const relationships = joinKeysData.length > 0
      ? joinKeysData.map(jk => {
          // Use fieldPairs if available, otherwise fall back to legacy fields
          const pairs = jk.fieldPairs && Array.isArray(jk.fieldPairs) && jk.fieldPairs.length > 0
            ? jk.fieldPairs
            : [{ sourceField: jk.sourceField, targetField: jk.targetField }];
          
          // Get supported join types
          const supportedTypes = (jk.supportedJoinTypes || 'inner,left,right').split(',') as ('inner' | 'left' | 'right' | 'first' | 'exists')[];
          
          // Get default join type, ensuring it's in supported types
          let defaultType = (jk.defaultJoinType || 'left') as 'inner' | 'left' | 'right' | 'first' | 'exists';
          if (!supportedTypes.includes(defaultType)) {
            defaultType = supportedTypes[0] || 'left';
          }
          
          return {
            id: `${jk.sourceEntityId}-${jk.targetEntityId}-${jk.id}`,
            sourceEntity: jk.sourceEntityId,
            targetEntity: jk.targetEntityId,
            sourceField: pairs[0].sourceField,
            targetField: pairs[0].targetField,
            joinFields: pairs.map(p => ({ from: p.sourceField, to: p.targetField })),
            label: jk.name,
            bidirectional: jk.bidirectional === true,
            isDefault: jk.isDefault === 'true',
            defaultJoinType: defaultType,
            supportedJoinTypes: supportedTypes
          };
        })
      : [
          {
            id: 'inventory-returns',
            sourceEntity: 'inventory',
            targetEntity: 'returns',
            sourceField: 'inventSerialId',
            targetField: 'serialId',
            joinFields: [{ from: 'inventSerialId', to: 'serialId' }],
            label: 'Serial Number Link',
            bidirectional: true,
            isDefault: true,
            defaultJoinType: 'left' as const,
            supportedJoinTypes: ['inner', 'left', 'right', 'first', 'exists'] as ('inner' | 'left' | 'right' | 'first' | 'exists')[]
          }
        ];

    res.json({
      ...filteredColumns,
      entities,
      relationships
    });
  });

  // Get distinct values for a column (for filter dropdowns)
  app.post("/api/query-builder/column-values", requireAuth, async (req: Request, res: Response) => {
    try {
      const { entity, field, search, limit: maxLimit = 100 } = req.body;
      
      // Validate entity - whitelist only allowed values
      if (!['inventory', 'returns'].includes(entity)) {
        return res.status(400).json({ error: "Invalid entity" });
      }
      
      // Whitelist of allowed fields per entity
      const allowedFields: Record<string, string[]> = {
        inventory: [
          'dataAreaId', 'itemId', 'inventSerialId', 'dealRef', 'category', 'make', 'modelNum',
          'invoicingName', 'vendName', 'gradeCondition', 'status', 'transType', 'segregation',
          'processor', 'processorGen', 'ram', 'soldAsRAM', 'hdd', 'soldAsHDD', 'storageType',
          'chassis', 'displaySize', 'resolution', 'keyLayout', 'keyLang', 'osSticker', 'madeIn',
          'purchaseCategory', 'poNumber', 'salesId', 'salesInvoiceId', 'invoiceAccount',
          'customerRef', 'crmRef', 'orderTaker', 'orderResponsible', 'manufacturerSerialNum',
          'storageSerialNum', 'warrantyDescription', 'productSpecification',
          'invoiceDate', 'salesOrderDate', 'purchDate', 'receivedDate', 'manufacturingDate',
          'warrantyStartDate', 'warrantyEndDate'
        ],
        returns: [
          'rmaNumber', 'rmaStatus', 'reasonForReturn', 'lineStatus', 'lineSolution',
          'finalCustomer', 'caseCustomer', 'caseEndUser', 'typeOfUnit', 'caseId', 'rmaLineName',
          'relatedOrderName', 'finalResellerName', 'finalDistributorName', 'opportunityNumber',
          'rmaTopicLabel', 'ukFinalOutcome', 'uaeFinalOutcome', 'serialId', 'areaId', 'itemId',
          'createdOn', 'modifiedOn', 'itemReceivedDate', 'itemTestingDate', 'dispatchDate', 'expectedShippingDate'
        ]
      };
      
      if (!allowedFields[entity]?.includes(field)) {
        return res.status(400).json({ error: "Invalid field" });
      }
      
      const fieldToColumn: Record<string, string> = {
        'finalSalesPriceUSD': 'final_sales_price_usd',
        'finalTotalCostUSD': 'final_total_cost_usd',
        'purchPriceUSD': 'purch_price_usd',
        'partsCostUSD': 'parts_cost_usd',
        'freightChargesUSD': 'freight_charges_usd',
        'resourceCostUSD': 'resource_cost_usd',
        'invoicingName': 'invoicing_name',
        'vendName': 'vend_name',
        'gradeCondition': 'grade_condition',
        'transType': 'trans_type',
        'modelNum': 'model_num',
        'invoiceDate': 'invoice_date',
        'salesOrderDate': 'sales_order_date',
        'purchDate': 'purch_date',
        'rmaNumber': 'rma_number',
        'rmaStatus': 'rma_status',
        'reasonForReturn': 'reason_for_return',
        'lineStatus': 'line_status',
        'lineSolution': 'line_solution',
        'finalCustomer': 'final_customer',
        'caseCustomer': 'case_customer',
        'typeOfUnit': 'type_of_unit',
        'createdOn': 'created_on',
        'itemReceivedDate': 'item_received_date',
        'dispatchDate': 'dispatch_date',
      };
      
      const table = entity === 'returns' ? 'returns' : 'inventory';
      const column = fieldToColumn[field] || field.toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      // Sanitize limit
      const safeLimit = Math.min(Math.max(1, parseInt(String(maxLimit)) || 100), 500);
      
      let query = `
        SELECT DISTINCT ${column}::text as value, COUNT(*)::int as count
        FROM ${table}
        WHERE ${column} IS NOT NULL AND ${column}::text != ''
      `;
      
      if (search && typeof search === 'string') {
        // Safely escape the search term
        const safeSearch = search.replace(/'/g, "''").substring(0, 100);
        query += ` AND LOWER(${column}::text) LIKE LOWER('%${safeSearch}%')`;
      }
      
      query += ` GROUP BY ${column} ORDER BY count DESC LIMIT ${safeLimit}`;
      
      const result = await db.execute(sql.raw(query));
      
      res.json({
        field,
        entity,
        values: (result.rows as any[]).map(r => ({ value: r.value, count: r.count }))
      });
    } catch (error) {
      console.error("Error fetching column values:", error);
      res.status(500).json({ error: "Failed to fetch column values" });
    }
  });

  // Execute dynamic query from query builder
  app.post("/api/query-builder/execute", requireAuth, async (req: Request, res: Response) => {
    try {
      const config = req.body as QueryBuilderConfig;
      const startTime = Date.now();
      
      // Detect which entities are actually referenced in the query
      const referencedEntities = new Set<string>();
      
      // Check dimensions
      for (const dim of config.dimensions) {
        referencedEntities.add(dim.column.entity);
      }
      
      // Check column dimensions
      for (const dim of config.columnDimensions || []) {
        referencedEntities.add(dim.column.entity);
      }
      
      // Check measures
      for (const measure of config.measures) {
        referencedEntities.add(measure.column.entity);
      }
      
      // Check filters
      for (const filter of config.filters) {
        referencedEntities.add(filter.column.entity);
      }
      
      // Check sorts (sorts use columnId which references dimensions/measures by alias)
      // Sorts don't directly reference entities, they reference dimension/measure aliases
      
      // Validate: if BOTH entities are referenced, we need a valid join
      const returnsReferenced = referencedEntities.has('returns');
      const inventoryReferenced = referencedEntities.has('inventory');
      const bothEntitiesReferenced = returnsReferenced && inventoryReferenced;
      const hasRelationship = config.relationships.length > 0;
      const rel = hasRelationship ? config.relationships[0] : null;
      const hasValidConditions = rel && rel.enabled && 
        (rel.conditions || []).some((c: any) => c.leftField && c.rightField);
      const joinType = rel?.joinType;
      
      // Join types that create the 'r' alias: inner, left, right, first
      // Join types that do NOT create alias: exists, none
      const aliasCreatingTypes = ['inner', 'left', 'right', 'first'];
      const joinsCreatesAlias = hasValidConditions && aliasCreatingTypes.includes(joinType || '');
      
      // Only require join when BOTH entities are referenced
      if (bothEntitiesReferenced && !joinsCreatesAlias) {
        if (joinType === 'exists') {
          return res.status(400).json({ 
            error: "The 'Exists' join type cannot be used when selecting columns from both tables. Use 'Inner', 'Left', 'Right', or 'First Match' join instead.",
            code: "EXISTS_JOIN_INVALID"
          });
        }
        if (!joinType || (joinType as string) === 'none') {
          return res.status(400).json({ 
            error: "When using both Inventory and Returns columns, please select a join type and configure field mappings.",
            code: "NO_JOIN_TYPE"
          });
        }
        return res.status(400).json({ 
          error: "When using both tables, please configure join conditions in the relationship section.",
          code: "MISSING_JOIN"
        });
      }
      
      // Build dynamic SQL query
      const selectParts: string[] = [];
      const groupByParts: string[] = [];
      
      // Map field names to snake_case for SQL
      const fieldToColumn = (entity: string, field: string): string => {
        const mapping: Record<string, string> = {
          'finalSalesPriceUSD': 'final_sales_price_usd',
          'finalTotalCostUSD': 'final_total_cost_usd',
          'purchPriceUSD': 'purch_price_usd',
          'partsCostUSD': 'parts_cost_usd',
          'freightChargesUSD': 'freight_charges_usd',
          'resourceCostUSD': 'resource_cost_usd',
          'invoicingName': 'invoicing_name',
          'vendName': 'vend_name',
          'gradeCondition': 'grade_condition',
          'transType': 'trans_type',
          'modelNum': 'model_num',
          'invoiceDate': 'invoice_date',
          'salesOrderDate': 'sales_order_date',
          'purchDate': 'purch_date',
          'inventSerialId': 'invent_serial_id',
          'dataAreaId': 'data_area_id',
          'itemId': 'item_id',
          'rmaNumber': 'rma_number',
          'rmaStatus': 'rma_status',
          'reasonForReturn': 'reason_for_return',
          'lineStatus': 'line_status',
          'lineSolution': 'line_solution',
          'finalCustomer': 'final_customer',
          'caseCustomer': 'case_customer',
          'typeOfUnit': 'type_of_unit',
          'createdOn': 'created_on',
          'itemReceivedDate': 'item_received_date',
          'dispatchDate': 'dispatch_date',
          'serialId': 'serial_id',
          'areaId': 'area_id',
          'relatedOrderName': 'related_order_name',
          'finalResellerName': 'final_reseller_name',
          'finalDistributorName': 'final_distributor_name',
          'opportunityNumber': 'opportunity_number',
          'caseId': 'case_id',
          'rmaLineName': 'rma_line_name',
          'rmaLineStatus': 'rma_line_status',
          'rmaLineSolution': 'rma_line_solution',
        };
        const prefix = entity === 'inventory' ? 'i' : 'r';
        return `${prefix}.${mapping[field] || field.toLowerCase()}`;
      };

      // Track row and column dimension aliases for pivoting
      const rowDimensionAliases: string[] = [];
      const columnDimensionAliases: string[] = [];

      // Add row dimensions to SELECT and GROUP BY
      for (const dim of config.dimensions) {
        const colRef = fieldToColumn(dim.column.entity, dim.column.field);
        selectParts.push(`UPPER(COALESCE(${colRef}::text, 'Unknown')) as "${dim.alias}"`);
        groupByParts.push(`UPPER(COALESCE(${colRef}::text, 'Unknown'))`);
        rowDimensionAliases.push(dim.alias);
      }

      // Add column dimensions to SELECT and GROUP BY (for pivoting)
      const columnDimensions = config.columnDimensions || [];
      for (const dim of columnDimensions) {
        const colRef = fieldToColumn(dim.column.entity, dim.column.field);
        selectParts.push(`UPPER(COALESCE(${colRef}::text, 'Unknown')) as "${dim.alias}"`);
        groupByParts.push(`UPPER(COALESCE(${colRef}::text, 'Unknown'))`);
        columnDimensionAliases.push(dim.alias);
      }

      // Add measures to SELECT
      for (const measure of config.measures) {
        const colRef = fieldToColumn(measure.column.entity, measure.column.field);
        let aggExpr = '';
        switch (measure.aggregation) {
          case 'SUM':
            aggExpr = `COALESCE(SUM(CAST(${colRef} AS numeric)), 0)`;
            break;
          case 'AVG':
            aggExpr = `COALESCE(AVG(CAST(${colRef} AS numeric)), 0)`;
            break;
          case 'COUNT':
            aggExpr = `COUNT(*)`;
            break;
          case 'COUNT_DISTINCT':
            aggExpr = `COUNT(DISTINCT ${colRef})`;
            break;
          case 'MIN':
            aggExpr = `MIN(CAST(${colRef} AS numeric))`;
            break;
          case 'MAX':
            aggExpr = `MAX(CAST(${colRef} AS numeric))`;
            break;
          default:
            aggExpr = colRef;
        }
        selectParts.push(`${aggExpr} as "${measure.alias}"`);
      }

      // Build FROM clause with dynamic JOIN construction
      // If only returns is referenced (no inventory), use returns as primary table
      const onlyReturnsReferenced = returnsReferenced && !inventoryReferenced;
      let fromClause = onlyReturnsReferenced ? 'FROM returns r' : 'FROM inventory i';
      const hasReturns = config.entities.includes('returns');
      let joinWarnings: string[] = [];
      
      if (hasReturns && config.relationships.length > 0) {
        const rel = config.relationships[0];
        
        // Filter out incomplete conditions server-side (safety net)
        const validConditions = (rel.conditions || []).filter(
          (c: any) => c.leftField && c.rightField
        );
        
        // Only process enabled relationships with valid conditions
        if (rel.enabled && validConditions.length > 0) {
          // Map join type to SQL
          let joinSQL = '';
          switch (rel.joinType) {
            case 'inner':
              joinSQL = 'INNER JOIN';
              break;
            case 'left':
              joinSQL = 'LEFT JOIN';
              break;
            case 'right':
              joinSQL = 'RIGHT JOIN';
              break;
            case 'first':
              // First = LATERAL subquery with LIMIT 1
              joinSQL = 'LEFT JOIN LATERAL';
              break;
            case 'exists':
              // Exists = will be handled separately in WHERE
              break;
            default:
              joinSQL = 'LEFT JOIN';
          }
          
          // Build ON conditions from user-defined field mappings
          const onConditions: string[] = [];
          for (const cond of validConditions) {
            const leftCol = fieldToColumn(rel.leftEntity, cond.leftField);
            const rightCol = fieldToColumn(rel.rightEntity, cond.rightField);
            const comparator = cond.comparator || '=';
            onConditions.push(`${leftCol} ${comparator} ${rightCol}`);
          }
          
          if (rel.joinType === 'exists') {
            // EXISTS check - will add to WHERE clause later
            const existsConditions = onConditions.join(' AND ');
            fromClause += ''; // No join clause for EXISTS
            // We'll add EXISTS subquery to whereConditions below
          } else if (rel.joinType === 'first') {
            // LATERAL join with LIMIT 1 for "first match" semantics
            const lateralConditions = onConditions.join(' AND ');
            fromClause += ` LEFT JOIN LATERAL (
              SELECT * FROM returns r2 
              WHERE ${lateralConditions.replace(/r\./g, 'r2.').replace(/i\./g, 'i.')}
              LIMIT 1
            ) r ON true`;
          } else {
            // Standard join with user-defined conditions
            fromClause += ` ${joinSQL} returns r ON ${onConditions.join(' AND ')}`;
          }
        }
      }

      // Build WHERE clause from filters
      const whereConditions: string[] = [];
      
      // Add EXISTS subquery if join type is 'exists'
      if (hasReturns && config.relationships.length > 0) {
        const rel = config.relationships[0];
        const validExistsConditions = (rel.conditions || []).filter((c: any) => c.leftField && c.rightField);
        if (rel.enabled && rel.joinType === 'exists' && validExistsConditions.length > 0) {
          const existsConditions: string[] = [];
          for (const cond of validExistsConditions) {
            const leftCol = fieldToColumn(rel.leftEntity, cond.leftField);
            const rightCol = cond.rightField.replace(/^r\./, 're.');
            existsConditions.push(`${leftCol} ${cond.comparator || '='} re.${rightCol.replace('r.', '')}`);
          }
          whereConditions.push(`EXISTS (SELECT 1 FROM returns re WHERE ${existsConditions.join(' AND ')})`);
        }
      }
      
      for (const filter of config.filters) {
        const colRef = fieldToColumn(filter.column.entity, filter.column.field);
        const escapeValue = (v: string | number) => String(v).replace(/'/g, "''");
        const isDateColumn = filter.column.type === 'date';
        const isNumericColumn = filter.column.type === 'numeric';
        
        switch (filter.operator) {
          case 'equals':
            whereConditions.push(`${colRef} = '${escapeValue(filter.value)}'`);
            break;
          case 'not_equals':
            whereConditions.push(`${colRef} != '${escapeValue(filter.value)}'`);
            break;
          case 'contains':
            whereConditions.push(`${colRef} ILIKE '%${escapeValue(filter.value)}%'`);
            break;
          case 'starts_with':
            whereConditions.push(`${colRef} ILIKE '${escapeValue(filter.value)}%'`);
            break;
          case 'ends_with':
            whereConditions.push(`${colRef} ILIKE '%${escapeValue(filter.value)}'`);
            break;
          case 'greater_than':
            if (isDateColumn) {
              whereConditions.push(`${colRef}::date > '${escapeValue(filter.value)}'::date`);
            } else {
              whereConditions.push(`CAST(${colRef} AS numeric) > ${filter.value}`);
            }
            break;
          case 'less_than':
            if (isDateColumn) {
              whereConditions.push(`${colRef}::date < '${escapeValue(filter.value)}'::date`);
            } else {
              whereConditions.push(`CAST(${colRef} AS numeric) < ${filter.value}`);
            }
            break;
          case 'greater_equal':
            if (isDateColumn) {
              whereConditions.push(`${colRef}::date >= '${escapeValue(filter.value)}'::date`);
            } else {
              whereConditions.push(`CAST(${colRef} AS numeric) >= ${filter.value}`);
            }
            break;
          case 'less_equal':
            if (isDateColumn) {
              whereConditions.push(`${colRef}::date <= '${escapeValue(filter.value)}'::date`);
            } else {
              whereConditions.push(`CAST(${colRef} AS numeric) <= ${filter.value}`);
            }
            break;
          case 'between':
            if (Array.isArray(filter.value) && filter.value.length >= 2) {
              const [v1, v2] = filter.value;
              if (isDateColumn) {
                whereConditions.push(`${colRef}::date BETWEEN '${escapeValue(v1)}'::date AND '${escapeValue(v2)}'::date`);
              } else if (isNumericColumn) {
                whereConditions.push(`CAST(${colRef} AS numeric) BETWEEN ${v1} AND ${v2}`);
              } else {
                whereConditions.push(`${colRef} BETWEEN '${escapeValue(v1)}' AND '${escapeValue(v2)}'`);
              }
            }
            break;
          case 'is_null':
            whereConditions.push(`${colRef} IS NULL`);
            break;
          case 'is_not_null':
            whereConditions.push(`${colRef} IS NOT NULL`);
            break;
          case 'in':
            let inValues: string[] = [];
            if (Array.isArray(filter.value)) {
              inValues = (filter.value as (string | number)[]).map(v => String(v));
            } else if (typeof filter.value === 'string') {
              inValues = filter.value.split(',').map(v => v.trim()).filter(v => v);
            }
            if (inValues.length > 0) {
              const vals = inValues.map(v => `'${escapeValue(v).toUpperCase()}'`).join(',');
              whereConditions.push(`UPPER(${colRef}::text) IN (${vals})`);
            }
            break;
          case 'not_in':
            let notInValues: string[] = [];
            if (Array.isArray(filter.value)) {
              notInValues = (filter.value as (string | number)[]).map(v => String(v));
            } else if (typeof filter.value === 'string') {
              notInValues = filter.value.split(',').map(v => v.trim()).filter(v => v);
            }
            if (notInValues.length > 0) {
              const vals = notInValues.map(v => `'${escapeValue(v).toUpperCase()}'`).join(',');
              whereConditions.push(`UPPER(${colRef}::text) NOT IN (${vals})`);
            }
            break;
        }
      }
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Build ORDER BY clause
      let orderByClause = '';
      if (config.sorts.length > 0) {
        const sortParts = config.sorts.map(s => {
          const dir = s.direction === 'desc' ? 'DESC' : 'ASC';
          return `"${s.columnId}" ${dir}`;
        });
        orderByClause = `ORDER BY ${sortParts.join(', ')}`;
      } else if (config.measures.length > 0) {
        orderByClause = `ORDER BY "${config.measures[0].alias}" DESC`;
      }

      // Build LIMIT clause
      const limitClause = `LIMIT ${config.limit || 100}`;

      // Construct final SQL
      const groupByClause = groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(', ')}` : '';
      const sqlQuery = `
        SELECT ${selectParts.join(', ')}
        ${fromClause}
        ${whereClause}
        ${groupByClause}
        ${orderByClause}
        ${limitClause}
      `;

      // Execute query
      const result = await pool.query(sqlQuery);
      const executionTime = Date.now() - startTime;

      // Process rows - convert Decimal objects to numbers
      const flatData = result.rows.map(row => {
        const processed: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          processed[key] = typeof row[key] === 'object' ? Number(row[key]) || row[key] : row[key];
        }
        return processed;
      });

      // Check if we need to pivot (have column dimensions)
      if (columnDimensionAliases.length > 0 && flatData.length > 0) {
        // Pivot the data in memory
        // Get unique column dimension values (capped at 25)
        const columnValueSets: Map<string, Set<string>> = new Map();
        for (const alias of columnDimensionAliases) {
          columnValueSets.set(alias, new Set());
        }
        
        for (const row of flatData) {
          for (const alias of columnDimensionAliases) {
            const valSet = columnValueSets.get(alias);
            if (valSet && valSet.size < 25) {
              valSet.add(String(row[alias] || 'Unknown'));
            }
          }
        }

        // Generate composite column keys (for multi-column dimensions)
        const colValueArrays = columnDimensionAliases.map(alias => 
          Array.from(columnValueSets.get(alias) || [])
        );
        
        // Create column header combinations
        const columnHeaders: string[] = [];
        const generateCombinations = (arrays: string[][], prefix: string[] = [], depth: number = 0): string[][] => {
          if (depth === arrays.length) return [prefix];
          const result: string[][] = [];
          for (const val of arrays[depth]) {
            result.push(...generateCombinations(arrays, [...prefix, val], depth + 1));
          }
          return result;
        };
        
        const combinations = generateCombinations(colValueArrays);
        for (const combo of combinations) {
          columnHeaders.push(combo.join(' | '));
        }

        // Build pivoted data
        const rowKeyToData = new Map<string, Record<string, any>>();
        
        // Create set of valid column keys for overflow handling
        const validColumnKeys = new Set(columnHeaders);

        for (const row of flatData) {
          // Build row key from row dimensions
          const rowKey = rowDimensionAliases.map(a => String(row[a] || '')).join('||');
          
          // Build column key from column dimensions
          let colKey = columnDimensionAliases.map(a => String(row[a] || 'Unknown')).join(' | ');
          
          // Handle overflow - if column key is not in valid set, map to "Other"
          if (!validColumnKeys.has(colKey)) {
            colKey = 'Other';
            if (!validColumnKeys.has('Other')) {
              columnHeaders.push('Other');
              validColumnKeys.add('Other');
            }
          }
          
          // Initialize row if needed
          if (!rowKeyToData.has(rowKey)) {
            const newRow: Record<string, any> = {};
            for (const alias of rowDimensionAliases) {
              newRow[alias] = row[alias];
            }
            // Initialize all pivoted columns to 0/null
            for (const header of columnHeaders) {
              for (const measure of config.measures) {
                newRow[`${header} - ${measure.alias}`] = 0;
              }
            }
            rowKeyToData.set(rowKey, newRow);
          }
          
          // Set the pivoted values (aggregate for "Other" overflow)
          const pivotedRow = rowKeyToData.get(rowKey)!;
          for (const measure of config.measures) {
            const pivotColName = `${colKey} - ${measure.alias}`;
            const currentVal = pivotedRow[pivotColName] || 0;
            const newVal = row[measure.alias] || 0;
            // Aggregate overflow values
            pivotedRow[pivotColName] = colKey === 'Other' ? currentVal + newVal : newVal;
          }
        }

        // Build column metadata for pivoted result
        const pivotedColumns = [
          ...config.dimensions.map(d => ({ key: d.alias, label: d.alias, type: d.column.type })),
          ...columnHeaders.flatMap(header => 
            config.measures.map(m => ({ 
              key: `${header} - ${m.alias}`, 
              label: `${header} - ${m.alias}`, 
              type: 'numeric' 
            }))
          ),
        ];

        const pivotedData = Array.from(rowKeyToData.values());
        
        // Build warnings array
        const warnings: string[] = [];
        if (pivotedData.length === 0 && hasReturns && config.relationships.length > 0) {
          const rel = config.relationships[0];
          if (rel.enabled && rel.conditions && rel.conditions.length > 0) {
            warnings.push(`No matching records found with the configured join. Check if your field mappings are correct.`);
          }
        }
        
        const queryResult: QueryResult = {
          data: pivotedData,
          columns: pivotedColumns,
          rowCount: pivotedData.length,
          executionTime,
          warnings: warnings.length > 0 ? warnings : undefined,
        };

        res.json(queryResult);
        return;
      }

      // No pivoting needed - return flat data
      const columns = [
        ...config.dimensions.map(d => ({ key: d.alias, label: d.alias, type: d.column.type })),
        ...config.measures.map(m => ({ key: m.alias, label: m.alias, type: 'numeric' })),
      ];

      // Build warnings array
      const warnings: string[] = [];
      if (flatData.length === 0 && hasReturns && config.relationships.length > 0) {
        const rel = config.relationships[0];
        if (rel.enabled && rel.conditions && rel.conditions.length > 0) {
          warnings.push(`No matching records found with the configured join. Check if your field mappings are correct.`);
        }
      }

      const queryResult: QueryResult = {
        data: flatData,
        columns,
        rowCount: flatData.length,
        executionTime,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      res.json(queryResult);
    } catch (error: any) {
      console.error("Error executing query builder:", error);
      res.status(500).json({ error: error.message || "Failed to execute query" });
    }
  });

  // Generate AI interpretation for query results
  app.post("/api/query-builder/interpret", requireAuth, async (req: Request, res: Response) => {
    try {
      const { config, result, chartConfig } = req.body as {
        config: QueryBuilderConfig;
        result: QueryResult;
        chartConfig?: ChartConfig;
      };

      // Build context for AI
      const dimensionNames = config.dimensions.map(d => d.alias).join(', ');
      const measureNames = config.measures.map(m => `${m.alias} (${m.aggregation})`).join(', ');
      const dataPreview = result.data.slice(0, 10);

      let interpretation: QueryAIInterpretation;

      if (openai) {
        try {
          const prompt = `You are a business intelligence analyst. Analyze this custom query result and provide executive insights.

Query Configuration:
- Name: ${config.name}
- Description: ${config.description || 'No description'}
- Dimensions (grouping): ${dimensionNames}
- Measures (metrics): ${measureNames}
- Chart Type: ${chartConfig?.type || 'table'}
- Rows returned: ${result.rowCount}

Sample Data (first 10 rows):
${JSON.stringify(dataPreview, null, 2)}

Provide a JSON response with:
{
  "summary": "One paragraph executive summary of what this data shows",
  "insights": ["Array of 3-4 key business insights from the data"],
  "recommendations": ["Array of 2-3 actionable recommendations based on findings"],
  "trends": ["Array of any notable trends or patterns observed"]
}`;

          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 1000,
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            interpretation = {
              summary: parsed.summary || 'Analysis complete.',
              insights: parsed.insights || [],
              recommendations: parsed.recommendations || [],
              trends: parsed.trends || [],
              generatedAt: new Date().toISOString(),
            };
          } else {
            throw new Error('No content from AI');
          }
        } catch (aiError) {
          console.error("AI interpretation error:", aiError);
          interpretation = generateFallbackInterpretation(config, result);
        }
      } else {
        interpretation = generateFallbackInterpretation(config, result);
      }

      res.json(interpretation);
    } catch (error: any) {
      console.error("Error generating interpretation:", error);
      res.status(500).json({ error: "Failed to generate interpretation" });
    }
  });

  // Helper function for fallback interpretation
  function generateFallbackInterpretation(config: QueryBuilderConfig, result: QueryResult): QueryAIInterpretation {
    const insights: string[] = [];
    const recommendations: string[] = [];
    
    if (result.rowCount > 0) {
      insights.push(`Query returned ${result.rowCount} result rows grouped by ${config.dimensions.map(d => d.alias).join(', ')}.`);
      
      // Find top performer if there are measures
      if (config.measures.length > 0 && result.data.length > 0) {
        const topRow = result.data[0];
        const firstMeasure = config.measures[0].alias;
        insights.push(`Top performer: ${topRow[config.dimensions[0]?.alias] || 'Unknown'} with ${firstMeasure} of ${Number(topRow[firstMeasure] || 0).toLocaleString()}.`);
      }
      
      recommendations.push('Consider drilling deeper into top performers to identify success factors.');
      recommendations.push('Compare these results with previous time periods for trend analysis.');
    } else {
      insights.push('No data matched the specified query criteria.');
      recommendations.push('Try adjusting your filters to broaden the search scope.');
    }

    return {
      summary: `This custom analysis examines ${config.measures.map(m => m.alias).join(', ')} across ${config.dimensions.map(d => d.alias).join(', ')}. ${insights[0]}`,
      insights,
      recommendations,
      trends: [],
      generatedAt: new Date().toISOString(),
    };
  }

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

  // ============================================
  // PREDICTIVE ANALYTICS - Forecasting Module
  // ============================================

  // Helper function to calculate moving averages
  function calculateMovingAverage(data: number[], period: number): (number | null)[] {
    return data.map((_, index) => {
      if (index < period - 1) return null;
      const sum = data.slice(index - period + 1, index + 1).reduce((a, b) => a + b, 0);
      return sum / period;
    });
  }

  // Helper function for linear regression
  function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * data[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = data.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssPredicted = x.reduce((sum, xi, i) => {
      const predicted = slope * xi + intercept;
      return sum + Math.pow(predicted - yMean, 2);
    }, 0);
    const r2 = ssTotal > 0 ? ssPredicted / ssTotal : 0;
    
    return { slope, intercept, r2: Math.min(1, Math.max(0, r2)) };
  }

  // Helper function to analyze trend
  function analyzeTrend(data: number[]): { direction: string; strength: number; changePercent: number; periodOverPeriod: number } {
    if (data.length < 2) {
      return { direction: 'stable', strength: 50, changePercent: 0, periodOverPeriod: 0 };
    }
    
    const { slope, r2 } = linearRegression(data);
    const avgValue = data.reduce((a, b) => a + b, 0) / data.length;
    const changePercent = avgValue > 0 ? ((data[data.length - 1] - data[0]) / data[0]) * 100 : 0;
    const periodOverPeriod = data.length >= 2 && data[data.length - 2] > 0 
      ? ((data[data.length - 1] - data[data.length - 2]) / data[data.length - 2]) * 100 
      : 0;
    
    // Determine direction based on slope and volatility
    const volatility = Math.sqrt(data.reduce((sum, v) => sum + Math.pow(v - avgValue, 2), 0) / data.length) / avgValue;
    
    let direction: string;
    if (volatility > 0.3) {
      direction = 'volatile';
    } else if (Math.abs(slope) < avgValue * 0.01) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }
    
    return {
      direction,
      strength: Math.round(r2 * 100),
      changePercent: Math.round(changePercent * 100) / 100,
      periodOverPeriod: Math.round(periodOverPeriod * 100) / 100,
    };
  }

  // Helper function to detect seasonality
  function detectSeasonality(data: { period: string; value: number }[]): {
    detected: boolean;
    peakPeriods: string[];
    troughPeriods: string[];
    seasonalityStrength: number;
    description: string;
  } {
    if (data.length < 6) {
      return {
        detected: false,
        peakPeriods: [],
        troughPeriods: [],
        seasonalityStrength: 0,
        description: 'Insufficient data for seasonality detection',
      };
    }
    
    const values = data.map(d => d.value);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Find peaks (above 1.2x average) and troughs (below 0.8x average)
    const peakPeriods: string[] = [];
    const troughPeriods: string[] = [];
    
    data.forEach(d => {
      if (d.value > avgValue * 1.2) {
        peakPeriods.push(d.period);
      } else if (d.value < avgValue * 0.8) {
        troughPeriods.push(d.period);
      }
    });
    
    const detected = peakPeriods.length > 0 || troughPeriods.length > 0;
    const seasonalityStrength = detected 
      ? Math.min(1, (peakPeriods.length + troughPeriods.length) / data.length * 2) 
      : 0;
    
    return {
      detected,
      peakPeriods: peakPeriods.slice(0, 3),
      troughPeriods: troughPeriods.slice(0, 3),
      seasonalityStrength,
      description: detected 
        ? `Seasonal patterns detected with ${peakPeriods.length} peak periods and ${troughPeriods.length} trough periods`
        : 'No significant seasonal patterns detected',
    };
  }

  // Main predictive analytics endpoint
  app.get("/api/predictive/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      // Get monthly revenue and volume data for forecasting
      const monthlyData = await db.select({
        month: sql<string>`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        profit: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)) - SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .where(isNotNull(inventory.invoiceDate))
        .groupBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(TO_DATE(${inventory.invoiceDate}, 'YYYY-MM-DD'), 'YYYY-MM')`);

      // Get returns data by month
      const monthlyReturns = await db.select({
        month: sql<string>`TO_CHAR(TO_DATE(${returns.createdOn}, 'YYYY-MM-DD'), 'YYYY-MM')`,
        returnCount: count(),
      }).from(returns)
        .where(isNotNull(returns.createdOn))
        .groupBy(sql`TO_CHAR(TO_DATE(${returns.createdOn}, 'YYYY-MM-DD'), 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(TO_DATE(${returns.createdOn}, 'YYYY-MM-DD'), 'YYYY-MM')`);

      // Get category-level data
      const categoryData = await db.select({
        category: sql<string>`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        cost: sql<number>`COALESCE(SUM(CAST(${inventory.finalTotalCostUSD} as numeric)), 0)`,
        units: count(),
      }).from(inventory)
        .groupBy(sql`UPPER(COALESCE(${inventory.category}, 'UNKNOWN'))`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`));

      // Get customer data for churn analysis
      const customerData = await db.select({
        customer: sql<string>`UPPER(${inventory.invoicingName})`,
        lastOrder: sql<string>`MAX(${inventory.invoiceDate})`,
        revenue: sql<number>`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`,
        orderCount: sql<number>`COUNT(DISTINCT ${inventory.salesId})`,
      }).from(inventory)
        .where(and(isNotNull(inventory.invoicingName), ne(inventory.invoicingName, "")))
        .groupBy(sql`UPPER(${inventory.invoicingName})`)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${inventory.finalSalesPriceUSD} as numeric)), 0)`))
        .limit(100);

      // Process revenue data for forecasting
      const revenueValues = monthlyData.map(d => Number(d.revenue) || 0).filter(v => v > 0);
      const unitValues = monthlyData.map(d => Number(d.units) || 0).filter(v => v > 0);
      const profitValues = monthlyData.map(d => Number(d.profit) || 0);

      // Calculate trends
      const revenueTrend = analyzeTrend(revenueValues);
      const volumeTrend = analyzeTrend(unitValues);
      
      // Calculate moving averages for revenue
      const ma3 = calculateMovingAverage(revenueValues, 3);
      const ma6 = calculateMovingAverage(revenueValues, 6);
      const ma12 = calculateMovingAverage(revenueValues, 12);

      // Linear regression for forecasting
      const revenueRegression = linearRegression(revenueValues);
      const volumeRegression = linearRegression(unitValues);

      // Generate forecast points (next 3 months)
      const forecastMonths = 3;
      const lastMonth = monthlyData[monthlyData.length - 1]?.month || new Date().toISOString().slice(0, 7);
      const forecastPoints: { period: string; predicted: number; lowerBound: number; upperBound: number }[] = [];
      
      for (let i = 1; i <= forecastMonths; i++) {
        const date = new Date(lastMonth + '-01');
        date.setMonth(date.getMonth() + i);
        const period = date.toISOString().slice(0, 7);
        const predicted = revenueRegression.slope * (revenueValues.length + i) + revenueRegression.intercept;
        const stdDev = Math.sqrt(revenueValues.reduce((s, v, idx) => {
          const pred = revenueRegression.slope * idx + revenueRegression.intercept;
          return s + Math.pow(v - pred, 2);
        }, 0) / revenueValues.length);
        
        forecastPoints.push({
          period,
          predicted: Math.max(0, predicted),
          lowerBound: Math.max(0, predicted - 1.96 * stdDev),
          upperBound: predicted + 1.96 * stdDev,
        });
      }

      // Calculate return rate trend
      const salesByMonth = new Map(monthlyData.map(d => [d.month, Number(d.units)]));
      const returnsByMonth = new Map(monthlyReturns.map(d => [d.month, Number(d.returnCount)]));
      const returnRates = monthlyData
        .filter(d => salesByMonth.get(d.month)! > 0)
        .map(d => {
          const sales = salesByMonth.get(d.month) || 1;
          const returns = returnsByMonth.get(d.month) || 0;
          return (returns / sales) * 100;
        });
      
      const returnRateTrend = analyzeTrend(returnRates);
      const currentReturnRate = returnRates[returnRates.length - 1] || 0;
      const avgReturnRate = returnRates.reduce((a, b) => a + b, 0) / returnRates.length || 0;

      // Calculate margin data
      const margins = monthlyData.map(d => {
        const rev = Number(d.revenue) || 0;
        const prof = Number(d.profit) || 0;
        return rev > 0 ? (prof / rev) * 100 : 0;
      }).filter(m => m !== 0);
      
      const marginTrend = analyzeTrend(margins);
      const currentMargin = margins[margins.length - 1] || 0;
      const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length || 0;

      // Customer churn analysis
      const today = new Date();
      const atRiskCustomers = customerData
        .filter(c => {
          if (!c.lastOrder) return false;
          const lastOrderDate = new Date(c.lastOrder);
          const daysSince = Math.floor((today.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSince > 90;
        })
        .map(c => ({
          customer: c.customer || 'Unknown',
          lastOrder: c.lastOrder || '',
          daysSinceLast: Math.floor((today.getTime() - new Date(c.lastOrder || today).getTime()) / (1000 * 60 * 60 * 24)),
          historicalRevenue: Number(c.revenue) || 0,
          churnProbability: Math.min(0.95, 0.3 + (Math.floor((today.getTime() - new Date(c.lastOrder || today).getTime()) / (1000 * 60 * 60 * 24)) - 90) / 180),
        }))
        .slice(0, 10);

      // Category-level forecasts
      const categoryForecasts = categoryData.slice(0, 10).map(c => {
        const revenue = Number(c.revenue) || 0;
        const cost = Number(c.cost) || 0;
        const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
        const growthRate = revenueTrend.changePercent / 100;
        
        return {
          category: c.category || 'Unknown',
          currentMargin: Math.round(margin * 100) / 100,
          predictedMargin: Math.round((margin + marginTrend.periodOverPeriod) * 100) / 100,
          trend: marginTrend.direction === 'increasing' ? 'improving' as const : 
                 marginTrend.direction === 'decreasing' ? 'declining' as const : 'stable' as const,
          currentTrend: revenueTrend,
          nextPeriodForecast: Math.round(revenue * (1 + growthRate / 12)),
          growthRate: Math.round(growthRate * 100),
        };
      });

      // Build key predictions summary
      const nextMonthRevenue = forecastPoints[0]?.predicted || revenueValues[revenueValues.length - 1] || 0;
      const currentRevenue = revenueValues[revenueValues.length - 1] || 0;
      
      const keyPredictions = [
        {
          metric: 'Monthly Revenue',
          currentValue: currentRevenue,
          predictedValue: nextMonthRevenue,
          changePercent: currentRevenue > 0 ? ((nextMonthRevenue - currentRevenue) / currentRevenue) * 100 : 0,
          confidence: Math.round(revenueRegression.r2 * 100),
          direction: nextMonthRevenue > currentRevenue ? 'up' as const : nextMonthRevenue < currentRevenue ? 'down' as const : 'stable' as const,
          impact: nextMonthRevenue > currentRevenue ? 'positive' as const : nextMonthRevenue < currentRevenue ? 'negative' as const : 'neutral' as const,
        },
        {
          metric: 'Profit Margin',
          currentValue: currentMargin,
          predictedValue: currentMargin + marginTrend.periodOverPeriod,
          changePercent: marginTrend.periodOverPeriod,
          confidence: marginTrend.strength,
          direction: marginTrend.direction === 'increasing' ? 'up' as const : marginTrend.direction === 'decreasing' ? 'down' as const : 'stable' as const,
          impact: marginTrend.direction === 'increasing' ? 'positive' as const : marginTrend.direction === 'decreasing' ? 'negative' as const : 'neutral' as const,
        },
        {
          metric: 'Return Rate',
          currentValue: currentReturnRate,
          predictedValue: currentReturnRate + returnRateTrend.periodOverPeriod,
          changePercent: returnRateTrend.periodOverPeriod,
          confidence: returnRateTrend.strength,
          direction: returnRateTrend.direction === 'increasing' ? 'up' as const : returnRateTrend.direction === 'decreasing' ? 'down' as const : 'stable' as const,
          impact: returnRateTrend.direction === 'decreasing' ? 'positive' as const : returnRateTrend.direction === 'increasing' ? 'negative' as const : 'neutral' as const,
        },
        {
          metric: 'Sales Volume',
          currentValue: unitValues[unitValues.length - 1] || 0,
          predictedValue: volumeRegression.slope * (unitValues.length + 1) + volumeRegression.intercept,
          changePercent: volumeTrend.periodOverPeriod,
          confidence: Math.round(volumeRegression.r2 * 100),
          direction: volumeTrend.direction === 'increasing' ? 'up' as const : volumeTrend.direction === 'decreasing' ? 'down' as const : 'stable' as const,
          impact: volumeTrend.direction === 'increasing' ? 'positive' as const : volumeTrend.direction === 'decreasing' ? 'negative' as const : 'neutral' as const,
        },
      ];

      // Build response
      const response = {
        generatedAt: new Date().toISOString(),
        forecastPeriod: 'Next 3 months',
        dataQuality: {
          historicalMonths: monthlyData.length,
          dataCompleteness: Math.min(100, (monthlyData.length / 12) * 100),
          reliabilityScore: Math.round((revenueRegression.r2 + volumeRegression.r2) / 2 * 100),
        },
        revenueForecast: {
          historicalData: monthlyData.map(d => ({
            period: d.month || '',
            actual: Number(d.revenue) || 0,
            predicted: null,
            isForecasted: false,
          })),
          forecastData: forecastPoints.map(f => ({
            period: f.period,
            actual: null,
            predicted: f.predicted,
            lowerBound: f.lowerBound,
            upperBound: f.upperBound,
            isForecasted: true,
          })),
          trend: {
            ...revenueTrend,
            description: `Revenue is ${revenueTrend.direction} with ${revenueTrend.strength}% confidence. ${revenueTrend.changePercent > 0 ? 'Growth' : 'Decline'} of ${Math.abs(revenueTrend.changePercent).toFixed(1)}% over the analysis period.`,
          },
          seasonality: detectSeasonality(monthlyData.map(d => ({ period: d.month || '', value: Number(d.revenue) || 0 }))),
          movingAverages: monthlyData.map((d, i) => ({
            period: d.month || '',
            value: Number(d.revenue) || 0,
            ma3: ma3[i],
            ma6: ma6[i],
            ma12: ma12[i],
          })),
          nextPeriodPrediction: forecastPoints[0]?.predicted || 0,
          nextQuarterPrediction: forecastPoints.reduce((sum, f) => sum + f.predicted, 0),
          confidenceLevel: Math.round(revenueRegression.r2 * 100),
          modelAccuracy: Math.round(revenueRegression.r2 * 100),
        },
        salesVolumeForecast: {
          historicalData: monthlyData.map(d => ({
            period: d.month || '',
            actual: Number(d.units) || 0,
            predicted: null,
            isForecasted: false,
          })),
          forecastData: [],
          trend: {
            ...volumeTrend,
            description: `Sales volume is ${volumeTrend.direction} with ${volumeTrend.changePercent.toFixed(1)}% change over the period.`,
          },
          seasonality: detectSeasonality(monthlyData.map(d => ({ period: d.month || '', value: Number(d.units) || 0 }))),
          byCategory: categoryForecasts.map(c => ({
            category: c.category,
            currentTrend: c.currentTrend,
            nextPeriodForecast: c.nextPeriodForecast,
            growthRate: c.growthRate,
          })),
          byMake: [],
        },
        returnRateForecast: {
          historicalData: monthlyData.map((d, i) => ({
            period: d.month || '',
            actual: returnRates[i] || 0,
            predicted: null,
            isForecasted: false,
          })),
          forecastData: [],
          trend: {
            ...returnRateTrend,
            description: `Return rate is ${returnRateTrend.direction}. Current average is ${avgReturnRate.toFixed(2)}%.`,
          },
          currentRate: currentReturnRate,
          predictedRate: currentReturnRate + returnRateTrend.periodOverPeriod,
          riskLevel: currentReturnRate > 10 ? 'high' : currentReturnRate > 5 ? 'medium' : 'low',
          byCategory: categoryForecasts.map(c => ({
            category: c.category,
            currentRate: avgReturnRate,
            predictedRate: avgReturnRate + returnRateTrend.periodOverPeriod,
            trend: returnRateTrend.direction === 'decreasing' ? 'improving' as const : 
                   returnRateTrend.direction === 'increasing' ? 'worsening' as const : 'stable' as const,
          })),
          contributingFactors: [],
        },
        marginForecast: {
          historicalData: monthlyData.map((d, i) => ({
            period: d.month || '',
            actual: margins[i] || 0,
            predicted: null,
            isForecasted: false,
          })),
          forecastData: [],
          trend: {
            ...marginTrend,
            description: `Profit margin is ${marginTrend.direction}. Current margin is ${currentMargin.toFixed(2)}%, average is ${avgMargin.toFixed(2)}%.`,
          },
          currentMargin,
          predictedMargin: currentMargin + marginTrend.periodOverPeriod,
          marginPressureRisk: marginTrend.direction === 'decreasing' ? 'high' : marginTrend.direction === 'stable' ? 'medium' : 'low',
          byCategory: categoryForecasts.map(c => ({
            category: c.category,
            currentMargin: c.currentMargin,
            predictedMargin: c.predictedMargin,
            trend: c.trend,
          })),
          costPressureFactors: [],
        },
        customerForecast: {
          totalActiveCustomers: customerData.length,
          predictedNewCustomers: Math.round(customerData.length * 0.1),
          churnRisk: {
            atRiskCount: atRiskCustomers.length,
            atRiskRevenue: atRiskCustomers.reduce((sum, c) => sum + c.historicalRevenue, 0),
            customers: atRiskCustomers,
          },
          topGrowthCustomers: customerData.slice(0, 5).map(c => ({
            customer: c.customer || 'Unknown',
            currentRevenue: Number(c.revenue) || 0,
            projectedRevenue: (Number(c.revenue) || 0) * 1.1,
            growthRate: 10,
          })),
          revenueConcentrationRisk: {
            top5Percentage: customerData.length > 0 
              ? (customerData.slice(0, 5).reduce((s, c) => s + Number(c.revenue), 0) / 
                 customerData.reduce((s, c) => s + Number(c.revenue), 0)) * 100 
              : 0,
            trend: 'stable' as const,
            recommendation: 'Diversify customer base to reduce concentration risk',
          },
        },
        inventoryForecast: {
          currentTurnoverDays: 45,
          predictedTurnoverDays: 42,
          trend: volumeTrend,
          stockoutRisk: {
            riskLevel: 'low' as const,
            itemsAtRisk: 0,
            estimatedLostRevenue: 0,
          },
          overstockRisk: {
            riskLevel: 'low' as const,
            overstockedValue: 0,
            recommendations: ['Monitor slow-moving inventory', 'Consider promotional pricing for aging stock'],
          },
          byCategory: categoryForecasts.map(c => ({
            category: c.category,
            currentDays: 45,
            predictedDays: 42,
            trend: 'stable' as const,
          })),
        },
        keyPredictions,
      };

      res.json(response);
    } catch (error) {
      console.error("Error generating predictive analytics:", error);
      res.status(500).json({ error: "Failed to generate predictive analytics" });
    }
  });

  // AI interpretation for predictive analytics
  app.post("/api/predictive/ai-insights", requireAuth, async (req: Request, res: Response) => {
    try {
      const { keyPredictions, revenueForecast, marginForecast, returnRateForecast, customerForecast } = req.body;

      if (!openai) {
        // Generate rule-based insights
        const insights = {
          summary: `Based on historical data analysis, the business shows ${revenueForecast?.trend?.direction || 'stable'} revenue trends with ${marginForecast?.marginPressureRisk || 'moderate'} margin pressure risk.`,
          opportunities: [
            'Focus on high-performing product categories to maximize growth',
            'Implement customer retention programs for at-risk accounts',
            'Optimize inventory levels based on demand forecasts',
          ],
          risks: [
            keyPredictions?.find((p: any) => p.metric === 'Return Rate' && p.direction === 'up') 
              ? 'Increasing return rates may impact profitability' : null,
            marginForecast?.marginPressureRisk === 'high' 
              ? 'Margin pressure requires cost optimization strategies' : null,
            customerForecast?.churnRisk?.atRiskCount > 5 
              ? `${customerForecast.churnRisk.atRiskCount} customers at risk of churn` : null,
          ].filter(Boolean),
          recommendations: [
            'Review pricing strategy for categories with declining margins',
            'Strengthen supplier relationships to reduce cost variability',
            'Develop proactive customer engagement for at-risk accounts',
          ],
        };
        
        return res.json(insights);
      }

      // Use OpenAI for sophisticated analysis
      const prompt = `You are a business intelligence analyst. Based on these predictive analytics results, provide a concise executive summary with actionable insights:

Key Predictions:
${JSON.stringify(keyPredictions, null, 2)}

Revenue Trend: ${revenueForecast?.trend?.description || 'Not available'}
Margin Trend: ${marginForecast?.trend?.description || 'Not available'}
Return Rate: ${returnRateForecast?.trend?.description || 'Not available'}
At-Risk Customers: ${customerForecast?.churnRisk?.atRiskCount || 0}

Provide a JSON response with:
- summary: 2-3 sentence executive summary
- opportunities: array of 3 specific growth opportunities
- risks: array of 2-3 key risks to monitor
- recommendations: array of 3-4 actionable recommendations`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      res.json(result);
    } catch (error) {
      console.error("Error generating AI insights for predictions:", error);
      res.status(500).json({ 
        summary: "Unable to generate AI insights at this time.",
        opportunities: [],
        risks: [],
        recommendations: ["Please try again later or review the forecasts manually."]
      });
    }
  });

  return httpServer;
}
