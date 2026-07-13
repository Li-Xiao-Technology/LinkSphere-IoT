const { PrismaClient } = require('./dist/generated/prisma/client');
process.env.DATABASE_URL = 'file:./data/iot_platform.db';
const prisma = new PrismaClient();

async function main() {
  console.log('Users:', JSON.stringify(await prisma.user.findMany({ select: { id: true, username: true, role: true } })));
  console.log('Households:', JSON.stringify(await prisma.household.findMany()));
  console.log('UserHouseholds:', JSON.stringify(await prisma.userHousehold.findMany()));

  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (admin) {
    const existingUH = await prisma.userHousehold.findUnique({ where: { userId: admin.id } });
    if (!existingUH) {
      console.log('Creating household for admin...');
      const household = await prisma.household.create({
        data: {
          id: 'household-admin-' + Date.now(),
          name: '我的家',
          ownerId: admin.id,
          createdAt: new Date(),
        }
      });
      await prisma.userHousehold.create({
        data: {
          userId: admin.id,
          householdId: household.id,
          role: 'owner',
        }
      });
      console.log('Created household:', household.name);
    } else {
      console.log('Admin already has household:', existingUH.householdId);
    }
  }
}

main().catch(e => { console.error(e); }).finally(() => prisma.$disconnect());
