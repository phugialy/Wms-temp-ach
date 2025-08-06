# WMS Backend - Warehouse Management System

A comprehensive backend API for warehouse management built with Node.js, TypeScript, Express, and Prisma.

## 🚀 Features

- **Product Management**: CRUD operations for products with SKU tracking
- **Inventory Management**: Real-time inventory tracking across warehouses
- **Order Processing**: Complete order lifecycle management
- **Warehouse Management**: Multi-warehouse support with capacity tracking
- **User Management**: Role-based access control (Admin, Manager, Operator)
- **Shipment Tracking**: Shipment status and delivery tracking
- **Data Validation**: Comprehensive input validation using Zod
- **Error Handling**: Centralized error handling with detailed logging
- **Database**: PostgreSQL with Prisma ORM

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Logging**: Morgan + Custom Logger
- **Package Manager**: pnpm

## 📁 Project Structure

```
src/
├── index.ts                 # Application entry point
├── routes/                  # API route definitions
│   ├── productRoutes.ts
│   ├── inventoryRoutes.ts
│   ├── orderRoutes.ts
│   ├── warehouseRoutes.ts
│   └── userRoutes.ts
├── controllers/             # Request/response handlers
│   └── productController.ts
├── services/               # Business logic layer
│   └── productService.ts
└── utils/                  # Utility functions
    ├── errorHandler.ts
    ├── logger.ts
    └── validation.ts

prisma/
├── schema.prisma           # Database schema
└── seed.ts                # Database seeding
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- pnpm package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wms-backend
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your database credentials:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/wms_db"
   PORT=3000
   NODE_ENV=development
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   pnpm db:generate
   
   # Push schema to database
   pnpm db:push
   
   # Seed the database with sample data
   pnpm db:seed
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

The server will start on `http://localhost:3000`

## 📚 API Documentation

### Health Check
```
GET /health
```

### Products API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products with pagination |
| POST | `/api/products` | Create a new product |
| GET | `/api/products/:id` | Get product by ID |
| GET | `/api/products/sku/:sku` | Get product by SKU |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/products/categories` | Get all product categories |
| GET | `/api/products/category/:category` | Get products by category |

### Example Product Creation

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "PROD-001",
    "name": "Laptop Computer",
    "description": "High-performance laptop for business use",
    "category": "Electronics",
    "unit": "piece"
  }'
```

### Query Parameters

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `search`: Search term for product name, SKU, or description
- `category`: Filter by product category

## 🗄 Database Schema

### Core Entities

- **Users**: System users with role-based access
- **Products**: Product catalog with SKU tracking
- **Warehouses**: Physical warehouse locations
- **Inventory Items**: Product quantities per warehouse
- **Orders**: Customer orders with items
- **Shipments**: Order fulfillment tracking
- **Inventory Logs**: Audit trail for inventory changes

### Relationships

- Products can have multiple inventory items (one per warehouse)
- Orders contain multiple order items (products)
- Shipments are linked to orders and warehouses
- Inventory logs track all quantity changes

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev              # Start development server with hot reload

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema changes to database
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed database with sample data

# Production
pnpm build            # Build TypeScript to JavaScript
pnpm start            # Start production server
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `LOG_LEVEL` | Logging level | info |

## 🧪 Testing

The project is structured to support testing:

- Controllers are pure functions for easy unit testing
- Services contain business logic separated from HTTP concerns
- Validation schemas ensure data integrity
- Error handling is centralized and consistent

## 📝 Logging

The application uses structured logging with different levels:

- **ERROR**: Application errors and exceptions
- **WARN**: Warning conditions
- **INFO**: General information and business events
- **DEBUG**: Detailed debugging information

Specialized logging methods are available for WMS operations:
- `logInventoryChange()`: Track inventory modifications
- `logOrderStatusChange()`: Monitor order status updates
- `logShipmentCreated()`: Record shipment creation

## 🔒 Security

- Input validation using Zod schemas
- SQL injection protection via Prisma ORM
- CORS configuration for cross-origin requests
- Error handling that doesn't expose sensitive information
- Role-based access control (planned for future implementation)

## 🚀 Deployment

### Production Build

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

### Docker (Future Enhancement)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

## 🤝 Contributing

1. Follow the existing code structure and patterns
2. Add validation for all new endpoints
3. Include error handling and logging
4. Update documentation for new features
5. Test thoroughly before submitting

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the API documentation
2. Review the error logs
3. Ensure database is properly configured
4. Verify environment variables are set correctly

---

**Built with ❤️ for efficient warehouse management** 