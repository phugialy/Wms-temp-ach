import { Item } from '@prisma/client';
import { CreateItemInput } from './validator';

/**
 * Generates a SKU in the format: <BRAND>-<MODEL>-<STORAGE>-<COLOR>-<CARRIER>
 * Example: GOOGLE-PIXEL7-128GB-Obsidian-UNLOCKED
 */
export function generateSku(item: Partial<Item>): string {
  const brand = (item.brand || 'UNKNOWN').toUpperCase();
  const model = (item.model || 'UNKNOWN').toUpperCase();
  const storage = (item.storage || 'UNKNOWN').toUpperCase();
  const color = item.color ? capitalizeFirstLetter(item.color) : 'Unknown';
  const carrier = (item.carrier || 'UNKNOWN').toUpperCase();

  return `${brand}-${model}-${storage}-${color}-${carrier}`;
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
    brand: item.brand || null,
    model: item.model || null,
    storage: item.storage || null,
    color: item.color || null,
    carrier: item.carrier || null
  };

  return {
    sku: generateSku(itemData),
    skuGeneratedAt: new Date()
  };
} 