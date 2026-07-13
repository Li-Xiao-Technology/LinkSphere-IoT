const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/data/iot_platform.db');
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='Rule'", (e, rows) => {
  console.log('Rule table exists:', rows.length > 0);
  if (rows.length > 0) {
    db.all('SELECT * FROM "Rule"', (e2, rules) => {
      console.log('Rules count:', rules?.length ?? 0);
      rules?.forEach(r => console.log(' -', r.id, r.name, r.enabled));
      db.close();
    });
  } else {
    console.log('Tables:', []);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (e3, tables) => {
      tables?.forEach(t => console.log('Table:', t.name));
      db.close();
    });
  }
});
