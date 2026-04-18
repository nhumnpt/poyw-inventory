import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'fs';

async function test() {
  try {
    const creds = JSON.parse(fs.readFileSync('google-creds.json'));
    const jwt = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const doc = new GoogleSpreadsheet('1wwISuNv4crde6I6CC0PoKRryNuhuxjuhiCihliIyews', jwt);
    await doc.loadInfo();
    console.log('Success! Connected to:', doc.title);
    Object.values(doc.sheetsById).forEach(s => {
      console.log(`- Sheet: ${s.title}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
