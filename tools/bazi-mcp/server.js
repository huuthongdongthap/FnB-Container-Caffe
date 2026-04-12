/**
 * Mekong IDE — Bazi MCP Tool Server
 * 
 * Thin HTTP wrapper around the bazi-mcp package.
 * Exposes REST endpoints for the Mekong orchestrator + /bazi command.
 * 
 * Port: 5002 (configurable via PORT env var)
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { getBaziDetail, getSolarTimes, getChineseCalendar } from 'bazi-mcp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const PORT = parseInt(process.env.PORT || '5002', 10);
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ── Helpers ───────────────────────────────────────────

function json(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ── Route Handlers ────────────────────────────────────

async function handleGetBazi(body) {
  const { solarDatetime, lunarDatetime, gender = 1, eightCharProviderSect = 2 } = body;
  
  if (!solarDatetime && !lunarDatetime) {
    return { error: 'Phải truyền solarDatetime hoặc lunarDatetime (một trong hai).', status: 400 };
  }
  
  const result = await getBaziDetail({
    solarDatetime,
    lunarDatetime,
    gender: typeof gender === 'string' ? (gender.toLowerCase() === 'female' || gender === '0' ? 0 : 1) : gender,
    eightCharProviderSect,
  });
  
  return { data: result, status: 200 };
}

async function handleGetSolarTimes(body) {
  const { bazi } = body;
  
  if (!bazi) {
    return { error: 'Phải truyền bazi (ví dụ: "戊寅 己未 己卯 辛未").', status: 400 };
  }
  
  const result = await getSolarTimes({ bazi });
  return { data: result, status: 200 };
}

async function handleGetCalendar(body) {
  const { solarDatetime } = body;
  const result = getChineseCalendar(solarDatetime);
  return { data: result, status: 200 };
}

// ── Server ────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const { method, url } = req;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    // ── GET /health ─────────────────────────────────
    if (method === 'GET' && url === '/health') {
      return json(res, 200, {
        status: 'ok',
        service: 'bazi-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    }

    // ── GET /tools ──────────────────────────────────
    if (method === 'GET' && url === '/tools') {
      return json(res, 200, {
        tools: [
          {
            name: 'getBaziDetail',
            description: 'Tính Bát Tự (八字) từ ngày dương/âm lịch. Calculate Bazi from solar/lunar datetime.',
            parameters: {
              solarDatetime: 'string (ISO format, e.g. 2000-05-15T12:00:00+08:00)',
              lunarDatetime: 'string (e.g. 2000-05-15 12:00:00)',
              gender: 'number (0=female, 1=male, default 1)',
              eightCharProviderSect: 'number (1 or 2, default 2)',
            },
          },
          {
            name: 'getSolarTimes',
            description: 'Tra ngược thời gian dương lịch từ Bát Tự. Get possible solar dates from Bazi.',
            parameters: {
              bazi: 'string (e.g. "戊寅 己未 己卯 辛未")',
            },
          },
          {
            name: 'getChineseCalendar',
            description: 'Lấy thông tin hoàng lịch. Get Chinese calendar / almanac info.',
            parameters: {
              solarDatetime: 'string (ISO format, optional — defaults to today)',
            },
          },
        ],
      });
    }

    // ── POST /bazi ──────────────────────────────────
    if (method === 'POST' && url === '/bazi') {
      const body = await readBody(req);
      const { data, error, status } = await handleGetBazi(body);
      if (error) return json(res, status, { error });
      return json(res, 200, { tool: 'getBaziDetail', source: 'bazi-mcp', data });
    }

    // ── POST /bazi/solar-times ──────────────────────
    if (method === 'POST' && (url === '/bazi/solar-times' || url === '/bazi/reverse')) {
      const body = await readBody(req);
      const { data, error, status } = await handleGetSolarTimes(body);
      if (error) return json(res, status, { error });
      return json(res, 200, { tool: 'getSolarTimes', source: 'bazi-mcp', data });
    }

    // ── POST /bazi/calendar ─────────────────────────
    if (method === 'POST' && url === '/bazi/calendar') {
      const body = await readBody(req);
      const { data, error, status } = await handleGetCalendar(body);
      if (error) return json(res, status, { error });
      return json(res, 200, { tool: 'getChineseCalendar', source: 'bazi-mcp', data });
    }

    // ── Static Files (Frontend) ──────────────────────
    if (method === 'GET') {
      const filePath = url === '/' ? '/index.html' : url;
      const safePath = join(PUBLIC_DIR, filePath);
      
      // Security: prevent directory traversal
      if (!safePath.startsWith(PUBLIC_DIR)) {
        return json(res, 403, { error: 'Forbidden' });
      }

      try {
        const content = await readFile(safePath);
        const ext = extname(safePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(content);
        return;
      } catch {
        // Fall through to 404
      }
    }

    // ── 404 ─────────────────────────────────────────
    json(res, 404, {
      error: 'Not found',
      available_endpoints: [
        'GET  /          (F&B Form UI)',
        'GET  /health',
        'GET  /tools',
        'POST /bazi',
        'POST /bazi/solar-times',
        'POST /bazi/calendar',
      ],
    });
  } catch (err) {
    console.error('[bazi-mcp] Error:', err.message || err);
    json(res, 500, { error: 'Internal server error', detail: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n🔮 Bazi MCP Server running on http://${HOST}:${PORT}`);
  console.log(`   🌐 F&B Form: http://${HOST}:${PORT}/`);
  console.log(`   Health:  GET  http://${HOST}:${PORT}/health`);
  console.log(`   Tools:   GET  http://${HOST}:${PORT}/tools`);
  console.log(`   Bazi:    POST http://${HOST}:${PORT}/bazi`);
  console.log(`   Reverse: POST http://${HOST}:${PORT}/bazi/solar-times`);
  console.log(`   Calendar:POST http://${HOST}:${PORT}/bazi/calendar\n`);
});

server.on('error', (err) => {
  console.error('[bazi-mcp] Server error:', err);
  process.exit(1);
});
