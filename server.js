import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const app = express();
const port = 3001;
const projectDir = 'C:\\poyw\\app product'; // Update this for production
const SPREADSHEET_ID = '1wwISuNv4crde6I6CC0PoKRryNuhuxjuhiCihliIyews';

// JSON file paths (same as what frontend imports)
const productJsonPath = path.join(projectDir, 'product_data.json');
const buyJsonPath = path.join(projectDir, 'buy_data.json');
const outputJsonPath = path.join(projectDir, 'output_data.json');

app.use(cors());
app.use(express.json());

// ===== Helper: read JSON file safely =====
function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return [];
  }
}

// ===== Helper: write JSON file =====
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ===== Helper: Google Sheets Init =====
async function getDoc() {
  const creds = JSON.parse(fs.readFileSync(path.join(projectDir, 'google-creds.json')));
  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
  await doc.loadInfo();
  return doc;
}

// ===== Helper: try to sync to Google Sheets (non-blocking, best-effort) =====
async function trySyncToGoogleSheets(type, newLog, productId, newBalance, inputPrice, isNewProduct, productName) {
  try {
    const doc = await getDoc();

    // 1. Update product sheet balance
    const productSheet = doc.sheetsByTitle['product'];
    if (productSheet) {
      await productSheet.loadHeaderRow();
      const rows = await productSheet.getRows();
      
      let found = false;
      for (const row of rows) {
        if (String(row.get('รหัสพัสดุ')) === String(productId)) {
          found = true;
          if (newBalance !== undefined) row.set('ยอดคงเหลือ', newBalance);
          if (type === 'purchase' && inputPrice > 0) row.set('ราคาซื้อ', inputPrice);
          await row.save();
          break;
        }
      }

      // If product not found, add new row
      if (!found && isNewProduct) {
        await productSheet.addRow({
          'รหัสพัสดุ': Number(productId) || productId,
          'ชื่อพัสดุ': productName || '',
          'ราคาซื้อ': inputPrice,
          'ยอดคงเหลือ': newBalance,
          'หน่วยนับ': 'ชิ้น',
          'จำนวนขั้นต่ำ': 5
        });
        console.log(`  ✨ New product added to Google Sheets: "${productName}" (${productId})`);
      }
    }

    // 2. Append to Buy or Output sheet
    const targetSheetName = type === 'purchase' ? 'Buy' : 'Output';
    const historySheet = doc.sheetsByTitle[targetSheetName];
    if (historySheet) {
      await historySheet.addRow(newLog);
    }

    console.log('  ✅ Google Sheets synced!');
    return true;
  } catch (err) {
    console.error('  ❌ Google Sheets sync error:', err.message);
    return false;
  }
}

// ===== Admin Login API =====
const adminJsonPath = path.join(projectDir, 'admin_data.json');

app.post('/api/admin-login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอก Username และ Password' });
    }

    const admins = readJson(adminJsonPath);
    const matched = admins.find(
      a => String(a.username).trim() === String(username).trim()
        && String(a.password).trim() === String(password).trim()
    );

    if (matched) {
      console.log(`✅ Admin login: ${username}`);
      res.json({ success: true, name: matched.name || username });
    } else {
      console.log(`❌ Failed login attempt: ${username}`);
      res.status(401).json({ error: 'Username หรือ Password ไม่ถูกต้อง' });
    }
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== Main API: buy/output transactions =====
app.post('/api/update-inventory', async (req, res) => {
  try {
    const { type, date, productId, productName, price, quantity } = req.body;
    console.log('\n=== New Transaction ===');
    console.log('Type:', type, '| Product:', productId, '| Name:', productName || '(existing)', '| Qty:', quantity, '| Price:', price);

    const qty = Math.abs(Number(quantity)) || 0;
    const inputPrice = Math.abs(Number(price)) || 0;

    // 1. Read current JSON data
    const products = readJson(productJsonPath);
    const buyData = readJson(buyJsonPath);
    const outputData = readJson(outputJsonPath);

    // 2. Find product and calculate
    let product = products.find(p => String(p['รหัสพัสดุ']) === String(productId));
    let isNewProduct = false;
    
    // If product doesn't exist and this is a purchase, create it
    if (!product && type === 'purchase') {
      isNewProduct = true;
      const newProduct = {
        'รหัสพัสดุ': Number(productId) || productId,
        'ชื่อพัสดุ': productName || `สินค้า ${productId}`,
        'ราคาซื้อ': inputPrice,
        'ยอดคงเหลือ': 0,
        'หน่วยนับ': 'ชิ้น',
        'จำนวนขั้นต่ำ': 5,
        'รวม': 0
      };
      products.push(newProduct);
      product = newProduct;
      console.log(`✨ New product created: "${newProduct['ชื่อพัสดุ']}" (${productId})`);
    }

    if (!product) {
      return res.status(400).json({ error: `ไม่พบสินค้ารหัส ${productId} ในระบบ` });
    }

    const pName = String(product['ชื่อพัสดุ'] || '');
    const currentBalance = Number(product['ยอดคงเหลือ'] || 0);
    const newBalance = type === 'purchase' ? currentBalance + qty : currentBalance - qty;

    // Prevent negative stock on output
    if (type === 'sales' && newBalance < 0) {
      console.log(`❌ Rejected: would make balance ${newBalance} (current: ${currentBalance}, qty: ${qty})`);
      return res.status(400).json({
        error: `ไม่สามารถเบิกได้! ยอดคงเหลือ ${currentBalance} ชิ้น แต่ต้องการเบิก ${qty} ชิ้น`
      });
    }

    console.log(`Product: "${pName}" | Balance: ${currentBalance} → ${newBalance}`);

    // 3. Update product balance in JSON
    product['ยอดคงเหลือ'] = newBalance;
    if (type === 'purchase' && inputPrice > 0) {
      product['ราคาซื้อ'] = inputPrice;
    }

    // Recalculate รวม for ALL products (ensures consistency)
    products.forEach(p => {
      p['รวม'] = (Number(p['ราคาซื้อ'] || 0)) * (Number(p['ยอดคงเหลือ'] || 0));
    });

    // 4. Create log entry and append to history JSON
    let newLog;
    if (type === 'purchase') {
      newLog = {
        'วันที่': date,
        'รหัสพัสดุ': Number(productId) || productId,
        'ชื่อพัสดุ': pName,
        'ราคาซื้อ': inputPrice,
        'จำนวนที่ซื้อ': qty,
        'มูลค่ารวม': inputPrice * qty
      };
      buyData.push(newLog);
    } else {
      newLog = {
        'วันที่': date,
        'รหัสพัสดุ': Number(productId) || productId,
        'ชื่อพัสดุ': pName,
        'จำนวนที่ออก': qty,
        'พัสดุคงเหลือ': newBalance
      };
      outputData.push(newLog);
    }

    // 5. Save to JSON files (always works, no lock issues)
    writeJson(productJsonPath, products);
    writeJson(type === 'purchase' ? buyJsonPath : outputJsonPath, type === 'purchase' ? buyData : outputData);
    console.log('✅ JSON data saved!');
    console.log('Log:', JSON.stringify(newLog));

    // 6. Try to sync to Google Sheets
    const excelSynced = await trySyncToGoogleSheets(type, newLog, productId, newBalance, inputPrice, isNewProduct, pName);

    res.json({
      message: 'Success',
      newBalance,
      excelSynced,
      note: excelSynced ? 'ข้อมูลบันทึกลง Google Sheets และ JSON แล้ว' : 'ข้อมูลบันทึกลงแค่คลังเครื่อง (ไม่สามารถ sync Google Sheets ได้)'
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== Helper: Pull from Google Sheets to JSON =====
async function pullGoogleSheets() {
  try {
    const doc = await getDoc();
    const sheetsToExtract = ['product', 'Dashboard', 'admin', 'Buy', 'Output'];
    for (const name of sheetsToExtract) {
      try {
        const sheet = doc.sheetsByTitle[name];
        if (sheet) {
          await sheet.loadHeaderRow();
          const rows = await sheet.getRows();
          const headers = sheet.headerValues;
          
          const jsonData = rows.map(r => {
            const obj = {};
            headers.forEach(h => { obj[h] = r.get(h) });
            Object.keys(obj).forEach(k => {
              if (!isNaN(obj[k]) && obj[k] !== '' && obj[k] !== null) {
                obj[k] = Number(obj[k]);
              }
            });
            return obj;
          });
          
          const fileName = path.join(projectDir, `${name.toLowerCase()}_data.json`);
          const stringified = JSON.stringify(jsonData, null, 2);
          
          if (fs.existsSync(fileName)) {
            const current = fs.readFileSync(fileName, 'utf-8');
            if (current === stringified) continue;
          }
          
          fs.writeFileSync(fileName, stringified, 'utf-8');
          console.log(`↓ Fetched update from Google Sheets: ${name} (${jsonData.length} rows)`);
        }
      } catch(sheetErr) {
        console.error(`  ⚠️ Skipped sheet "${name}" due to error: ${sheetErr.message}`);
      }
    }
  } catch(e) {
    console.error('❌ Check GS Error:', e.message);
  }
}

// Start polling every 10 seconds, and run once immediately
setInterval(pullGoogleSheets, 10000);
pullGoogleSheets();

app.get('/api/data', (req, res) => {
  try {
    const data = {
      product: readJson(productJsonPath),
      buy: readJson(buyJsonPath),
      output: readJson(outputJsonPath),
      admin: readJson(adminJsonPath),
      dashboard: fs.existsSync(path.join(projectDir, 'dashboard_data.json')) ? readJson(path.join(projectDir, 'dashboard_data.json')) : []
    };
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Manual sync endpoint: force pull from Google Sheets =====
app.post('/api/sync-from-excel', async (req, res) => {
  try {
    await pullGoogleSheets();
    res.json({ message: 'Synced from Google Sheets successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`\n🚀 Server running on port ${port} (Auto-syncing with Google Sheets)\n`));
