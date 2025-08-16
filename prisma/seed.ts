import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create DNCL warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { name: 'DNCL' },
    update: {},
    create: {
      name: 'DNCL',
      description: 'DNCL Main Warehouse',
      isActive: true
    }
  });

  console.log('✅ Created warehouse:', warehouse.name);

  // Create location categories
  const locations = [
    { name: 'Inspection', description: 'Devices under inspection/testing' },
    { name: 'Stock', description: 'Available inventory for sale' },
    { name: 'Return', description: 'Returned devices for processing' },
    { name: 'Repair', description: 'Devices under repair/maintenance' },
    { name: 'Shipped', description: 'Devices that have been shipped' }
  ];

  for (const locationData of locations) {
    const location = await prisma.location.upsert({
      where: {
        warehouseId_name: {
          warehouseId: warehouse.id,
          name: locationData.name
        }
      },
      update: {},
      create: {
        name: locationData.name,
        description: locationData.description,
        warehouseId: warehouse.id,
        isActive: true
      }
    });
    console.log(`✅ Created location: ${warehouse.name}-${location.name}`);
  }

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 