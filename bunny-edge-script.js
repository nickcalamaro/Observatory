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
 */

// Your Bunny.net Storage API credentials
const STORAGE_API_KEY = 'YOUR_BUNNY_STORAGE_API_KEY';
const STORAGE_ZONE_NAME = 'YOUR_STORAGE_ZONE';
const STORAGE_BASE_URL = `https://storage.bunnycdn.com/${STORAGE_ZONE_NAME}/charts`;

// CORS headers for your domain
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Change to your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

export default {
  async fetch(request) {
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
        return await getChart(chartId);
      }
      
      // POST /api/charts/{chartId} - Save chart config
      if (request.method === 'POST' && chartIdMatch) {
        const chartId = chartIdMatch[1];
        const apiKey = request.headers.get('X-API-Key');
        
        // Simple API key validation (use environment variables in production)
        if (!apiKey || apiKey !== 'YOUR_SECRET_API_KEY') {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        const data = await request.json();
        return await saveChart(chartId, data);
      }
      
      // GET /api/charts - List all charts
      if (request.method === 'GET' && path === '/api/charts') {
        return await listCharts();
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
async function getChart(chartId) {
  const response = await fetch(`${STORAGE_BASE_URL}/${chartId}.json`, {
    method: 'GET',
    headers: {
      'AccessKey': STORAGE_API_KEY
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
async function saveChart(chartId, data) {
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
  const response = await fetch(`${STORAGE_BASE_URL}/${chartId}.json`, {
    method: 'PUT',
    headers: {
      'AccessKey': STORAGE_API_KEY,
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
async function listCharts() {
  // Note: Bunny Storage doesn't have a native list API
  // You'll need to maintain an index file or use a different approach
  // For MVP, return a hardcoded list or implement index management
  
  const response = await fetch(`${STORAGE_BASE_URL}/index.json`, {
    method: 'GET',
    headers: {
      'AccessKey': STORAGE_API_KEY
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
