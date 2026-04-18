import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = 'C:\\poyw\\14255541 (1) (1).xlsm';
const maxRetries = 5;
const retryDelay = 500;

function readWithRetry() {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return fs.readFileSync(filePath);
    } catch (err) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < maxRetries) {
        console.log(`  File busy (attempt ${attempt}), waiting ${retryDelay}ms...`);
        const end = Date.now() + retryDelay;
        while (Date.now() < end) { /* wait */ }
      } else {
        throw err;
      }
    }
  }
}

try {
  const fileBuffer = readWithRetry();
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  const sheetsToExtract = ['product', 'Dashboard', 'admin', 'Buy', 'Output'];

  sheetsToExtract.forEach(name => {
    const sheet = workbook.Sheets[name];
    if (sheet) {
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      const fileName = `${name.toLowerCase()}_data.json`;
      fs.writeFileSync(fileName, JSON.stringify(jsonData, null, 2));
      console.log(`✅ ${name} → ${fileName} (${jsonData.length} rows)`);
    } else {
      console.warn(`⚠️ Sheet "${name}" not found`);
    }
  });

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
