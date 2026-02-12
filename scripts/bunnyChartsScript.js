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

/// <reference types="@bunny.net/edgescript-sdk" />

import * as BunnySDK from "@bunny.net/edgescript-sdk";
import { createClient } from '@libsql/client/web';

// Initialize libSQL client with Bunny Database credentials
const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_ACCESS_TOKEN,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Helper function to create JSON responses
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

BunnySDK.net.http.serve(async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // Route matching - check specific routes before generic patterns
    
    // GET /api/charts - List all charts
    if (request.method === 'GET' && path === '/api/charts') {
      return await listCharts();
    }
    
    // POST /api/charts - Create new chart (autoincrement ID)
    if (request.method === 'POST' && path === '/api/charts') {
      const data = await request.json();
      return await createChart(data);
    }
    
    // GET /api/charts/types - Get all available chart types
    if (request.method === 'GET' && path === '/api/charts/types') {
      return await getChartTypes();
    }
    
    // GET /api/charts/templates/:type - Get template for chart type
    const templateMatch = path.match(/^\/api\/charts\/templates\/([a-z]+)$/);
    if (request.method === 'GET' && templateMatch) {
      const chartType = templateMatch[1];
      return await getTemplate(chartType);
    }
    
    // GET /api/charts/{chartId} - Retrieve chart config
    // PUT /api/charts/{chartId} - Update existing chart
    const chartIdMatch = path.match(/^\/api\/charts\/(\d+)$/);
    
    if (request.method === 'GET' && chartIdMatch) {
      const chartId = parseInt(chartIdMatch[1]);
      return await getChart(chartId);
    }
    
    if (request.method === 'PUT' && chartIdMatch) {
      const chartId = parseInt(chartIdMatch[1]);
      const data = await request.json();
      return await updateChart(chartId, data);
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
    
  } catch (error) {
    console.error("Error handling request:", error);
    return jsonResponse(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      },
      500
    );
  }
});

/**
 * Retrieve chart configuration from database
 */
async function getChart(chartId) {
  try {
    const result = await client.execute({
      sql: 'SELECT chart_id, type, title, description, config, created_at, updated_at FROM charts WHERE chart_id = ?',
      args: [chartId],
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
        updated: row.updated_at,
      },
      config: JSON.parse(row.config),
    };
    
    return jsonResponse(chartData);
  } catch (error) {
    console.error('Error fetching chart:', error);
    throw error;
  }
}

/**
 * Save chart configuration to database
 */
async function saveChart(chartId, data) {
  try {
    // Validate data structure
    if (!data.config || typeof data.config !== 'object') {
      return jsonResponse({ error: 'Invalid data: config object required' }, 400);
    }
    
    const now = new Date().toISOString();
    const type = data.type || 'line';
    const title = data.metadata?.title || chartId;
    const description = data.metadata?.description || '';
    const configJson = JSON.stringify(data.config);
    
    // Check if chart exists to preserve created_at
    const existingResult = await client.execute({
      sql: 'SELECT created_at FROM charts WHERE chart_id = ?',
      args: [chartId],
    });
    
    const createdAt = existingResult.rows.length > 0
      ? existingResult.rows[0].created_at
      : now;
    
    // Upsert chart
    await client.execute({
      sql: `INSERT INTO charts (type, title, description, config, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
              type = excluded.type,
              title = excluded.title,
              description = excluded.description,
              config = excluded.config,
              updated_at = excluded.updated_at`,
      args: [chartId, type, title, description, configJson, createdAt, now],
    });
    
    return jsonResponse({ success: true, chartId, updated: now });
  } catch (error) {
    console.error('Error saving chart:', error);
    throw error;
  }
}

/**
 * List all available charts from database
 */
async function listCharts() {
  try {
    const result = await client.execute({
      sql: 'SELECT chart_id, type, title, updated_at FROM charts ORDER BY updated_at DESC',
      args: [],
    });
    
    const charts = result.rows.map(row => ({
      chartId: row.chart_id,
      type: row.type,
      title: row.title,
      updated: row.updated_at,
    }));
    
    return jsonResponse({ charts });
  } catch (error) {
    console.error('Error listing charts:', error);
    throw error;
  }
}

/**
 * Get chart template configuration for a specific chart type
 */
async function getTemplate(chartType) {
  try {
    const result = await client.execute({
      sql: 'SELECT chart_type, template_config FROM chart_templates WHERE chart_type = ?',
      args: [chartType],
    });
    
    if (result.rows.length === 0) {
      return jsonResponse({ error: 'Template not found for this chart type' }, 404);
    }
    
    const row = result.rows[0];
    return jsonResponse({
      type: row.chart_type,
      config: JSON.parse(row.template_config),
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
}

/**
 * Get all available chart types from chart_templates table
 */
async function getChartTypes() {
  try {
    const result = await client.execute({
      sql: 'SELECT chart_type, description FROM chart_templates ORDER BY chart_type',
      args: [],
    });
    
    const types = result.rows.map(row => ({
      value: row.chart_type,
      label: row.chart_type.charAt(0).toUpperCase() + row.chart_type.slice(1),
      description: row.description,
    }));
    
    return jsonResponse({ types });
  } catch (error) {
    console.error('Error fetching chart types:', error);
    throw error;
  }
}
