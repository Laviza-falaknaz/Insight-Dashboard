# Inventory Dashboard API Documentation

## Base URL

All API endpoints are accessible at:
```
https://your-domain.com/api
```

For local development:
```
http://localhost:5000/api
```

---

## Table of Contents

1. [Data Management APIs](#data-management-apis)
   - [Upsert Inventory Data](#upsert-inventory-data)
   - [Upsert Returns Data](#upsert-returns-data)
   - [Upload Inventory Data (Legacy)](#upload-inventory-data-legacy)
   - [Clear Data](#clear-data)
   - [Get Upload History](#get-upload-history)
2. [Data Retrieval APIs](#data-retrieval-apis)
   - [Get Inventory Count](#get-inventory-count)
   - [Get Returns Count](#get-returns-count)
   - [Get Inventory Data](#get-inventory-data)
   - [Get Returns Data](#get-returns-data)
   - [Get Filter Options](#get-filter-options)
3. [Dashboard APIs](#dashboard-apis)
   - [Get Dashboard Data](#get-dashboard-data)

---

## Data Management APIs

### Upsert Inventory Data

Efficiently inserts or updates inventory records. Uses PostgreSQL's `ON CONFLICT` for deduplication based on `InventSerialId`. Optimized for handling 3M+ records with batch processing.

**Endpoint:** `POST /api/data/inventory/upsert`

**Content-Type:** `application/json`

**Request Body:** Array of inventory objects

```json
[
  {
    "InventSerialId": "SN123456789",
    "ItemId": "LAPTOP-001",
    "Make": "Dell",
    "Category": "Laptop",
    "Status": "Available",
    "VendName": "Tech Supplier Inc",
    "GradeCondition": "A",
    "PurchPriceUSD": "450.00",
    "FinalSalesPriceUSD": "650.00",
    "FinalTotalCostUSD": "480.00",
    "InvoiceDate": "2024-01-15",
    "InvoicingName": "Customer Corp"
  }
]
```

**Required Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `InventSerialId` | string | Unique serial identifier (used as deduplication key) |

**Optional Fields (70 total):**
| Field | Type | Description |
|-------|------|-------------|
| `dataAreaId` | string | Data area identifier |
| `ItemId` | string | Item/product identifier |
| `DealRef` | string | Deal reference number |
| `PurchPriceUSD` | string | Purchase price in USD |
| `PurchDate` | string | Purchase date (YYYY-MM-DD) |
| `VendComments` | string | Vendor comments |
| `KeyLang` | string | Keyboard language |
| `OsSticker` | string | OS sticker info |
| `DisplaySize` | string | Display size |
| `LCDCostUSD` | string | LCD cost in USD |
| `StorageSerialNum` | string | Storage serial number |
| `VendName` | string | Vendor name |
| `Category` | string | Product category |
| `MadeIn` | string | Country of manufacture |
| `GradeCondition` | string | Grade/condition (A, B, C, etc.) |
| `PartsCostUSD` | string | Parts cost in USD |
| `FingerprintStr` | string | Fingerprint string |
| `MiscCostUSD` | string | Miscellaneous cost |
| `ProcessorGen` | string | Processor generation |
| `ManufacturingDate` | string | Manufacturing date |
| `PurchaseCategory` | string | Purchase category |
| `KeyLayout` | string | Keyboard layout |
| `PONumber` | string | Purchase order number |
| `Make` | string | Manufacturer/brand |
| `Processor` | string | Processor type |
| `PackagingCostUSD` | string | Packaging cost |
| `ReceivedDate` | string | Date received |
| `ITADTreesCostUSD` | string | ITAD trees cost |
| `StorageType` | string | Storage type (SSD/HDD) |
| `SoldAsHDD` | string | Sold as HDD value |
| `StandardisationCostUSD` | string | Standardisation cost |
| `Comments` | string | General comments |
| `PurchPriceRevisedUSD` | string | Revised purchase price |
| `Status` | string | Item status (Available, Sold, etc.) |
| `ConsumableCostUSD` | string | Consumable cost |
| `Chassis` | string | Chassis type |
| `JournalNum` | string | Journal number |
| `BatteryCostUSD` | string | Battery cost |
| `Ram` | string | RAM specification |
| `SoldAsRAM` | string | Sold as RAM value |
| `FreightChargesUSD` | string | Freight charges |
| `HDD` | string | HDD specification |
| `COACostUSD` | string | COA cost |
| `ManufacturerSerialNum` | string | Manufacturer serial |
| `SupplierPalletNum` | string | Supplier pallet number |
| `ResourceCostUSD` | string | Resource cost |
| `CustomsDutyUSD` | string | Customs duty |
| `Resolution` | string | Display resolution |
| `ModelNum` | string | Model number |
| `InvoiceAccount` | string | Invoice account |
| `TotalCostCurUSD` | string | Total current cost |
| `SalesOrderDate` | string | Sales order date |
| `CustomerRef` | string | Customer reference |
| `CRMRef` | string | CRM reference |
| `InvoicingName` | string | Customer/invoicing name |
| `TransType` | string | Transaction type |
| `SalesInvoiceId` | string | Sales invoice ID |
| `SalesId` | string | Sales ID |
| `InvoiceDate` | string | Invoice date (YYYY-MM-DD) |
| `APINNumber` | string | APIN number |
| `Segregation` | string | Segregation info |
| `FinalSalesPriceUSD` | string | Final sales price |
| `FinalTotalCostUSD` | string | Final total cost |
| `OrderTaker` | string | Order taker name |
| `OrderResponsible` | string | Order responsible person |
| `ProductSpecification` | string | Product specifications |
| `WarrantyStartDate` | string | Warranty start date |
| `WarrantyEndDate` | string | Warranty end date |
| `WarrantyDescription` | string | Warranty description |

**Success Response:**
```json
{
  "success": true,
  "message": "Processed 1500 records",
  "processed": 1500
}
```

**Error Response:**
```json
{
  "error": "Failed to upsert data",
  "details": "Error message details"
}
```

**Example cURL:**
```bash
curl -X POST "https://your-domain.com/api/data/inventory/upsert" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "InventSerialId": "SN001",
      "ItemId": "LAPTOP-001",
      "Make": "Dell",
      "Category": "Laptop",
      "Status": "Available",
      "FinalSalesPriceUSD": "650.00",
      "FinalTotalCostUSD": "480.00"
    },
    {
      "InventSerialId": "SN002",
      "ItemId": "LAPTOP-002",
      "Make": "HP",
      "Category": "Laptop",
      "Status": "Sold",
      "FinalSalesPriceUSD": "720.00",
      "FinalTotalCostUSD": "510.00"
    }
  ]'
```

---

### Upsert Returns Data

Efficiently inserts or updates RMA/returns records. Uses `RMALineItemGUID` as the deduplication key.

**Endpoint:** `POST /api/data/returns/upsert`

**Content-Type:** `application/json`

**Request Body:** Array of returns objects

```json
[
  {
    "RMALineItemGUID": "guid-123-456-789",
    "RMANumber": "RMA-2024-001",
    "FinalCustomer": "Customer Corp",
    "RMAStatus": "Open",
    "ReasonforReturn": "Defective screen",
    "LineStatus": "Pending",
    "LineSolution": "Replace"
  }
]
```

**Required Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `RMALineItemGUID` | string | Unique RMA line item identifier (deduplication key) |

**Optional Fields (35 total):**
| Field | Type | Description |
|-------|------|-------------|
| `FinalCustomer` | string | Final customer name |
| `RelatedOrderName` | string | Related order name |
| `CaseID` | string | Support case ID |
| `RMANumber` | string | RMA number |
| `ReasonforReturn` | string | Reason for return |
| `CreatedOn` | string | Creation date |
| `WarehouseNotes` | string | Warehouse notes |
| `FinalResellerName` | string | Final reseller name |
| `ExpectedShippingDate` | string | Expected shipping date |
| `RMALineName` | string | RMA line name |
| `CaseEndUser` | string | Case end user |
| `UAEWarehosueNotes` | string | UAE warehouse notes |
| `NotesDescription` | string | Notes description |
| `RMAGUID` | string | RMA GUID |
| `RelatedSerialGUID` | string | Related serial GUID |
| `ModifiedOn` | string | Last modified date |
| `OpportunityNumber` | string | Opportunity number |
| `ItemTestingDate` | string | Item testing date |
| `FinalDistributorName` | string | Final distributor name |
| `CaseCustomer` | string | Case customer |
| `ItemReceivedDate` | string | Item received date |
| `CaseDescription` | string | Case description |
| `DispatchDate` | string | Dispatch date |
| `ReplacementSerialGUID` | string | Replacement serial GUID |
| `RMAStatus` | string | RMA status (Open, Closed, etc.) |
| `TypeOfUnit` | string | Type of unit |
| `LineStatus` | string | Line status |
| `LineSolution` | string | Line solution |
| `UAEFinalOutcome` | string | UAE final outcome |
| `RMATopicLabel` | string | RMA topic label |
| `UKFinalOutcome` | string | UK final outcome |
| `SerialID` | string | Serial ID |
| `AreaID` | string | Area ID |
| `ItemID` | string | Item ID |

**Success Response:**
```json
{
  "success": true,
  "message": "Processed 250 records",
  "processed": 250
}
```

**Example cURL:**
```bash
curl -X POST "https://your-domain.com/api/data/returns/upsert" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "RMALineItemGUID": "guid-001",
      "RMANumber": "RMA-001",
      "FinalCustomer": "Customer A",
      "RMAStatus": "Open",
      "ReasonforReturn": "Defective"
    }
  ]'
```

---

### Upload Inventory Data (Legacy)

Simple insert-only endpoint. Does NOT handle duplicates - use upsert endpoint for deduplication.

**Endpoint:** `POST /api/data/upload`

**Content-Type:** `application/json`

**Request Body:** Same structure as upsert endpoint

**Success Response:**
```json
{
  "success": true,
  "message": "Successfully uploaded 1000 records",
  "recordsInserted": 1000
}
```

---

### Clear Data

Clears inventory and/or returns data from the database.

**Endpoint:** `DELETE /api/data/clear`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Optional. `inventory`, `returns`, or omit for both |

**Examples:**
```bash
# Clear only inventory
curl -X DELETE "https://your-domain.com/api/data/clear?table=inventory"

# Clear only returns
curl -X DELETE "https://your-domain.com/api/data/clear?table=returns"

# Clear all data
curl -X DELETE "https://your-domain.com/api/data/clear"
```

**Success Response:**
```json
{
  "success": true,
  "message": "All data cleared"
}
```

---

### Get Upload History

Retrieves the last 20 data upload records.

**Endpoint:** `GET /api/data/uploads`

**Response:**
```json
[
  {
    "id": 1,
    "tableName": "inventory",
    "recordsCount": 5000,
    "insertedCount": 4800,
    "updatedCount": 200,
    "status": "completed",
    "uploadedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

---

## Data Retrieval APIs

### Get Inventory Count

Returns the total number of inventory records.

**Endpoint:** `GET /api/data/count`

**Response:**
```json
{
  "count": 1500000
}
```

---

### Get Returns Count

Returns the total number of returns records.

**Endpoint:** `GET /api/data/returns/count`

**Response:**
```json
{
  "count": 25000
}
```

---

### Get Inventory Data

Retrieves inventory records with optional filtering.

**Endpoint:** `GET /api/inventory`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Filter by invoice date (from) |
| `endDate` | string | Filter by invoice date (to) |
| `status` | string | Filter by status (comma-separated for multiple) |
| `category` | string | Filter by category (comma-separated) |
| `make` | string | Filter by manufacturer (comma-separated) |
| `customer` | string | Filter by customer name (comma-separated) |
| `vendor` | string | Filter by vendor name (comma-separated) |
| `gradeCondition` | string | Filter by grade (comma-separated) |

**Example:**
```bash
curl "https://your-domain.com/api/inventory?status=Sold&make=Dell,HP&startDate=2024-01-01"
```

**Response:**
```json
[
  {
    "id": 1,
    "inventSerialId": "SN123456",
    "itemId": "LAPTOP-001",
    "make": "Dell",
    "category": "Laptop",
    "status": "Sold",
    "finalSalesPriceUsd": "650.00",
    "finalTotalCostUsd": "480.00",
    "invoiceDate": "2024-01-15",
    "invoicingName": "Customer Corp"
  }
]
```

---

### Get Returns Data

Retrieves returns/RMA records.

**Endpoint:** `GET /api/returns`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Maximum records to return (default: 1000) |

**Example:**
```bash
curl "https://your-domain.com/api/returns?limit=500"
```

**Response:**
```json
[
  {
    "id": 1,
    "rmaLineItemGuid": "guid-123",
    "rmaNumber": "RMA-001",
    "finalCustomer": "Customer A",
    "rmaStatus": "Open",
    "reasonForReturn": "Defective",
    "createdOn": "2024-01-10"
  }
]
```

---

### Get Filter Options

Returns distinct values for all filterable fields (for populating dropdown filters).

**Endpoint:** `GET /api/filters`

**Response:**
```json
{
  "statuses": ["Available", "Sold", "Reserved", "In Transit"],
  "categories": ["Laptop", "Desktop", "Monitor", "Accessories"],
  "makes": ["Dell", "HP", "Lenovo", "Apple"],
  "customers": ["Customer A", "Customer B", "Customer C"],
  "vendors": ["Vendor 1", "Vendor 2", "Vendor 3"],
  "grades": ["A", "B", "C", "D"]
}
```

---

## Dashboard APIs

### Get Dashboard Data

Returns aggregated dashboard metrics with optional filtering.

**Endpoint:** `GET /api/dashboard`

**Query Parameters:** Same as Get Inventory Data

**Response:**
```json
{
  "kpis": {
    "totalRevenue": 1500000.00,
    "totalCost": 1100000.00,
    "totalProfit": 400000.00,
    "profitMargin": 26.67,
    "unitsSold": 2500,
    "averageOrderValue": 600.00,
    "totalOrders": 450
  },
  "revenueOverTime": [
    {
      "date": "2024-01-01",
      "revenue": 50000,
      "profit": 15000,
      "cost": 35000,
      "units": 80
    }
  ],
  "categoryBreakdown": [
    {
      "category": "Laptop",
      "revenue": 800000,
      "profit": 220000,
      "units": 1200,
      "count": 1200
    }
  ],
  "topCustomers": [
    {
      "name": "Customer Corp",
      "revenue": 250000,
      "profit": 75000,
      "units": 400,
      "count": 45
    }
  ],
  "topProducts": [
    {
      "name": "Dell Latitude 5520",
      "revenue": 150000,
      "profit": 45000,
      "units": 230,
      "count": 230
    }
  ],
  "vendorBreakdown": [
    {
      "name": "Tech Supplier Inc",
      "cost": 500000,
      "units": 800,
      "count": 800
    }
  ],
  "statusBreakdown": [
    {
      "status": "Sold",
      "count": 2000
    },
    {
      "status": "Available",
      "count": 500
    }
  ]
}
```

---

## Error Handling

All endpoints return errors in the following format:

```json
{
  "error": "Error type description",
  "details": "Detailed error message (optional)"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 500 | Internal Server Error |

---

## Rate Limits & Best Practices

### Batch Size Recommendations
- **Inventory Upsert:** Send batches of 1,000-10,000 records per request
- **Returns Upsert:** Send batches of 1,000-5,000 records per request
- Internal processing uses 500-record batches for optimal PostgreSQL performance

### Performance Tips
1. Use the upsert endpoints instead of upload for deduplication
2. Include only necessary fields to reduce payload size
3. Use date filters to reduce dashboard query load
4. The system handles 3M+ records efficiently with batch processing

### Integration Example (Power Automate / Logic Apps)

```json
{
  "method": "POST",
  "uri": "https://your-domain.com/api/data/inventory/upsert",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "@{body('Get_rows_from_database')}"
}
```

---

## Data Schema Reference

### Inventory Table (70 fields)
Primary Key: `id` (auto-generated)
Unique Constraint: `invent_serial_id`

### Returns Table (35 fields)
Primary Key: `id` (auto-generated)
Unique Constraint: `rma_line_item_guid`

### Data Uploads Table
Tracks all upload operations with:
- Table name
- Records count
- Inserted/Updated counts
- Status
- Timestamp
