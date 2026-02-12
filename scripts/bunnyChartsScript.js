/**
 * Bunny.net Edge Script API for Chart Data Management
 * 
 * Deploy this to Bunny.net Edge Scripting
 * Database: BunnyDB (libsql)
 * 
 * Endpoints:
 * - GET  /api/charts/{chartId}      - Retrieve chart configuration
 * - POST /api/charts/{chartId}      - Save/update chart configuration
 * - GET  /api/charts                - List all chart IDs
 * 
 * Required Secrets (set in Bunny.net Edge Script settings):
 * - DATABASE_URL - libsql database URL (e.g., libsql://your-db.lite.bunnydb.net/)
 * - DATABASE_ACCESS_TOKEN - API key for database access
 */

import { createClient } from '@libsql/client/web';

export default {
  async fetch(request, env) {
    // Access environment variables from secrets
    const DATABASE_URL = env.DATABASE_URL;
    const DATABASE_ACCESS_TOKEN = env.DATABASE_ACCESS_TOKEN;
    
    // Validate that required secrets are set
    if (!DATABASE_URL || !DATABASE_ACCESS_TOKEN) {
      return jsonResponse({ 
        error: 'Server configuration error: Missing required secrets' 
      }, 500);
    }
    
    // Create database client
    const db = createClient({
      url: DATABASE_URL,
      authToken: DATABASE_ACCESS_TOKEN,
    });
    
    // Initialize database table
    await initializeDatabase(db);
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Route matching
    const chartIdMatch = path.match(/^\/api\/charts\/([a-zA-Z0-9-_]+)$/);
    
    try {
      // GET /api/charts/{chartId} - Retrieve chart config
      if (request.method === 'GET' && chartIdMatch) {
        const chartId = chartIdMatch[1];
        return await getChart(db, chartId);
      }
      
      // POST /api/charts/{chartId} - Save chart config
      if (request.method === 'POST' && chartIdMatch) {
        const chartId = chartIdMatch[1];
        
        // TODO: Add proper admin session authentication here
        // For now, allow POST requests without API key validation
        
        const data = await request.json();
        return await saveChart(db, chartId, data);
      }
      
      // GET /api/charts - List all charts
      if (request.method === 'GET' && path === '/api/charts') {
        return await listCharts(db);
      }
      
      return jsonResponse({ error: 'Not found' }, 404);
      
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }
};


/**
 * Retrieve chart configuration from database
 */
async function getChart(db, chartId) {
  const result = await db.execute({
    sql: 'SELECT * FROM charts WHERE chart_id = ?',
    args: [chartId]
  });
  
  if (result.rows.length === 0) {
    return jsonResponse({ error: 'Chart not found' }, 404);
  }
  
  const row = result.rows[0];
  const chartData = {
    chartId: row.chart_id,
    type: row.type,
    metadata: {
      title: row.title,
      description: row.description,
      created: row.created_at,
      updated: row.updated_at
    },
    config: JSON.parse(row.config)
  };
  
  return jsonResponse(chartData);
}

/**
 * Save chart configuration to database
 * 
 * Expected data format:
 * {
 *   "type": "line|bar|pie|scatter|...",  // ECharts type
 *   "metadata": {
 *     "title": "Chart Title",
 *     "description": "Chart description"
 *   },
 *   "config": {
 *     // Full ECharts option object
 *     "title": { "text": "..." },
 *     "series": [...],
 *     "xAxis": [...],
 *     // ... any ECharts configuration
 *   }
 * }
 */
async function saveChart(db, chartId, data) {
  // Validate data structure
  if (!data.config || typeof data.config !== 'object') {
    return jsonResponse({ error: 'Invalid data: config object required' }, 400);
  }
  
  const now = new Date().toISOString();
  const type = data.type || 'line';
  const title = data.metadata?.title || chartId;
  const description = data.metadata?.description || '';
  const configJson = JSON.stringify(data.config);
  
  // Check if chart exists
  const existingResult = await db.execute({
    sql: 'SELECT created_at FROM charts WHERE chart_id = ?',
    args: [chartId]
  });
  
  const createdAt = existingResult.rows.length > 0 
    ? existingResult.rows[0].created_at 
    : now;
  
  // Upsert chart
  await db.execute({
    sql: `
      INSERT INTO charts (chart_id, type, title, description, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chart_id) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        description = excluded.description,
        config = excluded.config,
        updated_at = excluded.updated_at
    `,
    args: [chartId, type, title, description, configJson, createdAt, now]
  });
  
  return jsonResponse({ success: true, chartId, updated: now });
}

/**
 * List all available charts from database
 */
async function listCharts(db) {
  const result = await db.execute(
    'SELECT chart_id, type, title, updated_at FROM charts ORDER BY updated_at DESC'
  );
  
  const charts = result.rows.map(row => ({
    chartId: row.chart_id,
    type: row.type,
    title: row.title,
    updated: row.updated_at
  }));
  
  return jsonResponse({ charts });
}

/**
 * Helper function to create JSON responses with CORS headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}