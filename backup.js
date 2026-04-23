const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/service-finder';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(__dirname, 'backups', timestamp);

async function run() {
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const collections = await db.listCollections().toArray();
  for (const coll of collections) {
    const name = coll.name;
    try {
      const docs = await db.collection(name).find({}).toArray();
      const filePath = path.join(outDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
      console.log(`Exported ${name} -> ${filePath}`);
    } catch (err) {
      console.error(`Failed to export collection ${name}:`, err);
    }
  }

  await mongoose.disconnect();
  console.log(`Backup completed: ${outDir}`);
}

run().catch(err => {
  console.error('Backup failed', err);
  process.exit(1);
});
