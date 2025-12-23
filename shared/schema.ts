import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, integer } from "drizzle-orm/pg-core";
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

// Inventory item type matching SQL Server table
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
