import { Item } from '@prisma/client';
import { CreateItemInput } from './validator';

/**
 * Generates a SKU based on available item data
 * Since the current schema is simplified, we'll use name and IMEI
 */
export function generateSku(item: Partial<Item>): string {
  const name = (item.name || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
  const imei = item.imei || 'UNKNOWN';
  
  // Create a simple SKU: NAME-IMEI (last 4 digits)
  const imeiSuffix = imei.length >= 4 ? imei.slice(-4) : imei;
  return `${name}-${imeiSuffix}`;
}

/**
 * Capitalizes the first letter of a string while keeping the rest in original case
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return 'Unknown';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Generates a SKU from item data and returns both the SKU and generation timestamp
 */
export function generateSkuWithTimestamp(item: CreateItemInput): { sku: string; skuGeneratedAt: Date } {
  // Convert the input to match the Item type structure
  const itemData: Partial<Item> = {
    name: item.name,
    imei: item.imei || undefined
  };

  return {
    sku: generateSku(itemData),
    skuGeneratedAt: new Date()
  };
} 