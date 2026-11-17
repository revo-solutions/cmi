import { writeFile } from 'node:fs/promises';

const url = process.env.OPENAPI_URL ?? 'http://localhost:5090/openapi/v1.json';
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`OpenAPI: HTTP ${response.status} (${url})`);
}

const document = await response.json();
delete document.servers;
await writeFile(new URL('../openapi.json', import.meta.url), JSON.stringify(document, null, 2) + '\n');
