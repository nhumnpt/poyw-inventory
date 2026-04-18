import * as XLSX from 'xlsx';
import fs from 'fs';

const excelPath = 'C:\\poyw\\14255541 (1) (1).xlsm';

try {
  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(worksheet);
  if (data.length > 0) {
    console.log('--- พบหัวข้อคอลัมน์ดังนี้ ---');
    console.log(Object.keys(data[0]));
  } else {
    console.log('ไม่พบข้อมูลในไฟล์');
  }
} catch (err) {
  console.error('Error:', err.message);
}
