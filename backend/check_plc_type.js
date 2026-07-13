const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('prisma/data/iot_platform.db');

console.log('=== Device Types ===');
db.all('SELECT id, name, type, brand FROM Device', (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  rows.forEach(row => {
    console.log(`ID: ${row.id}`);
    console.log(`  Name: ${row.name}`);
    console.log(`  Type: "${row.type}"`);
    console.log(`  Brand: "${row.brand}"`);
    console.log();
  });
  db.close();
});
