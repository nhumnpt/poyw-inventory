import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const projectDir = process.cwd();

// Environment Variables
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1wwISuNv4crde6I6CC0PoKRryNuhuxjuhiCihliIyews';

// JSON file paths
const productJsonPath = path.join(projectDir, 'product_data.json');
const buyJsonPath = path.join(projectDir, 'buy_data.json');
const outputJsonPath = path.join(projectDir, 'output_data.json');
const adminJsonPath = path.join(projectDir, 'admin_data.json');

app.use(cors());
app.use(express.json());

// Serve static files from the React app build folder
app.use(express.static(path.join(projectDir, 'dist')));

// Helper: read JSON file safely
function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return [];
  }
}

// Helper: write JSON file
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
  }
}

// Helper: Google Sheets Init
async function getDoc() {
  let creds;
  if (process.env.GOOGLE_CREDS_JSON) {
    // Priority 1: Environment Variable (for Render/Railway)
    creds = JSON.parse(process.env.GOOGLE_CREDS_JSON);
  } else {
    // Priority 2: Local file (for Development)
    const credsPath = path.join(projectDir, 'google-creds.json');
    if (fs.existsSync(credsPath)) {
      creds = JSON.parse(fs.readFileSync(credsPath));
    } else {
      throw new Error(`Google Credentials missing! Please set GOOGLE_CREDS_JSON env var or add google-creds.json at ${credsPath}`);
    }
  }

  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
  await doc.loadInfo();
  return doc;
}

// Helper: try to sync to Google Sheets
async function trySyncToGoogleSheets(type, newLog, productId, newBalance, inputPrice, isNewProduct, productName) {
  try {
    const doc = await getDoc();
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
      if (!found && isNewProduct) {
        await productSheet.addRow({
          'รหัสพัสดุ': Number(productId) || productId,
          'ชื่อพัสดุ': productName || '',
          'ราคาซื้อ': inputPrice,
          'ยอดคงเหลือ': newBalance,
          'หน่วยนับ': 'ชิ้น',
          'จำนวนขั้นต่ำ': 5
        });
      }
    }
    const targetSheetName = type === 'purchase' ? 'Buy' : 'Output';
    const historySheet = doc.sheetsByTitle[targetSheetName];
    if (historySheet) await historySheet.addRow(newLog);
    return true;
  } catch (err) {
    console.error('GS Sync Error:', err.message);
    return false;
  }
}

// APIs
app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  const admins = readJson(adminJsonPath);
  const matched = admins.find(a => String(a.username).trim() === String(username).trim() && String(a.password).trim() === String(password).trim());
  if (matched) res.json({ success: true, name: matched.name || username });
  else res.status(401).json({ error: 'Username หรือ Password ไม่ถูกต้อง' });
});

app.post('/api/update-inventory', async (req, res) => {
  try {
    const { type, date, productId, productName, price, quantity } = req.body;
    const qty = Math.abs(Number(quantity)) || 0;
    const inputPrice = Math.abs(Number(price)) || 0;

    const products = readJson(productJsonPath);
    const buyData = readJson(buyJsonPath);
    const outputData = readJson(outputJsonPath);

    let product = products.find(p => String(p['รหัสพัสดุ']) === String(productId));
    let isNewProduct = false;
    if (!product && type === 'purchase') {
      isNewProduct = true;
      product = { 'รหัสพัสดุ': Number(productId) || productId, 'ชื่อพัสดุ': productName || `สินค้า ${productId}`, 'ราคาซื้อ': inputPrice, 'ยอดคงเหลือ': 0, 'หน่วยนับ': 'ชิ้น', 'จำนวนขั้นต่ำ': 5, 'รวม': 0 };
      products.push(product);
    }
    if (!product) return res.status(400).json({ error: 'ไม่พบสินค้า' });

    const newBalance = type === 'purchase' ? Number(product['ยอดคงเหลือ'] || 0) + qty : Number(product['ยอดคงเหลือ'] || 0) - qty;
    if (type === 'sales' && newBalance < 0) return res.status(400).json({ error: 'ยอดคงเหลือไม่เพียงพอ' });

    product['ยอดคงเหลือ'] = newBalance;
    if (type === 'purchase' && inputPrice > 0) product['ราคาซื้อ'] = inputPrice;
    products.forEach(p => { p['รวม'] = (Number(p['ราคาซื้อ'] || 0)) * (Number(p['ยอดคงเหลือ'] || 0)); });

    const newLog = type === 'purchase' 
        ? { 'วันที่': date, 'รหัสพัสดุ': productId, 'ชื่อพัสดุ': product['ชื่อพัสดุ'], 'ราคาซื้อ': inputPrice, 'จำนวนที่ซื้อ': qty, 'มูลค่ารวม': inputPrice * qty }
        : { 'วันที่': date, 'รหัสพัสดุ': productId, 'ชื่อพัสดุ': product['ชื่อพัสดุ'], 'จำนวนที่ออก': qty, 'พัสดุคงเหลือ': newBalance };

    if (type === 'purchase') buyData.push(newLog); else outputData.push(newLog);

    writeJson(productJsonPath, products);
    writeJson(type === 'purchase' ? buyJsonPath : outputJsonPath, type === 'purchase' ? buyData : outputData);

    const excelSynced = await trySyncToGoogleSheets(type, newLog, productId, newBalance, inputPrice, isNewProduct, product['ชื่อพัสดุ']);
    res.json({ message: 'Success', newBalance, excelSynced });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data', (req, res) => {
  res.json({
    product: readJson(productJsonPath),
    buy: readJson(buyJsonPath),
    output: readJson(outputJsonPath),
    admin: readJson(adminJsonPath),
    dashboard: readJson(path.join(projectDir, 'dashboard_data.json'))
  });
});

app.post('/api/sync-from-excel', async (req, res) => {
  await pullGoogleSheets();
  res.json({ message: 'Synced' });
});

// Helper: Pull Google Sheets
async function pullGoogleSheets() {
  try {
    const doc = await getDoc();
    const sheets = ['product', 'Dashboard', 'admin', 'Buy', 'Output'];
    for (const name of sheets) {
      try {
        const sheet = doc.sheetsByTitle[name];
        if (!sheet) continue;
        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        const headers = sheet.headerValues;
        const data = rows.map(r => {
          const o = {};
          headers.forEach(h => { o[h] = r.get(h) });
          Object.keys(o).forEach(k => { if (!isNaN(o[k]) && o[k] !== '' && o[k] !== null) o[k] = Number(o[k]); });
          return o;
        });
        writeJson(path.join(projectDir, `${name.toLowerCase()}_data.json`), data);
      } catch (e) {}
    }
    console.log('↓ Synced from Google Sheets');
  } catch (e) { console.error('GS Pull Error:', e.message); }
}

setInterval(pullGoogleSheets, 30000); // Poll every 30s in production
pullGoogleSheets();

// Catch-all to serve index.html for SPA
// Fallback middleware to serve index.html for SPA routes
app.use((req, res) => {
  const indexPath = path.join(projectDir, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Frontend is building... please refresh in a minute.');
  }
});


app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
