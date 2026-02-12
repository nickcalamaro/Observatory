# Bunny.net Edge Script API Setup Guide

## Overview
This API allows you to store and retrieve ECharts configurations from Bunny.net Edge Storage, making your charts data-driven and manageable from a frontend interface.

## Setup Instructions

### 1. Create Bunny.net Storage Zone
1. Log into your Bunny.net dashboard
2. Navigate to **Storage** → **Add Storage Zone**
3. Name it (e.g., "observatory-charts")
4. Note the API Key and Zone Name

### 2. Deploy Edge Script
1. Go to **Edge Scripting** in Bunny.net
2. Create a new script
3. Copy the contents of `bunny-edge-script.js`
4. Update these variables:
   ```javascript
   const STORAGE_API_KEY = 'your-storage-api-key';
   const STORAGE_ZONE_NAME = 'your-storage-zone-name';
   const CORS_HEADERS = {
     'Access-Control-Allow-Origin': 'https://yourdomain.com',
     // ...
   };
   ```
5. Set your secret API key for POST requests (used in `X-API-Key` header)
6. Deploy the script

### 3. Configure Pull Zone (Optional)
If you want a custom domain for your API:
1. Create a Pull Zone linked to your Edge Script
2. Configure DNS to point to the Pull Zone
3. Your API will be available at `https://api.yourdomain.com/api/charts/`

## API Endpoints

### GET /api/charts/{chartId}
Retrieve a chart configuration

**Response:**
```json
{
  "chartId": "newsletter-gradient-area",
  "type": "line",
  "metadata": {
    "title": "Newsletter Chart",
    "description": "Gradient stacked area chart",
    "created": "2026-02-12T10:00:00Z",
    "updated": "2026-02-12T10:00:00Z"
  },
  "config": {
    "title": { "text": "Gradient Stacked Area Chart" },
    "series": [...],
    // Full ECharts option object
  }
}
```

### POST /api/charts/{chartId}
Save or update a chart configuration

**Headers:**
```
Content-Type: application/json
X-API-Key: your-secret-api-key
```

**Request Body:**
```json
{
  "type": "line",
  "metadata": {
    "title": "My Chart",
    "description": "Chart description"
  },
  "config": {
    // Full ECharts option object
    "title": { "text": "Chart Title" },
    "xAxis": { "type": "category", "data": [...] },
    "yAxis": { "type": "value" },
    "series": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "chartId": "newsletter-gradient-area",
  "updated": "2026-02-12T10:00:00Z"
}
```

### GET /api/charts
List all available charts

**Response:**
```json
{
  "charts": [
    {
      "chartId": "newsletter-gradient-area",
      "title": "Newsletter Chart",
      "type": "line"
    }
  ]
}
```

## Data Structure Philosophy

The API stores the **entire ECharts configuration object**, making it:
- **Futureproof**: Any ECharts chart type is supported
- **Flexible**: All ECharts features available (animations, interactions, themes)
- **Simple**: No transformation needed between storage and rendering
- **Maintainable**: Chart configs can be updated without code changes

## Security Considerations

1. **API Key Protection**: Store `X-API-Key` in environment variables, never commit to git
2. **CORS**: Restrict to your domain in production
3. **Validation**: Add schema validation for chart configs
4. **Rate Limiting**: Implement rate limiting in Bunny.net settings
5. **Input Sanitization**: Validate all user inputs before saving

## Cost Optimization

- Bunny.net Storage is very affordable ($0.01/GB)
- Edge Script execution is included in most plans
- CDN delivery is fast and cheap
- Consider caching GET requests with appropriate headers

## Next Steps

1. Deploy the edge script to Bunny.net
2. Update frontend to use the API (see updated newsletter.html)
3. Create admin interface for managing charts
4. Add authentication for production use
