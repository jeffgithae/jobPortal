const fs = require('node:fs');
const path = require('node:path');

const outputPath = path.join(process.cwd(), 'public', 'runtime-config.js');
const apiBaseUrl = process.env.JOB_PORTAL_API_BASE_URL || 'http://localhost:3001/api';

const payload = `window.__JOB_PORTAL_CONFIG__ = ${JSON.stringify({ apiBaseUrl }, null, 2)};\n`;
fs.writeFileSync(outputPath, payload, 'utf8');
console.log(`Wrote runtime config to ${outputPath} with apiBaseUrl=${apiBaseUrl}`);
