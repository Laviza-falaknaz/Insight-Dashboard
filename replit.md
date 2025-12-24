# Inventory Dashboard

## Overview

A data-heavy enterprise dashboard application for inventory management and business analytics. The system provides real-time visibility into inventory, orders, customers, products, and profitability with interactive filtering, date range selection, and data visualization charts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode)
- **Charts**: Recharts for data visualization (line charts, bar charts, pie charts)
- **Design System**: Following Carbon Design System patterns optimized for data-dense interfaces

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/*` prefix
- **Build System**: Vite for frontend, esbuild for server bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (configured via `DATABASE_URL` environment variable)
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit for schema management (`npm run db:push`)

### Key Design Patterns
- **Shared Types**: TypeScript types defined in `shared/` directory are shared between client and server
- **Path Aliases**: `@/` for client source, `@shared/` for shared code
- **Component Structure**: Atomic design with base UI components in `components/ui/`, feature components in `components/`
- **Query Pattern**: React Query with automatic URL-based query keys

### Project Structure
```
client/           # React frontend application
  src/
    components/   # Reusable UI and feature components
    pages/        # Route-level page components
    lib/          # Utilities, query client, theme context
    hooks/        # Custom React hooks
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  db.ts           # Database connection
shared/           # Shared types and schema
  schema.ts       # Drizzle database schema
```

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Framework
- **Radix UI**: Headless, accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **shadcn/ui**: Pre-styled component library built on Radix
- **Recharts**: Charting library for data visualization

### Build & Development
- **Vite**: Frontend development server and build tool with HMR
- **esbuild**: Fast server-side TypeScript bundling
- **Replit Plugins**: Development banner, error overlay, and cartographer for Replit environment

### Date Handling
- **date-fns**: Date manipulation and formatting utilities

## Strategic Product Insights

The Products page now includes enhanced strategic analysis:

### Return-Prone Products
- Products with highest return rates
- Return count and rate per product (%)
- Profit lost due to returns
- Joined from inventory SalesOrders to returns table

### Negative Margin Products
- Products selling at a loss (cost > revenue)
- Units sold, revenue, cost, and loss amount
- Critical alerts for profitability issues

### Product Cost Breakdown
- Per-product cost analysis: purchase, parts, freight, labor
- Total cost vs revenue with margin calculation
- Helps identify cost bottlenecks by product

### API Endpoints
- `GET /api/insights/products` - Returns all product analysis data including strategic insights
- `GET /api/strategic/dashboard` - Strategic dashboard with returns analysis, warranty exposure, cost bottlenecks