/**
 * Bunny.net Edge Script API for Chart Data Management
 * 
 * Deploy this to Bunny.net Edge Scripting
 * Database: Use Bunny.net Edge Storage or your preferred database
 * 
 * Endpoints:
 * - GET  /api/charts/{chartId}      - Retrieve chart configuration
 * - POST /api/charts/{chartId}      - Save/update chart configuration
 * - GET  /api/charts                - List all chart IDs
 * 
 * Required Secrets (set in Bunny.net Edge Script settings):
 * - DATABASE_URL - Base URL for your storage (e.g., https://storage.bunnycdn.com/your-zone/charts)
 * - DATABASE_ACCESS_TOKEN - API key for write operations
 * - DATABASE_READ_ONLY_ACCESS_TOKEN - API key for read operations (optional, will use ACCESS_TOKEN if not set)
 */

// CORS headers for your domain
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Change to your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

export default {
  async fetch(request, env) {
    // Access environment variables from secrets
    const DATABASE_URL = env.DATABASE_URL;
    const DATABASE_ACCESS_TOKEN = env.DATABASE_ACCESS_TOKEN;
    const DATABASE_READ_ONLY_ACCESS_TOKEN = env.DATABASE_READ_ONLY_ACCESS_TOKEN || env.DATABASE_ACCESS_TOKEN;
    
    // Validate that required secrets are set
    if (!DATABASE_URL || !DATABASE_ACCESS_TOKEN) {
      return jsonResponse({ 
        error: 'Server configuration error: Missing required secrets' 
      }, 500);
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // Route matching
    const chartIdMatch = path.match(/^\/api\/charts\/([a-zA-Z0-9-_]+)$/);
    
    try {
      // GET /api/charts/{chartId} - Retrieve chart config
      if (request.method === 'GET' && chartIdMatch) {
        const chartId = chartIdMatch[1];
        return await getChart(chartId, DATABASE_URL, DATABASE_READ_ONLY_ACCESS_TOKEN);
      }
      
      // POST /api/charts/{chartId} - Save chart config
      if (request.method === 'POST' && chartIdMatch) {
        const chartId = chartIdMatch[1];
        const apiKey = request.headers.get('X-API-Key');
        
        // Validate API key using the DATABASE_ACCESS_TOKEN
        if (!apiKey || apiKey !== DATABASE_ACCESS_TOKEN) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const data = await request.json();
        return await saveChart(chartId, data, DATABASE_URL, DATABASE_ACCESS_TOKEN);
      }
      
      // GET /api/charts - List all charts
      if (request.method === 'GET' && path === '/api/charts') {
        return await listCharts(DATABASE_URL, DATABASE_READ_ONLY_ACCESS_TOKEN);
      }
      
      return jsonResponse({ error: 'Not found' }, 404);
      
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

/**
 * Retrieve chart configuration from storage
 */
async function getChart(chartId, databaseUrl, accessToken) {
  const response = await fetch(`${databaseUrl}/${chartId}.json`, {
    method: 'GET',
    headers: {
      'AccessKey': accessToken
    }
  });
  
  if (response.status === 404) {
    return jsonResponse({ error: 'Chart not found' }, 404);
  }
  
  if (!response.ok) {
    throw new Error('Failed to retrieve chart');
  }
  
  const chartData = await response.json();
  return jsonResponse(chartData);
}

/**
 * Save chart configuration to storage
 * 
 * Expected data format:
 * {
 *   "chartId": "string",
 *   "type": "line|bar|pie|scatter|...",  // ECharts type
 *   "metadata": {
 *     "title": "Chart Title",
 *     "description": "Chart description",
 *     "created": "timestamp",
 *     "updated": "timestamp"
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
async function saveChart(chartId, data, databaseUrl, accessToken) {
  // Validate data structure
  if (!data.config || typeof data.config !== 'object') {
    return jsonResponse({ error: 'Invalid data: config object required' }, 400);
  }
  
  // Add metadata
  const chartData = {
    chartId,
    type: data.type || 'line',
    metadata: {
      title: data.metadata?.title || chartId,
      description: data.metadata?.description || '',
      created: data.metadata?.created || new Date().toISOString(),
      updated: new Date().toISOString()
    },
    config: data.config
  };
  
  // Save to Bunny Storage
  const response = await fetch(`${databaseUrl}/${chartId}.json`, {
    method: 'PUT',
    headers: {
      'AccessKey': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(chartData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to save chart');
  }
  
  return jsonResponse({ success: true, chartId, updated: chartData.metadata.updated });
}

/**
 * List all available charts
 */
async function listCharts(databaseUrl, accessToken) {
  // Note: Bunny Storage doesn't have a native list API
  // You'll need to maintain an index file or use a different approach
  // For MVP, return a hardcoded list or implement index management
  
  const response = await fetch(`${databaseUrl}/index.json`, {
    method: 'GET',
    headers: {
      'AccessKey': accessToken
    }
  });
  
  if (response.status === 404) {
    return jsonResponse({ charts: [] });
  }
  
  const index = await response.json();
  return jsonResponse(index);
}

/**
 * Helper function to create JSON responses with CORS headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}
