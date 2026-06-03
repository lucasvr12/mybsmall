const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const firstEq = line.indexOf('=');
    if (firstEq === -1) return;
    const key = line.substring(0, firstEq).trim();
    let val = line.substring(firstEq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
    env[key] = val;
  });
  return env;
}

function base64url(str, encoding = 'utf8') {
  return Buffer.from(str, encoding).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(email, privateKey) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat
  };

  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  const signature = signer.sign(privateKey, 'base64');
  const encodedSignature = signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${input}.${encodedSignature}`;

  return new Promise((resolve, reject) => {
    const postData = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode !== 200) reject(new Error(`Token exchange failed (${res.statusCode}): ${JSON.stringify(parsed)}`));
          else resolve(parsed.access_token);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchSpreadsheetData(accessToken, spreadsheetId) {
  return new Promise((resolve, reject) => {
    const ranges = [
      "Sucursales!A:F",
      "Servicios!A:F",
      "Staff!A:E",
      "Staff_Sucursales!A:C",
      "Staff_Servicios!A:C",
      "Horarios!A:F",
      "Bloqueos!A:H",
    ];
    const pathParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const req = https.request({
      hostname: 'sheets.googleapis.com',
      path: `/v4/spreadsheets/${spreadsheetId}/values:batchGet?${pathParams}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const env = loadEnvLocal();
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = env.GOOGLE_PRIVATE_KEY;
  if (privateKey) privateKey = privateKey.replace(/\\n/g, "\n");
  const adminId = env.GOOGLE_SHEETS_ADMIN_ID;

  if (!email || !privateKey || !adminId) {
    console.error("Missing required variables in .env.local!");
    return;
  }

  try {
    const token = await getAccessToken(email, privateKey);
    const result = await fetchSpreadsheetData(token, adminId);
    console.log(`Response status: ${result.status}`);
    if (result.status !== 200) {
       console.log("Error data:", JSON.stringify(result.data, null, 2));
    } else {
       console.log("Data ranges retrieved successfully:", result.data.valueRanges ? result.data.valueRanges.length : 0);
    }
  } catch (err) {
    console.error("Error occurred:", err.message);
  }
}

main();
