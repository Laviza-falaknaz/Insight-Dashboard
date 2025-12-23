# Dashboard Design Guidelines

## Design Approach
**System-Based Approach**: Inspired by Carbon Design System and modern dashboard products (Linear, Retool, Tableau) optimized for data-heavy enterprise applications. Focus on information density, clarity, and efficient data navigation.

---

## Core Design Elements

### Typography Hierarchy
- **Primary Headlines (Dashboard Title)**: Inter/SF Pro, 32px, Semibold
- **Section Headers (Widget Titles)**: Inter/SF Pro, 20px, Semibold  
- **Data Labels**: Inter/SF Pro, 14px, Medium
- **Metric Values (Large)**: Inter/SF Pro, 36px, Bold (for KPI cards)
- **Metric Values (Small)**: Inter/SF Pro, 18px, Semibold
- **Body Text/Tables**: Inter/SF Pro, 14px, Regular
- **Captions/Footnotes**: Inter/SF Pro, 12px, Regular

### Layout System
**Spacing Units**: Consistently use Tailwind units of **2, 4, 6, 8, 12, 16** (e.g., p-4, gap-6, mt-8)
- Component padding: p-6 for cards, p-4 for dense components
- Section gaps: gap-6 for card grids, gap-4 for form elements
- Page margins: Container with px-6 md:px-8

**Grid Structure**:
- Sidebar navigation: Fixed 240px width (w-60)
- Main content area: Fluid with max-w-full
- Dashboard cards: Grid of 1-4 columns responsive (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)

---

## Component Library

### Navigation
**Top Bar** (h-16, fixed):
- Logo/App name (left)
- Global search bar (center-left, w-96)
- Date range selector (center-right)
- User profile + notifications (right)

**Left Sidebar** (w-60, fixed, full-height):
- Navigation sections: Dashboard, Orders, Customers, Products, Inventory, Reports
- Active state: subtle background treatment
- Icons from Heroicons (outline style)

### Data Visualization Components

**KPI Cards** (Prominent top row):
- 4-column grid on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Each card: p-6, rounded-lg border
- Large metric value (36px bold) with trend indicator (↑↓ with percentage)
- Label below (14px medium)
- Optional sparkline chart (20px height)

**Data Tables**:
- Sticky header row (bg-gray-50 equivalent)
- Zebra striping for rows
- Cell padding: px-4 py-3
- Sortable columns (ascending/descending icons)
- Row hover state
- Pagination controls at bottom
- "Export CSV" button top-right

**Charts** (using Chart.js):
- Line charts for trends over time
- Bar charts for comparisons
- Pie/donut for category breakdowns
- Cards containing charts: min-h-80, p-6

### Filter Panel
**Collapsible Left Panel or Top Bar Section**:
- Date range picker (with presets: Today, Last 7 Days, Last 30 Days, Custom)
- Multi-select dropdowns for: Customer, Product, Status, Category
- Search fields for Order ID, Serial Number
- "Apply Filters" + "Reset" buttons at bottom
- Filter badges showing active selections

### Cards & Containers
- Standard card: rounded-lg border p-6 shadow-sm
- Card header: flex justify-between items-center mb-4
- Card title with action buttons (Export, Refresh, Expand)

### Buttons
- Primary actions: px-4 py-2 rounded-md font-medium
- Icon buttons: p-2 rounded-md (for table actions)
- Button groups for view toggles (Table/Chart view)

### Forms & Inputs
- Input fields: px-3 py-2 rounded-md border w-full
- Labels: mb-2 text-sm font-medium
- Select dropdowns: Consistent with inputs
- Date pickers: Calendar dropdown UI

### Status Indicators
- Badges for Status field: px-2.5 py-0.5 rounded-full text-xs font-medium
- Trend arrows: ↑ (positive), ↓ (negative), → (neutral)

---

## Dashboard Layout Structure

### Main Dashboard View
1. **Top Bar** (h-16): Global controls
2. **Sidebar** (w-60): Navigation menu
3. **Main Content** (ml-60 pt-16 p-6):
   - **KPI Row**: 4 metric cards across (Total Sales, Total Profit, Units Sold, Avg Order Value)
   - **Charts Section**: 2-column grid with Revenue Trends (line) and Product Mix (bar)
   - **Recent Activity Table**: Full-width data table with top 50 recent orders
   - **Secondary Metrics**: 3-column grid (Top Customers, Top Products, Sales by Region)

### Detail Views (Orders/Customers/Products)
- Breadcrumb navigation: Home > Orders > Order #12345
- Header with key info (Order ID, Date, Status badge)
- Tabbed interface: Overview | Items | History | Documents
- Split layout: 2/3 main content, 1/3 metadata sidebar

---

## Real-Time Data Patterns
- Live refresh indicator (pulsing dot) when data updates
- "Last updated: X seconds ago" timestamp
- Auto-refresh toggle in top bar
- Loading skeletons for async data (not full-page spinners)

---

## Responsive Behavior
- **Desktop (lg+)**: Full layout with sidebar, 4-column KPI grid
- **Tablet (md)**: Collapsible sidebar, 2-column KPI grid
- **Mobile (base)**: Hidden sidebar (hamburger menu), single-column stacked layout, simplified tables (card view)

---

## Accessibility
- All interactive elements keyboard navigable
- ARIA labels for data visualizations
- Skip navigation link
- Focus indicators on all controls
- Minimum touch targets: 44x44px on mobile

---

## Performance Considerations
- Virtual scrolling for tables with 100+ rows
- Lazy load charts below fold
- Debounced search inputs (300ms)
- Cached filter selections in session storage