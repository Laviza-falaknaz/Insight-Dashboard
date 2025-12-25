import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, integer, serial, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  themeId: text("theme_id").default("bootstrap"),
  isAdmin: text("is_admin").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Theme presets - 5 colors each (primary, info, success, warning, danger)
export const themePresets = {
  bootstrap: {
    name: "Bootstrap",
    colors: ["#337ab7", "#5bc0de", "#5cb85c", "#f0ad4e", "#d9534f"],
  },
  ocean: {
    name: "Ocean",
    colors: ["#0077b6", "#00b4d8", "#2a9d8f", "#e9c46a", "#e76f51"],
  },
  forest: {
    name: "Forest",
    colors: ["#2d6a4f", "#40916c", "#52b788", "#b7e4c7", "#d62828"],
  },
  sunset: {
    name: "Sunset",
    colors: ["#ff6b35", "#f7c59f", "#efa00b", "#d65108", "#591f0a"],
  },
  midnight: {
    name: "Midnight",
    colors: ["#6366f1", "#8b5cf6", "#a855f7", "#f59e0b", "#ef4444"],
  },
} as const;

export type ThemeId = keyof typeof themePresets;
export type ThemePreset = typeof themePresets[ThemeId];

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
  totalCostCurUSD: text("total_cost_cur_usd"),
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

// Executive Insight Types

// Freight Analysis
export interface FreightAlert {
  type: 'spike' | 'erosion' | 'concentration' | 'volatility';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  supplier?: string;
  category?: string;
  value: number;
  baseline?: number;
  percentChange?: number;
  affectedItems?: number;
  recommendation: string;
}

export interface FreightAnalysis {
  totalFreightCost: number;
  freightAsPercentOfCost: number;
  averageFreightPerUnit: number;
  freightBySupplier: { supplier: string; cost: number; itemCount: number; avgPerUnit: number }[];
  freightByCategory: { category: string; cost: number; itemCount: number; avgPerUnit: number }[];
  freightConcentrationRisk: number; // % from top 3 suppliers
  alerts: FreightAlert[];
}

// Inventory Aging
export interface AgingBucket {
  range: string;
  count: number;
  value: number;
  percentOfTotal: number;
}

export interface InventoryAgingAlert {
  type: 'dead_stock' | 'aging' | 'capital_lockup' | 'slow_moving';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  itemId?: string;
  category?: string;
  daysHeld?: number;
  value: number;
  recommendation: string;
}

export interface InventoryAgingAnalysis {
  totalInventoryValue: number;
  averageDaysHeld: number;
  agingBuckets: AgingBucket[];
  deadStockValue: number;
  deadStockCount: number;
  slowMovingValue: number;
  slowMovingCount: number;
  capitalLockupByCategory: { category: string; value: number; avgDays: number }[];
  alerts: InventoryAgingAlert[];
}

// Returns/RMA Analysis
export interface RMAAlert {
  type: 'early_failure' | 'repeat_failure' | 'supplier_quality' | 'margin_destroyed';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value?: number;
  affectedItems?: number;
  recommendation: string;
}

export interface ReturnsAnalysis {
  totalReturns: number;
  returnRate: number;
  returnsLast30Days: number;
  returnsByReason: { reason: string; count: number; percent: number }[];
  returnsByStatus: { status: string; count: number }[];
  topReturnCustomers: { customer: string; count: number; rate: number }[];
  earlyFailureCount: number; // RMAs within 30 days of sale
  repeatFailures: number; // Same serial multiple RMAs
  alerts: RMAAlert[];
}

// Supplier Quality
export interface SupplierQualityScore {
  supplier: string;
  qualityScore: number; // 0-100
  defectRate: number;
  returnRate: number;
  freightVariability: number;
  totalUnits: number;
  totalValue: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface SupplierAnalysis {
  totalSuppliers: number;
  topPerformers: SupplierQualityScore[];
  atRiskSuppliers: SupplierQualityScore[];
  concentrationRisk: number; // % from top 3
  topByVolume: { supplier: string; units: number; value: number }[];
}

// Margin Analysis
export interface MarginAlert {
  type: 'negative_margin' | 'margin_erosion' | 'price_pressure' | 'cost_overrun';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category?: string;
  product?: string;
  currentMargin: number;
  previousMargin?: number;
  impactValue: number;
  recommendation: string;
}

export interface MarginAnalysis {
  overallMargin: number;
  marginByCategory: { category: string; margin: number; revenue: number; profit: number }[];
  marginByMake: { make: string; margin: number; revenue: number; profit: number }[];
  negativeMarginItems: number;
  negativeMarginValue: number;
  marginTrend: { period: string; margin: number }[];
  alerts: MarginAlert[];
}

// Orders Analysis
export interface OrdersAnalysis {
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  averageOrderValue: number;
  itemsPerOrder: number;
  ordersByMonth: { month: string; orders: number; revenue: number; profit: number }[];
  ordersByCustomer: { customer: string; orders: number; revenue: number; profit: number; avgValue: number }[];
  ordersByStatus: { status: string; count: number; revenue: number }[];
  topOrdersByValue: { salesId: string; customer: string; value: number; items: number; date: string }[];
}

// Customer Analysis
export interface CustomerAnalysis {
  totalCustomers: number;
  totalRevenue: number;
  averageRevenuePerCustomer: number;
  topByRevenue: { customer: string; revenue: number; profit: number; margin: number; orders: number }[];
  topByProfit: { customer: string; revenue: number; profit: number; margin: number; orders: number }[];
  topByVolume: { customer: string; units: number; revenue: number; orders: number }[];
  customerConcentration: number; // % from top 5
  newCustomersLast90Days: number;
  atRiskCustomers: { customer: string; lastOrder: string; totalValue: number; daysSinceLast: number }[];
}

// Product Analysis
export interface ProductAnalysis {
  totalProducts: number;
  totalRevenue: number;
  topByRevenue: { product: string; make: string; revenue: number; profit: number; margin: number; units: number }[];
  topByProfit: { product: string; make: string; revenue: number; profit: number; margin: number; units: number }[];
  topByVolume: { product: string; make: string; units: number; revenue: number }[];
  productsByCategory: { category: string; products: number; revenue: number; units: number }[];
  slowMovers: { product: string; daysInStock: number; value: number; units: number }[];
  
  // Strategic product insights
  returnProneProducts?: {
    product: string;
    unitsSold: number;
    revenue: number;
    profit: number;
    margin: number;
    returnCount: number;
    returnRate: number;
    profitLost: number;
  }[];
  productCostBreakdown?: {
    product: string;
    units: number;
    revenue: number;
    purchaseCost: number;
    partsCost: number;
    freightCost: number;
    laborCost: number;
    totalCost: number;
    margin: number;
  }[];
  negativeMarginProducts?: {
    product: string;
    units: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }[];
}

// Executive Summary Dashboard
export interface ExecutiveSummary {
  kpis: KPISummary;
  criticalAlerts: (FreightAlert | InventoryAgingAlert | RMAAlert | MarginAlert)[];
  recentTrends: {
    revenueChange: number;
    profitChange: number;
    marginChange: number;
    returnRateChange: number;
    period: string;
  };
  quickInsights: {
    bestPerformingCategory: string;
    worstPerformingCategory: string;
    topCustomer: string;
    highestRiskSupplier: string;
  };
}

// Saved Collections - User saved drill-down queries
export const savedCollections = pgTable("saved_collections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  insightType: text("insight_type").notNull(), // 'freight', 'aging', 'margin', 'orders', 'customers', 'products', 'returns'
  queryConfig: text("query_config").notNull(), // JSON stringified filter/drill-down config
  chartType: text("chart_type"), // 'bar', 'pie', 'line', 'table'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSavedCollectionSchema = createInsertSchema(savedCollections).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSavedCollection = z.infer<typeof insertSavedCollectionSchema>;
export type SavedCollection = typeof savedCollections.$inferSelect;

// AI Insight request/response types
export interface AIInsightRequest {
  context: 'executive_summary' | 'freight' | 'inventory' | 'margins' | 'orders' | 'customers' | 'products' | 'returns';
  data: Record<string, any>;
}

export interface AIInsightResponse {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  generatedAt: string;
}

// PDF Report types
export interface PDFReportRequest {
  reportType: 'full_dashboard' | 'single_page';
  pageName?: string;
  includeCharts: boolean;
  dateRange?: { start: string; end: string };
}

// Drill-down query configuration
export interface DrillDownConfig {
  dimension: string; // e.g., 'category', 'customer', 'vendor', 'make'
  selectedValue?: string;
  filters: Record<string, string | string[]>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  groupBy?: string;
}

// ========== BI QUERY BUILDER TYPES ==========

// Available entities for query building
export type QueryEntity = 'inventory' | 'returns';

// Column definition for query builder
export interface QueryColumn {
  entity: QueryEntity;
  field: string;
  label: string;
  type: 'text' | 'numeric' | 'date';
  aggregatable: boolean;
}

// Aggregation types
export type AggregationType = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'COUNT_DISTINCT' | 'NONE';

// Filter operator types
export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 
  'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null';

// Query filter definition
export interface QueryFilter {
  id: string;
  column: QueryColumn;
  operator: FilterOperator;
  value: string | number | string[] | [number, number];
}

// Query measure (aggregated column)
export interface QueryMeasure {
  id: string;
  column: QueryColumn;
  aggregation: AggregationType;
  alias: string;
}

// Query dimension (grouping column)
export interface QueryDimension {
  id: string;
  column: QueryColumn;
  alias: string;
}

// Sort configuration
export interface QuerySort {
  columnId: string;
  direction: 'asc' | 'desc';
}

// Top/Bottom filter
export interface TopBottomFilter {
  enabled: boolean;
  type: 'top' | 'bottom';
  count: number;
  byColumn: string;
}

// Relationship configuration for joins
export interface QueryRelationship {
  fromEntity: QueryEntity;
  fromField: string;
  toEntity: QueryEntity;
  toField: string;
  type: 'inner' | 'left' | 'right';
}

// Complete query builder configuration
export interface QueryBuilderConfig {
  name: string;
  description?: string;
  entities: QueryEntity[];
  dimensions: QueryDimension[];
  measures: QueryMeasure[];
  filters: QueryFilter[];
  sorts: QuerySort[];
  topBottom?: TopBottomFilter;
  relationships: QueryRelationship[];
  limit: number;
}

// Chart configuration for visualization
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'table';

export interface ChartConfig {
  type: ChartType;
  xAxis?: string;
  yAxis?: string[];
  colorBy?: string;
  showLegend: boolean;
  showGrid: boolean;
}

// Query execution result
export interface QueryResult {
  data: Record<string, any>[];
  columns: { key: string; label: string; type: string }[];
  rowCount: number;
  executionTime: number;
  sql?: string;
}

// AI interpretation for query results
export interface QueryAIInterpretation {
  summary: string;
  insights: string[];
  recommendations: string[];
  trends?: string[];
  generatedAt: string;
}

// Complete saved query with AI interpretation
export interface SavedQueryWithInterpretation {
  collection: SavedCollection;
  lastResult?: QueryResult;
  interpretation?: QueryAIInterpretation;
  chartConfig?: ChartConfig;
}

// ========== STRATEGIC EXECUTIVE INSIGHTS ==========

// Sales with Returns Impact Analysis
// Only TransType='SalesOrder' joins to returns via (invent_serial_id, data_area_id, item_id, crm_ref) = (serial_id, area_id, item_id, sales_order_number)
export interface SalesReturnImpact {
  totalSalesUnits: number;
  totalSalesRevenue: number;
  totalSalesCost: number;
  totalSalesProfit: number;
  unitsWithReturns: number;
  unitsWithoutReturns: number;
  returnRate: number;
  revenueAtRisk: number; // Revenue from units that were returned
  profitLostToReturns: number;
  netRealizedProfit: number; // Profit after return impact
  adjustedMargin: number; // Margin after accounting for returns
}

// Profitability Waterfall - Shows how revenue becomes profit
export interface ProfitabilityWaterfall {
  grossRevenue: number;
  purchaseCost: number;
  partsCost: number;
  freightCost: number;
  laborCost: number; // resource + standardisation
  packagingCost: number;
  otherCosts: number; // misc, consumable, battery, LCD, COA
  grossProfit: number;
  returnImpact: number; // Profit lost to returns
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

// Customer Value Intelligence
export interface CustomerValueMetrics {
  customer: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  unitsSold: number;
  unitsReturned: number;
  returnRate: number;
  profitAfterReturns: number;
  netMargin: number;
  customerValue: 'platinum' | 'gold' | 'silver' | 'bronze' | 'at-risk';
  riskLevel: 'low' | 'medium' | 'high';
  orders: number;
  avgOrderValue: number;
  lastOrderDate: string | null;
}

export interface CustomerIntelligence {
  totalCustomers: number;
  platinumCustomers: CustomerValueMetrics[];
  atRiskCustomers: CustomerValueMetrics[];
  highReturnCustomers: CustomerValueMetrics[];
  customerConcentration: number; // Top 5 customers % of revenue
  avgCustomerLifetimeValue: number;
  avgReturnRate: number;
}

// Product Performance Matrix - Risk vs Reward
export interface ProductPerformanceMetrics {
  product: string;
  make: string;
  category: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMargin: number;
  unitsReturned: number;
  returnRate: number;
  profitAfterReturns: number;
  netMargin: number;
  riskScore: number; // Based on return rate and margin
  rewardScore: number; // Based on volume and profit
  quadrant: 'star' | 'cash-cow' | 'question-mark' | 'dog';
}

export interface ProductIntelligence {
  totalProducts: number;
  totalModels: number;
  stars: ProductPerformanceMetrics[]; // High profit, low risk
  cashCows: ProductPerformanceMetrics[]; // Moderate profit, low risk
  questionMarks: ProductPerformanceMetrics[]; // High potential, high risk
  dogs: ProductPerformanceMetrics[]; // Low profit, high risk
  categoryPerformance: {
    category: string;
    revenue: number;
    profit: number;
    margin: number;
    returnRate: number;
    units: number;
  }[];
  makePerformance: {
    make: string;
    revenue: number;
    profit: number;
    margin: number;
    returnRate: number;
    units: number;
  }[];
}

// Regional Performance (UAE vs UK)
export interface RegionalMetrics {
  region: string;
  salesUnits: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  returnsCount: number;
  returnRate: number;
  netProfit: number;
  netMargin: number;
  topCategories: { category: string; revenue: number; units: number }[];
  topCustomers: { customer: string; revenue: number; units: number }[];
}

export interface RegionalIntelligence {
  regions: RegionalMetrics[];
  bestPerformingRegion: string;
  highestReturnRateRegion: string;
  revenueByRegion: { region: string; revenue: number; percent: number }[];
  profitByRegion: { region: string; profit: number; percent: number }[];
}

// Return Reasons Impact Analysis
export interface ReturnReasonImpact {
  reason: string;
  count: number;
  percentOfReturns: number;
  estimatedCost: number; // Lost profit from these returns
  avgDaysToReturn: number;
  topProducts: string[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ReturnsDeepDive {
  totalReturnsLinked: number; // Returns that match to sales
  totalReturnsUnlinked: number; // Returns without matching sales
  avgDaysToReturn: number;
  returnReasonImpact: ReturnReasonImpact[];
  returnsByMonth: { month: string; count: number; linkedRevenue: number }[];
  repeatReturnSerials: number; // Same serial returned multiple times
  topReturnProducts: { product: string; returnCount: number; returnRate: number }[];
  topReturnCustomers: { customer: string; returnCount: number; returnRate: number }[];
}

// Cost Structure Analysis
export interface CostBreakdown {
  category: string;
  purchaseCost: number;
  purchasePercent: number;
  partsCost: number;
  partsPercent: number;
  freightCost: number;
  freightPercent: number;
  laborCost: number;
  laborPercent: number;
  otherCosts: number;
  otherPercent: number;
  totalCost: number;
  avgCostPerUnit: number;
  costTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface CostIntelligence {
  totalCost: number;
  costBreakdown: {
    purchase: number;
    parts: number;
    freight: number;
    labor: number;
    packaging: number;
    other: number;
  };
  costByCategory: CostBreakdown[];
  costByMake: CostBreakdown[];
  highCostAlerts: {
    type: string;
    description: string;
    impact: number;
    recommendation: string;
  }[];
}

// Strategic Executive Dashboard Summary
export interface StrategicDashboardData {
  // Top-line metrics
  salesRevenue: number;
  salesCost: number;
  grossProfit: number;
  grossMargin: number;
  returnImpact: number;
  netProfit: number;
  netMargin: number;
  
  // Volume metrics
  unitsSold: number;
  unitsReturned: number;
  returnRate: number;
  uniqueCustomers: number;
  uniqueProducts: number;
  
  // Profitability waterfall
  profitabilityWaterfall: ProfitabilityWaterfall;
  
  // Performance summaries
  topPerformingCategory: { name: string; profit: number; margin: number };
  worstPerformingCategory: { name: string; profit: number; margin: number };
  topCustomer: { name: string; revenue: number; margin: number };
  highestReturnProduct: { name: string; returnRate: number; lostProfit: number };
  
  // Regional summary
  regionPerformance: { region: string; revenue: number; profit: number; returnRate: number }[];
  
  // Alerts & Recommendations
  criticalAlerts: {
    type: 'margin' | 'returns' | 'customer' | 'product' | 'cost';
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    impact: number;
    recommendation: string;
  }[];
  
  // Trends
  monthlyTrends: {
    month: string;
    revenue: number;
    profit: number;
    margin: number;
    returnRate: number;
  }[];
  
  // Returns & Warranty Analysis
  returnsAnalysis?: {
    reasonsBreakdown: { reason: string; count: number; revenueImpact: number; profitImpact: number }[];
    byCategory: { category: string; returnCount: number; revenueAtRisk: number; profitLost: number }[];
    solutionsBreakdown: { solution: string; count: number; value: number }[];
  };
  warrantyExposure?: {
    underWarranty: number;
    expiringSoon: number;
    warrantyValue: number;
  };
  
  // Cost Bottleneck Analysis
  costBottlenecks?: {
    category: string;
    units: number;
    revenue: number;
    purchaseCost: number;
    partsCost: number;
    freightCost: number;
    laborCost: number;
    packagingCost: number;
    otherCosts: number;
    totalCost: number;
    margin: number;
  }[];
  highCostProducts?: {
    product: string;
    units: number;
    revenue: number;
    totalCost: number;
    costRatio: number;
    margin: number;
  }[];
}

// ========== PREDICTIVE ANALYTICS TYPES ==========

// Time-series data point for forecasting
export interface ForecastDataPoint {
  period: string; // e.g., "2024-01", "2024-Q1", "Week 1"
  actual: number | null;
  predicted: number | null;
  lowerBound?: number;
  upperBound?: number;
  isForecasted: boolean;
}

// Trend direction and strength
export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  strength: number; // 0-100 confidence
  changePercent: number;
  periodOverPeriod: number; // e.g., month-over-month change
  description: string;
}

// Seasonal pattern detection
export interface SeasonalPattern {
  detected: boolean;
  peakPeriods: string[];
  troughPeriods: string[];
  seasonalityStrength: number; // 0-1
  description: string;
}

// Moving average calculation
export interface MovingAverageResult {
  period: string;
  value: number;
  ma3: number | null; // 3-period moving average
  ma6: number | null; // 6-period moving average
  ma12: number | null; // 12-period moving average
}

// Revenue forecast
export interface RevenueForecast {
  historicalData: ForecastDataPoint[];
  forecastData: ForecastDataPoint[];
  trend: TrendAnalysis;
  seasonality: SeasonalPattern;
  movingAverages: MovingAverageResult[];
  nextPeriodPrediction: number;
  nextQuarterPrediction: number;
  confidenceLevel: number;
  modelAccuracy: number; // Historical accuracy as percentage
}

// Sales volume forecast
export interface SalesVolumeForecast {
  historicalData: ForecastDataPoint[];
  forecastData: ForecastDataPoint[];
  trend: TrendAnalysis;
  seasonality: SeasonalPattern;
  byCategory: {
    category: string;
    currentTrend: TrendAnalysis;
    nextPeriodForecast: number;
    growthRate: number;
  }[];
  byMake: {
    make: string;
    currentTrend: TrendAnalysis;
    nextPeriodForecast: number;
    growthRate: number;
  }[];
}

// Return rate prediction
export interface ReturnRateForecast {
  historicalData: ForecastDataPoint[];
  forecastData: ForecastDataPoint[];
  trend: TrendAnalysis;
  currentRate: number;
  predictedRate: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  byCategory: {
    category: string;
    currentRate: number;
    predictedRate: number;
    trend: 'improving' | 'stable' | 'worsening';
  }[];
  contributingFactors: {
    factor: string;
    impact: number; // positive means increases return rate
    description: string;
  }[];
}

// Profit margin forecast
export interface MarginForecast {
  historicalData: ForecastDataPoint[];
  forecastData: ForecastDataPoint[];
  trend: TrendAnalysis;
  currentMargin: number;
  predictedMargin: number;
  marginPressureRisk: 'low' | 'medium' | 'high';
  byCategory: {
    category: string;
    currentMargin: number;
    predictedMargin: number;
    trend: 'improving' | 'stable' | 'declining';
  }[];
  costPressureFactors: {
    costType: string;
    currentContribution: number;
    projectedContribution: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  }[];
}

// Customer behavior prediction
export interface CustomerForecast {
  totalActiveCustomers: number;
  predictedNewCustomers: number;
  churnRisk: {
    atRiskCount: number;
    atRiskRevenue: number;
    customers: {
      customer: string;
      lastOrder: string;
      daysSinceLast: number;
      historicalRevenue: number;
      churnProbability: number;
    }[];
  };
  topGrowthCustomers: {
    customer: string;
    currentRevenue: number;
    projectedRevenue: number;
    growthRate: number;
  }[];
  revenueConcentrationRisk: {
    top5Percentage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    recommendation: string;
  };
}

// Inventory turnover prediction
export interface InventoryForecast {
  currentTurnoverDays: number;
  predictedTurnoverDays: number;
  trend: TrendAnalysis;
  stockoutRisk: {
    riskLevel: 'low' | 'medium' | 'high';
    itemsAtRisk: number;
    estimatedLostRevenue: number;
  };
  overstockRisk: {
    riskLevel: 'low' | 'medium' | 'high';
    overstockedValue: number;
    recommendations: string[];
  };
  byCategory: {
    category: string;
    currentDays: number;
    predictedDays: number;
    trend: 'improving' | 'stable' | 'worsening';
  }[];
}

// Complete predictive analytics dashboard
export interface PredictiveAnalyticsDashboard {
  generatedAt: string;
  forecastPeriod: string; // e.g., "Next 3 months"
  dataQuality: {
    historicalMonths: number;
    dataCompleteness: number;
    reliabilityScore: number;
  };
  
  // Core forecasts
  revenueForecast: RevenueForecast;
  salesVolumeForecast: SalesVolumeForecast;
  returnRateForecast: ReturnRateForecast;
  marginForecast: MarginForecast;
  customerForecast: CustomerForecast;
  inventoryForecast: InventoryForecast;
  
  // Key predictions summary
  keyPredictions: {
    metric: string;
    currentValue: number;
    predictedValue: number;
    changePercent: number;
    confidence: number;
    direction: 'up' | 'down' | 'stable';
    impact: 'positive' | 'negative' | 'neutral';
  }[];
  
  // AI-generated insights
  aiInsights?: {
    summary: string;
    opportunities: string[];
    risks: string[];
    recommendations: string[];
  };
}
