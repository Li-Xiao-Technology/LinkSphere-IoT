const { PrismaClient: SqlitePrisma } = require('./prisma/sqlite-client');
const { PrismaClient: PgPrisma } = require('./prisma/pg-client');

const sqliteDb = new SqlitePrisma({ datasources: { db: { url: process.env.SQLITE_URL || 'file:./data/iot_platform.db' } } });
const pgDb = new PgPrisma({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function migrate() {
  console.log('Starting migration from SQLite to PostgreSQL...');

  const count = {
    users: 0,
    households: 0,
    userHouseholds: 0,
    rooms: 0,
    devices: 0,
    scenes: 0,
    schedules: 0,
    rules: 0,
    notifications: 0,
    energyLogs: 0,
  };

  try {
    const users = await sqliteDb.user.findMany();
    console.log(`Migrating ${users.length} users...`);
    for (const user of users) {
      await pgDb.user.upsert({
        where: { id: user.id },
        update: {
          username: user.username,
          password: user.password,
          email: user.email,
          role: user.role,
          householdId: user.householdId,
          createdAt: user.createdAt,
        },
        create: {
          id: user.id,
          username: user.username,
          password: user.password,
          email: user.email,
          role: user.role,
          householdId: user.householdId,
          createdAt: user.createdAt,
        },
      });
      count.users++;
    }

    const households = await sqliteDb.household.findMany();
    console.log(`Migrating ${households.length} households...`);
    for (const h of households) {
      await pgDb.household.upsert({
        where: { id: h.id },
        update: { name: h.name, ownerId: h.ownerId, createdAt: h.createdAt },
        create: { id: h.id, name: h.name, ownerId: h.ownerId, createdAt: h.createdAt },
      });
      count.households++;
    }

    const userHouseholds = await sqliteDb.userHousehold.findMany();
    console.log(`Migrating ${userHouseholds.length} userHouseholds...`);
    for (const uh of userHouseholds) {
      await pgDb.userHousehold.upsert({
        where: { userId_householdId: { userId: uh.userId, householdId: uh.householdId } },
        update: { role: uh.role },
        create: { userId: uh.userId, householdId: uh.householdId, role: uh.role },
      });
      count.userHouseholds++;
    }

    const rooms = await sqliteDb.room.findMany();
    console.log(`Migrating ${rooms.length} rooms...`);
    for (const room of rooms) {
      await pgDb.room.upsert({
        where: { id: room.id },
        update: { name: room.name, icon: room.icon, sortIndex: room.sortIndex, createdAt: room.createdAt },
        create: { id: room.id, name: room.name, icon: room.icon, sortIndex: room.sortIndex, createdAt: room.createdAt },
      });
      count.rooms++;
    }

    const devices = await sqliteDb.device.findMany();
    console.log(`Migrating ${devices.length} devices...`);
    for (const device of devices) {
      await pgDb.device.upsert({
        where: { id: device.id },
        update: {
          name: device.name,
          brand: device.brand,
          type: device.type,
          model: device.model,
          status: device.status,
          connectionType: device.connectionType,
          ipAddress: device.ipAddress,
          macAddress: device.macAddress,
          lastSyncTime: device.lastSyncTime,
          firmwareVersion: device.firmwareVersion,
          config: device.config,
          roomId: device.roomId,
          powerConsumption: device.powerConsumption,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt,
        },
        create: {
          id: device.id,
          name: device.name,
          brand: device.brand,
          type: device.type,
          model: device.model,
          status: device.status,
          connectionType: device.connectionType,
          ipAddress: device.ipAddress,
          macAddress: device.macAddress,
          lastSyncTime: device.lastSyncTime,
          firmwareVersion: device.firmwareVersion,
          config: device.config,
          roomId: device.roomId,
          powerConsumption: device.powerConsumption,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt,
        },
      });
      count.devices++;
    }

    const scenes = await sqliteDb.scene.findMany();
    console.log(`Migrating ${scenes.length} scenes...`);
    for (const scene of scenes) {
      await pgDb.scene.upsert({
        where: { id: scene.id },
        update: { name: scene.name, description: scene.description, icon: scene.icon, actions: scene.actions, updatedAt: scene.updatedAt },
        create: { id: scene.id, name: scene.name, description: scene.description, icon: scene.icon, actions: scene.actions, createdAt: scene.createdAt, updatedAt: scene.updatedAt },
      });
      count.scenes++;
    }

    const schedules = await sqliteDb.schedule.findMany();
    console.log(`Migrating ${schedules.length} schedules...`);
    for (const s of schedules) {
      await pgDb.schedule.upsert({
        where: { id: s.id },
        update: { name: s.name, cronExpression: s.cronExpression, action: s.action, enabled: s.enabled, updatedAt: s.updatedAt },
        create: { id: s.id, name: s.name, cronExpression: s.cronExpression, action: s.action, enabled: s.enabled, createdAt: s.createdAt, updatedAt: s.updatedAt },
      });
      count.schedules++;
    }

    const rules = await sqliteDb.rule.findMany();
    console.log(`Migrating ${rules.length} rules...`);
    for (const rule of rules) {
      await pgDb.rule.upsert({
        where: { id: rule.id },
        update: { name: rule.name, enabled: rule.enabled, triggerType: rule.triggerType, triggerCondition: rule.triggerCondition, actions: rule.actions, updatedAt: rule.updatedAt },
        create: { id: rule.id, name: rule.name, enabled: rule.enabled, triggerType: rule.triggerType, triggerCondition: rule.triggerCondition, actions: rule.actions, createdAt: rule.createdAt, updatedAt: rule.updatedAt },
      });
      count.rules++;
    }

    const notifications = await sqliteDb.notification.findMany();
    console.log(`Migrating ${notifications.length} notifications...`);
    for (const n of notifications) {
      await pgDb.notification.upsert({
        where: { id: n.id },
        update: { type: n.type, title: n.title, body: n.body, deviceId: n.deviceId, read: n.read, createdAt: n.createdAt },
        create: { id: n.id, type: n.type, title: n.title, body: n.body, deviceId: n.deviceId, read: n.read, createdAt: n.createdAt },
      });
      count.notifications++;
    }

    const totalEnergyLogs = await sqliteDb.energyLog.count();
    console.log(`Migrating ${totalEnergyLogs} energy logs (batch)...`);
    const batchSize = 500;
    for (let i = 0; i < totalEnergyLogs; i += batchSize) {
      const logs = await sqliteDb.energyLog.findMany({ skip: i, take: batchSize });
      await pgDb.energyLog.createMany({
        data: logs.map(l => ({
          id: l.id,
          deviceId: l.deviceId,
          power: l.power,
          recordedAt: l.recordedAt,
        })),
        skipDuplicates: true,
      });
      count.energyLogs += logs.length;
      process.stdout.write(`  ${Math.min(i + batchSize, totalEnergyLogs)}/${totalEnergyLogs}\r`);
    }
    console.log('\n');

    console.log('✅ Migration complete!');
    console.table(count);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sqliteDb.$disconnect();
    await pgDb.$disconnect();
  }
}

migrate();
