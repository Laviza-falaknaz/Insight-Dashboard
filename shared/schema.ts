import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, integer, serial, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Inventory table for local PostgreSQL storage
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  dataAreaId: text("data_area_id"),
  itemId: text("item_id"),
  inventSerialId: text("invent_serial_id"),
  dealRef: text("deal_ref"),
  purchPriceUSD: numeric("purch_price_usd", { precision: 18, scale: 2 }),
  purchDate: text("purch_date"),
  vendComments: text("vend_comments"),
  keyLang: text("key_lang"),
  osSticker: text("os_sticker"),
  displaySize: text("display_size"),
  lcdCostUSD: numeric("lcd_cost_usd", { precision: 18, scale: 2 }),
  storageSerialNum: text("storage_serial_num"),
  vendName: text("vend_name"),
  category: text("category"),
  madeIn: text("made_in"),
  gradeCondition: text("grade_condition"),
  partsCostUSD: numeric("parts_cost_usd", { precision: 18, scale: 2 }),
  fingerprintStr: text("fingerprint_str"),
  miscCostUSD: numeric("misc_cost_usd", { precision: 18, scale: 2 }),
  processorGen: text("processor_gen"),
  manufacturingDate: text("manufacturing_date"),
  purchaseCategory: text("purchase_category"),
  keyLayout: text("key_layout"),
  poNumber: text("po_number"),
  make: text("make"),
  processor: text("processor"),
  packagingCostUSD: numeric("packaging_cost_usd", { precision: 18, scale: 2 }),
  receivedDate: text("received_date"),
  itadTreesCostUSD: numeric("itad_trees_cost_usd", { precision: 18, scale: 2 }),
  storageType: text("storage_type"),
  soldAsHDD: text("sold_as_hdd"),
  standardisationCostUSD: numeric("standardisation_cost_usd", { precision: 18, scale: 2 }),
  comments: text("comments"),
  purchPriceRevisedUSD: numeric("purch_price_revised_usd", { precision: 18, scale: 2 }),
  status: text("status"),
  consumableCostUSD: numeric("consumable_cost_usd", { precision: 18, scale: 2 }),
  chassis: text("chassis"),
  journalNum: text("journal_num"),
  batteryCostUSD: numeric("battery_cost_usd", { precision: 18, scale: 2 }),
  ram: text("ram"),
  soldAsRAM: text("sold_as_ram"),
  freightChargesUSD: numeric("freight_charges_usd", { precision: 18, scale: 2 }),
  hdd: text("hdd"),
  coaCostUSD: numeric("coa_cost_usd", { precision: 18, scale: 2 }),
  manufacturerSerialNum: text("manufacturer_serial_num"),
  supplierPalletNum: text("supplier_pallet_num"),
  resourceCostUSD: numeric("resource_cost_usd", { precision: 18, scale: 2 }),
  customsDutyUSD: numeric("customs_duty_usd", { precision: 18, scale: 2 }),
  resolution: text("resolution"),
  modelNum: text("model_num"),
  invoiceAccount: text("invoice_account"),
  totalCostCurUSD: numeric("total_cost_cur_usd", { precision: 18, scale: 2 }),
  salesOrderDate: text("sales_order_date"),
  customerRef: text("customer_ref"),
  crmRef: text("crm_ref"),
  invoicingName: text("invoicing_name"),
  transType: text("trans_type"),
  salesInvoiceId: text("sales_invoice_id"),
  salesId: text("sales_id"),
  invoiceDate: text("invoice_date"),
  apinNumber: text("apin_number"),
  segregation: text("segregation"),
  finalSalesPriceUSD: numeric("final_sales_price_usd", { precision: 18, scale: 2 }),
  finalTotalCostUSD: numeric("final_total_cost_usd", { precision: 18, scale: 2 }),
  orderTaker: text("order_taker"),
  orderResponsible: text("order_responsible"),
  productSpecification: text("product_specification"),
  warrantyStartDate: text("warranty_start_date"),
  warrantyEndDate: text("warranty_end_date"),
  warrantyDescription: text("warranty_description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  inventoryCompositeUnique: uniqueIndex("inventory_composite_unique").on(
    table.inventSerialId, 
    table.dataAreaId, 
    table.itemId, 
    table.salesId, 
    table.transType
  ),
  invoiceDateIdx: index("inventory_invoice_date_idx").on(table.invoiceDate),
  statusIdx: index("inventory_status_idx").on(table.status),
  categoryIdx: index("inventory_category_idx").on(table.category),
  makeIdx: index("inventory_make_idx").on(table.make),
  invoicingNameIdx: index("inventory_invoicing_name_idx").on(table.invoicingName),
  vendNameIdx: index("inventory_vend_name_idx").on(table.vendName),
}));

export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

// Returns table for RMA/returns tracking
export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  finalCustomer: text("final_customer"),
  relatedOrderName: text("related_order_name"),
  caseId: text("case_id"),
  rmaNumber: text("rma_number"),
  reasonForReturn: text("reason_for_return"),
  createdOn: text("created_on"),
  warehouseNotes: text("warehouse_notes"),
  finalResellerName: text("final_reseller_name"),
  expectedShippingDate: text("expected_shipping_date"),
  rmaLineItemGuid: text("rma_line_item_guid"),
  rmaLineName: text("rma_line_name"),
  caseEndUser: text("case_end_user"),
  uaeWarehouseNotes: text("uae_warehouse_notes"),
  notesDescription: text("notes_description"),
  rmaGuid: text("rma_guid"),
  relatedSerialGuid: text("related_serial_guid"),
  modifiedOn: text("modified_on"),
  opportunityNumber: text("opportunity_number"),
  itemTestingDate: text("item_testing_date"),
  finalDistributorName: text("final_distributor_name"),
  caseCustomer: text("case_customer"),
  itemReceivedDate: text("item_received_date"),
  caseDescription: text("case_description"),
  dispatchDate: text("dispatch_date"),
  replacementSerialGuid: text("replacement_serial_guid"),
  rmaStatus: text("rma_status"),
  typeOfUnit: text("type_of_unit"),
  lineStatus: text("line_status"),
  lineSolution: text("line_solution"),
  uaeFinalOutcome: text("uae_final_outcome"),
  rmaTopicLabel: text("rma_topic_label"),
  ukFinalOutcome: text("uk_final_outcome"),
  serialId: text("serial_id"),
  areaId: text("area_id"),
  itemId: text("item_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  rmaLineItemGuidUnique: uniqueIndex("returns_rma_line_item_guid_unique").on(table.rmaLineItemGuid),
  rmaNumberIdx: index("returns_rma_number_idx").on(table.rmaNumber),
  rmaStatusIdx: index("returns_rma_status_idx").on(table.rmaStatus),
  createdOnIdx: index("returns_created_on_idx").on(table.createdOn),
  serialIdIdx: index("returns_serial_id_idx").on(table.serialId),
}));

export const insertReturnsSchema = createInsertSchema(returns).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReturns = z.infer<typeof insertReturnsSchema>;
export type Returns = typeof returns.$inferSelect;

// Data upload tracking
export const dataUploads = pgTable("data_uploads", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull().default("inventory"),
  recordsCount: integer("records_count").notNull(),
  insertedCount: integer("inserted_count").default(0),
  updatedCount: integer("updated_count").default(0),
  status: text("status").notNull().default("completed"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export type DataUpload = typeof dataUploads.$inferSelect;

// Inventory item type matching original SQL Server schema (for API compatibility)
export interface InventoryItem {
  dataAreaId: string | null;
  ItemId: string | null;
  InventSerialId: string | null;
  DealRef: string | null;
  PurchPriceUSD: number | null;
  PurchDate: string | null;
  VendComments: string | null;
  KeyLang: string | null;
  OsSticker: string | null;
  DisplaySize: string | null;
  LCDCostUSD: number | null;
  StorageSerialNum: string | null;
  VendName: string | null;
  Category: string | null;
  MadeIn: string | null;
  GradeCondition: string | null;
  PartsCostUSD: number | null;
  FingerprintStr: string | null;
  MiscCostUSD: number | null;
  ProcessorGen: string | null;
  ManufacturingDate: string | null;
  PurchaseCategory: string | null;
  KeyLayout: string | null;
  PONumber: string | null;
  Make: string | null;
  Processor: string | null;
  PackagingCostUSD: number | null;
  ReceivedDate: string | null;
  ITADTreesCostUSD: number | null;
  StorageType: string | null;
  SoldAsHDD: string | null;
  StandardisationCostUSD: number | null;
  Comments: string | null;
  PurchPriceRevisedUSD: number | null;
  Status: string | null;
  ConsumableCostUSD: number | null;
  Chassis: string | null;
  JournalNum: string | null;
  BatteryCostUSD: number | null;
  Ram: string | null;
  SoldAsRAM: string | null;
  FreightChargesUSD: number | null;
  HDD: string | null;
  COACostUSD: number | null;
  ManufacturerSerialNum: string | null;
  SupplierPalletNum: string | null;
  ResourceCostUSD: number | null;
  CustomsDutyUSD: number | null;
  Resolution: string | null;
  ModelNum: string | null;
  InvoiceAccount: string | null;
  TotalCostCurUSD: number | null;
  SalesOrderDate: string | null;
  CustomerRef: string | null;
  CRMRef: string | null;
  InvoicingName: string | null;
  TransType: string | null;
  SalesInvoiceId: string | null;
  SalesId: string | null;
  InvoiceDate: string | null;
  APINNumber: string | null;
  Segregation: string | null;
  FinalSalesPriceUSD: number | null;
  FinalTotalCostUSD: number | null;
  OrderTaker: string | null;
  OrderResponsible: string | null;
  ProductSpecification: string | null;
  WarrantyStartDate: string | null;
  WarrantyEndDate: string | null;
  WarrantyDescription: string | null;
}

// KPI Summary
export interface KPISummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  unitsSold: number;
  averageOrderValue: number;
  totalOrders: number;
}

// Time series data point
export interface TimeSeriesPoint {
  date: string;
  revenue: number;
  profit: number;
  cost: number;
  units: number;
}

// Category breakdown
export interface CategoryBreakdown {
  category: string;
  revenue: number;
  profit: number;
  units: number;
  count: number;
}

// Top performer (customer, product, vendor)
export interface TopPerformer {
  name: string;
  revenue: number;
  profit: number;
  units: number;
  count: number;
}

// Filter options
export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  status?: string[];
  category?: string[];
  make?: string[];
  customer?: string[];
  vendor?: string[];
  gradeCondition?: string[];
}

// Dashboard data response
export interface DashboardData {
  kpis: KPISummary;
  revenueOverTime: TimeSeriesPoint[];
  categoryBreakdown: CategoryBreakdown[];
  topCustomers: TopPerformer[];
  topProducts: TopPerformer[];
  topVendors: TopPerformer[];
  statusBreakdown: { status: string; count: number }[];
  gradeBreakdown: { grade: string; count: number }[];
}

// Filter dropdown options
export interface FilterDropdownOptions {
  statuses: string[];
  categories: string[];
  makes: string[];
  customers: string[];
  vendors: string[];
  grades: string[];
}
