# Local Development Without Bunny.net API

If you want to test the charts before deploying to Bunny.net, you can run a simple local API server.

## Option 1: Use a Simple JSON Server

Install json-server:
```powershell
npm install -g json-server
```

Create `db.json` in your project root:
```json
{
  "charts": {
    "newsletter-gradient-area": {
      "chartId": "newsletter-gradient-area",
      "type": "line",
      "config": { /* your chart config */ }
    }
  }
}
```

Run the server:
```powershell
json-server --watch db.json --port 3000
```

Update newsletter.html temporarily:
```javascript
const API_URL = 'http://localhost:3000/charts';
```

## Option 2: Just Use Fallback

The current setup already has a fallback configuration! If the API isn't available, the chart will automatically use the `fallbackConfig` embedded in the page.

**This means your charts work right now, even without deploying anything!**

The API becomes useful when you want to:
- Update charts without redeploying the site
- Share chart configs across multiple pages
- Manage charts from the admin interface

## Option 3: Mock API with Service Worker

For a more realistic test, you can use a service worker to mock API responses. But honestly, the fallback config is simpler for development.

## Current State

✅ **Charts work now** with the fallback configuration  
✅ **No deployment needed** for basic functionality  
✅ **Deploy API later** when you want centralized management

The architecture gracefully degrades, so you can develop and see results immediately!
