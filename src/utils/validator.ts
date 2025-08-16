import { z } from 'zod';

// Item validation schemas
export const createItemSchema = z.object({
  sku: z.string().optional(), // Now optional - will be auto-generated if not provided
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  upc: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  modelNumber: z.string().optional(), // NEW - e.g., "GVU6C"
  storage: z.string().optional(), // NEW - e.g., "128GB"
  color: z.string().optional(), // NEW - e.g., "Obsidian"
  carrier: z.string().optional(), // NEW - e.g., "Unlocked"
  carrierId: z.string().optional(), // NEW - for internal carrier identification
  condition: z.string().default('used'),
  cost: z.number().positive().optional(),
  price: z.number().positive().optional(),
  weightOz: z.number().int().positive().optional(),
  dimensions: z.string().optional(),
  imageUrl: z.string().url().optional(),
  type: z.string().min(1, 'Type is required'), // Required field
  imei: z.string().optional(), // Optional unique IMEI
  serialNumber: z.string().optional(), // Optional unique serial number
  isActive: z.boolean().default(true)
});

export const updateItemSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  upc: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  modelNumber: z.string().optional(), // NEW
  storage: z.string().optional(), // NEW
  color: z.string().optional(), // NEW
  carrier: z.string().optional(), // NEW
  carrierId: z.string().optional(), // NEW
  condition: z.string().optional(),
  cost: z.number().positive().optional(),
  price: z.number().positive().optional(),
  weightOz: z.number().int().positive().optional(),
  dimensions: z.string().optional(),
  imageUrl: z.string().url().optional(),
  type: z.string().min(1, 'Type is required').optional(),
  imei: z.string().optional(),
  serialNumber: z.string().optional(),
  isActive: z.boolean().optional()
});

// Inventory validation schemas
export const createInventorySchema = z.object({
  itemId: z.number().int().positive('Item ID is required'), // New field for foreign key
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  location: z.string().min(1, 'Location is required')
});

export const updateInventorySchema = z.object({
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  location: z.string().min(1, 'Location is required').optional()
});

// Inbound Log validation schemas
export const createInboundLogSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  location: z.string().min(1, 'Location is required'),
  receivedBy: z.string().min(1, 'Received by is required'),
  notes: z.string().optional()
});

export const updateInboundLogSchema = z.object({
  status: z.enum(['RECEIVED', 'PROCESSING', 'QC_PENDING', 'QC_APPROVED', 'QC_REJECTED', 'INVENTORY_READY']).optional(),
  notes: z.string().optional()
});

// Outbound Log validation schemas
export const createOutboundLogSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  location: z.string().min(1, 'Location is required'),
  shippedBy: z.string().min(1, 'Shipped by is required'),
  notes: z.string().optional()
});

export const updateOutboundLogSchema = z.object({
  status: z.enum(['PLANNED', 'QUEUED', 'SHIPPED', 'CANCELED']).optional(),
  notes: z.string().optional()
});

// Processing Queue validation schemas
export const createProcessingQueueSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
  inboundLogId: z.number().int().positive('Inbound Log ID is required'),
  assignedTo: z.string().optional(),
  notes: z.string().optional()
});

export const updateProcessingQueueSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']).optional(),
  assignedTo: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  notes: z.string().optional()
});

// QC Approval validation schemas
export const createQCApprovalSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
  processingQueueId: z.number().int().positive('Processing Queue ID is required'),
  approvedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional()
});

export const updateQCApprovalSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional()
});

// Outbound Queue validation schemas
export const createOutboundQueueSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  location: z.string().min(1, 'Location is required'),
  requestedBy: z.string().min(1, 'Requested by is required'),
  priority: z.number().int().min(1).max(10).optional(),
  scheduledAt: z.string().optional(),
  notes: z.string().optional()
});

export const updateOutboundQueueSchema = z.object({
  status: z.enum(['QUEUED', 'SHIPPED', 'CANCELED']).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  scheduledAt: z.string().optional(),
  shippedAt: z.string().optional(),
  canceledAt: z.string().optional(),
  canceledBy: z.string().optional(),
  notes: z.string().optional()
});

// Query parameter schemas
export const queryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  search: z.string().optional(),
  brand: z.string().optional(),
  condition: z.string().optional(),
  type: z.string().optional(), // New filter option
  sku: z.string().optional(),
  location: z.string().optional()
});

// Log query parameter schemas
export const logQueryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  itemId: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional()
});

// Processing Queue query parameter schemas
export const processingQueueQueryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  itemId: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).optional(),
  status: z.string().optional(),
  assignedTo: z.string().optional()
});

// QC Approval query parameter schemas
export const qcApprovalQueryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  itemId: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).optional(),
  status: z.string().optional(),
  approvedBy: z.string().optional()
});

// Outbound Queue query parameter schemas
export const outboundQueueQueryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  itemId: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  requestedBy: z.string().optional()
});

// Admin inventory push validation schema
export const inventoryPushSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  storage: z.string().optional(),
  color: z.string().optional(),
  carrier: z.string().optional(),
  type: z.string().min(1, 'Type is required'),
  imei: z.string().optional(),
  serialNumber: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  location: z.string().min(1, 'Location is required')
}).refine(
  (data) => data.imei || data.serialNumber || data.sku,
  {
    message: 'At least one of imei, serialNumber, or sku must be provided',
    path: ['imei', 'serialNumber', 'sku']
  }
);

// Parameter validation schemas
export const skuParamSchema = z.object({
  sku: z.string().min(1, 'SKU parameter is required')
});

export const idParamSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive())
});

// Export types
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type CreateInboundLogInput = z.infer<typeof createInboundLogSchema>;
export type UpdateInboundLogInput = z.infer<typeof updateInboundLogSchema>;
export type CreateOutboundLogInput = z.infer<typeof createOutboundLogSchema>;
export type UpdateOutboundLogInput = z.infer<typeof updateOutboundLogSchema>;
export type CreateProcessingQueueInput = z.infer<typeof createProcessingQueueSchema>;
export type UpdateProcessingQueueInput = z.infer<typeof updateProcessingQueueSchema>;
export type CreateQCApprovalInput = z.infer<typeof createQCApprovalSchema>;
export type UpdateQCApprovalInput = z.infer<typeof updateQCApprovalSchema>;
export type CreateOutboundQueueInput = z.infer<typeof createOutboundQueueSchema>;
export type UpdateOutboundQueueInput = z.infer<typeof updateOutboundQueueSchema>;
export type InventoryPushInput = z.infer<typeof inventoryPushSchema>;
export type QueryParams = z.infer<typeof queryParamsSchema>;
export type LogQueryParams = z.infer<typeof logQueryParamsSchema>;
export type ProcessingQueueQueryParams = z.infer<typeof processingQueueQueryParamsSchema>;
export type QCApprovalQueryParams = z.infer<typeof qcApprovalQueryParamsSchema>;
export type OutboundQueueQueryParams = z.infer<typeof outboundQueueQueryParamsSchema>; 