import * as XLSX from 'xlsx';
import fs from 'fs';

const excelPath = 'C:\\poyw\\14255541 (1) (1).xlsm';

try {
  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  // Check Buy Headers
  const buySheet = workbook.Sheets['Buy'];
  if (buySheet) {
    const data = XLSX.utils.sheet_to_json(buySheet);
    if (data.length > 0) console.log('Buy Headers:', Object.keys(data[0]));
  }

  // Check Output Headers
  const outputSheet = workbook.Sheets['Output'];
  if (outputSheet) {
    const data = XLSX.utils.sheet_to_json(outputSheet);
    if (data.length > 0) console.log('Output Headers:', Object.keys(data[0]));
  }
} catch (err) {
  console.error('Error:', err.message);
}
