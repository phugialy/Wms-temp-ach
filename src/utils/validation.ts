import { z } from 'zod';

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR']).optional().default('OPERATOR')
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR']).optional()
});

// Product validation schemas
export const createProductSchema = z.object({
  sku: z.string().min(3, 'SKU must be at least 3 characters'),
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().default('piece')
});

export const updateProductSchema = z.object({
  sku: z.string().min(3, 'SKU must be at least 3 characters').optional(),
  name: z.string().min(2, 'Product name must be at least 2 characters').optional(),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required').optional(),
  unit: z.string().optional()
});

// Warehouse validation schemas
export const createWarehouseSchema = z.object({
  name: z.string().min(2, 'Warehouse name must be at least 2 characters'),
  location: z.string().min(5, 'Location must be at least 5 characters'),
  capacity: z.number().positive('Capacity must be a positive number')
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(2, 'Warehouse name must be at least 2 characters').optional(),
  location: z.string().min(5, 'Location must be at least 5 characters').optional(),
  capacity: z.number().positive('Capacity must be a positive number').optional()
});

// Inventory validation schemas
export const createInventoryItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  minQuantity: z.number().int().min(0, 'Minimum quantity must be non-negative').default(0),
  maxQuantity: z.number().int().positive('Maximum quantity must be positive').optional(),
  location: z.string().optional()
});

export const updateInventoryItemSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity must be non-negative').optional(),
  minQuantity: z.number().int().min(0, 'Minimum quantity must be non-negative').optional(),
  maxQuantity: z.number().int().positive('Maximum quantity must be positive').optional(),
  location: z.string().optional()
});

export const inventoryAdjustmentSchema = z.object({
  quantity: z.number().int(),
  reason: z.string().min(1, 'Reason is required'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'])
});

// Order validation schemas
export const createOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive')
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters'),
  items: z.array(createOrderItemSchema).min(1, 'At least one item is required')
});

export const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').optional()
});

// Shipment validation schemas
export const createShipmentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required')
});

export const updateShipmentSchema = z.object({
  status: z.enum(['PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']).optional(),
  shippedAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional()
});

// Query parameter validation schemas
export const paginationSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(
    z.number().int().positive('Page must be a positive integer')
  ).optional().default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(
    z.number().int().positive('Limit must be a positive integer').max(100, 'Limit cannot exceed 100')
  ).optional().default('10')
});

export const searchSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  warehouseId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Combined query schema
export const queryParamsSchema = paginationSchema.merge(searchSchema);

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required')
});

// Export types for use in controllers
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type QueryParams = z.infer<typeof queryParamsSchema>; 