const bcrypt = require('bcrypt');
const { PrismaClient } = require('./dist/generated/prisma/client');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./data/iot_platform.db';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Existing users:', users.map(u => `${u.username} (${u.role})`));

  if (users.length === 0) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!initialPassword) {
      console.error('ERROR: INITIAL_ADMIN_PASSWORD environment variable is required to create the default admin user.');
      console.error('Please set it and run again, e.g.: INITIAL_ADMIN_PASSWORD=YourStrongPassword node seed.js');
      process.exit(1);
    }

    if (initialPassword.length < 8) {
      console.error('ERROR: INITIAL_ADMIN_PASSWORD must be at least 8 characters long.');
      process.exit(1);
    }

    console.log('No users found, creating admin...');
    const hashedPassword = await bcrypt.hash(initialPassword, 10);
    const admin = await prisma.user.create({
      data: {
        id: 'user-admin',
        username: 'admin',
        password: hashedPassword,
        email: 'admin@iot.local',
        role: 'admin',
      }
    });
    console.log('Created admin user:', admin.username);

    const household = await prisma.household.create({
      data: {
        id: 'household-default',
        name: '我的家',
        ownerId: admin.id,
      }
    });
    console.log('Created household:', household.name);

    await prisma.userHousehold.create({
      data: {
        userId: admin.id,
        householdId: household.id,
        role: 'admin',
      }
    });
    console.log('Linked admin to household');
  } else {
    console.log('Users already exist, skipping seed.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
