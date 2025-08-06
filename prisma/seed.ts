import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create sample items
  const items = await Promise.all([
    prisma.item.upsert({
      where: { sku: 'ITEM-001' },
      update: {},
      create: {
        sku: 'ITEM-001',
        name: 'Laptop Computer',
        description: 'High-performance laptop for business use',
        brand: 'Dell',
        model: 'Latitude 5520',
        condition: 'new',
        cost: 899.99,
        price: 1299.99,
        weightOz: 48,
        dimensions: '14.2" x 9.3" x 0.7"',
        imageUrl: 'https://example.com/laptop.jpg',
        isActive: true
      }
    }),
    prisma.item.upsert({
      where: { sku: 'ITEM-002' },
      update: {},
      create: {
        sku: 'ITEM-002',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse',
        brand: 'Logitech',
        model: 'MX Master 3',
        condition: 'new',
        cost: 45.00,
        price: 79.99,
        weightOz: 5,
        dimensions: '4.9" x 3.2" x 2.0"',
        imageUrl: 'https://example.com/mouse.jpg',
        isActive: true
      }
    }),
    prisma.item.upsert({
      where: { sku: 'ITEM-003' },
      update: {},
      create: {
        sku: 'ITEM-003',
        name: 'Office Chair',
        description: 'Comfortable office chair with lumbar support',
        brand: 'Herman Miller',
        model: 'Aeron',
        condition: 'used',
        cost: 350.00,
        price: 599.99,
        weightOz: 320,
        dimensions: '27" x 27" x 41"',
        imageUrl: 'https://example.com/chair.jpg',
        isActive: true
      }
    }),
    prisma.item.upsert({
      where: { sku: 'ITEM-004' },
      update: {},
      create: {
        sku: 'ITEM-004',
        name: 'Monitor',
        description: '27-inch 4K monitor',
        brand: 'LG',
        model: '27UL850-W',
        condition: 'new',
        cost: 299.99,
        price: 449.99,
        weightOz: 180,
        dimensions: '24.2" x 8.1" x 18.9"',
        imageUrl: 'https://example.com/monitor.jpg',
        isActive: true
      }
    }),
    prisma.item.upsert({
      where: { sku: 'ITEM-005' },
      update: {},
      create: {
        sku: 'ITEM-005',
        name: 'Keyboard',
        description: 'Mechanical keyboard with RGB lighting',
        brand: 'Corsair',
        model: 'K70 RGB',
        condition: 'used',
        cost: 80.00,
        price: 129.99,
        weightOz: 35,
        dimensions: '17.3" x 6.7" x 1.6"',
        imageUrl: 'https://example.com/keyboard.jpg',
        isActive: true
      }
    })
  ]);

  console.log('✅ Items created');

  // Create sample inventory records
  const inventory = await Promise.all([
    prisma.inventory.upsert({
      where: { 
        sku_location: {
          sku: 'ITEM-001',
          location: 'A1-B2-C3'
        }
      },
      update: {},
      create: {
        sku: 'ITEM-001',
        quantity: 15,
        location: 'A1-B2-C3'
      }
    }),
    prisma.inventory.upsert({
      where: { 
        sku_location: {
          sku: 'ITEM-001',
          location: 'A1-B2-C4'
        }
      },
      update: {},
      create: {
        sku: 'ITEM-001',
        quantity: 8,
        location: 'A1-B2-C4'
      }
    }),
    prisma.inventory.upsert({
      where: { 
        sku_location: {
          sku: 'ITEM-002',
          location: 'B3-C4-D5'
        }
      },
      update: {},
      create: {
        sku: 'ITEM-002',
        quantity: 25,
        location: 'B3-C4-D5'
      }
    }),
    prisma.inventory.upsert({
      where: { 
        sku_location: {
          sku: 'ITEM-003',
          location: 'C5-D6-E7'
        }
      },
      update: {},
      create: {
        sku: 'ITEM-003',
        quantity: 5,
        location: 'C5-D6-E7'
      }
    }),
    prisma.inventory.upsert({
      where: { 
        sku_location: {
          sku: 'ITEM-004',
          location: 'D7-E8-F9'
        }
      },
      update: {},
      create: {
        sku: 'ITEM-004',
        quantity: 12,
        location: 'D7-E8-F9'
      }
    }),
    prisma.inventory.upsert({
      where: { 
        sku_location: {
          sku: 'ITEM-005',
          location: 'E9-F0-G1'
        }
      },
      update: {},
      create: {
        sku: 'ITEM-005',
        quantity: 18,
        location: 'E9-F0-G1'
      }
    })
  ]);

  console.log('✅ Inventory records created');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 