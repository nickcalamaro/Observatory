# Observatory Charts - Quick Start Guide

## 🎯 What You Have Now

A complete, futureproof chart management system using Bunny.net Edge Scripts and ECharts:

### Files Created:
- **`bunny-edge-script.js`** - Bunny.net Edge Script API
- **`BUNNY-API-SETUP.md`** - Detailed setup instructions
- **`static/js/chart-loader.js`** - Reusable chart loading component
- **`layouts/_default/chart-admin.html`** - Admin interface layout
- **`content/admin/charts.html`** - Admin page content
- **Updated `layouts/_default/newsletter.html`** - Now uses API

## 🚀 Quick Start

### 1. Deploy Bunny.net Edge Script (5 mins)
1. Copy contents of `bunny-edge-script.js`
2. Go to Bunny.net → Edge Scripting → Create new script
3. Update these variables:
   ```javascript
   const STORAGE_API_KEY = 'your-bunny-storage-key';
   const STORAGE_ZONE_NAME = 'your-storage-zone';
   ```
4. Set a secret API key (for `X-API-Key` header)
5. Deploy

### 2. Update Frontend Configuration
In `layouts/_default/newsletter.html`, update:
```javascript
const API_URL = 'https://your-bunny-edge-script-url.com/api/charts';
```

### 3. Use the Admin Interface
1. Visit `http://localhost:61792/admin/charts/`
2. Enter your API URL and API Key
3. Load an example or create your own chart
4. Click "Preview" to see it
5. Click "Save to API" to store it
6. Your chart will now load on the newsletter page!

## 📊 Adding Charts to Any Page

### Method 1: Using the Chart Loader (Recommended)
```html
<!-- In your Hugo template -->
<div id="my-chart" 
     data-chart-id="my-chart-id"
     style="width: 100%; height: 500px;">
</div>

{{ define "footer" }}
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
<script src="/js/chart-loader.js"></script>
{{ end }}
```

The chart will auto-load from the API using the `data-chart-id` attribute!

### Method 2: Manual JavaScript
```html
<div id="my-chart" style="width: 100%; height: 500px;"></div>

<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
<script src="/js/chart-loader.js"></script>
<script>
const chart = new ObservatoryChart('my-chart', {
  apiUrl: 'https://api.yourdomain.com/api/charts',
  chartId: 'my-chart-id',
  fallbackConfig: { /* optional fallback */ }
});
</script>
```

## 🎨 Supported Chart Types

Since we store the full ECharts config, **ALL ECharts chart types are supported**:
- Line Charts (regular, stacked, area)
- Bar Charts (vertical, horizontal, stacked)
- Pie Charts & Donut Charts
- Scatter & Bubble Charts
- Radar Charts
- Candlestick Charts
- Heatmaps
- Tree Maps
- Gauge Charts
- And 20+ more!

See: https://echarts.apache.org/examples/en/index.html

## 🔧 How It Works

### Data Flow:
```
Admin Page → Bunny.net API → Bunny.net Storage
                              ↓
Frontend Pages ← chart-loader.js ← API
```

### Architecture Benefits:
✅ **Futureproof**: Any ECharts config works
✅ **Fast**: Bunny.net CDN delivery worldwide
✅ **Cheap**: ~$0.01/GB storage
✅ **Flexible**: Update charts without code changes
✅ **Portable**: Works with any Hugo page

## 💡 Usage Examples

### Create a New Chart:
1. Go to `/admin/charts/`
2. Change Chart ID to something unique (e.g., "homepage-stats")
3. Load an example or paste your ECharts config
4. Preview and save
5. Add to any page:
   ```html
   <div id="stats" data-chart-id="homepage-stats" style="height: 400px;"></div>
   ```

### Update Existing Chart:
1. Go to `/admin/charts/`
2. Enter the Chart ID
3. Click "Load from API"
4. Make changes
5. Preview and save
6. All pages using that chart auto-update!

### Use Same Chart Multiple Times:
```html
<!-- Page 1 -->
<div data-chart-id="sales-2024" style="height: 400px;"></div>

<!-- Page 2 -->
<div data-chart-id="sales-2024" style="height: 300px;"></div>
```
Same data, different sizes! The chart automatically adjusts.

## 🔐 Security Notes

**Before Production:**
1. Change `X-API-Key` in edge script (use environment variables)
2. Update CORS to your domain only:
   ```javascript
   'Access-Control-Allow-Origin': 'https://yourdomain.com'
   ```
3. Add rate limiting in Bunny.net dashboard
4. Don't commit API keys to git!
5. Consider adding authentication to admin page

## 🎯 Next Steps

1. **Deploy the edge script** to Bunny.net
2. **Update API URLs** in newsletter.html and chart-admin.html
3. **Test the admin page** at `/admin/charts/`
4. **Create your first chart** and save it to the API
5. **Add charts to other pages** using the simple data-chart-id attribute

## 📚 Resources

- [ECharts Examples](https://echarts.apache.org/examples/en/index.html)
- [ECharts API Docs](https://echarts.apache.org/en/api.html)
- [ECharts Configuration](https://echarts.apache.org/en/option.html)
- [Bunny.net Edge Scripting](https://docs.bunny.net/docs/stream-edge-scripting)

## 🐛 Troubleshooting

**Chart not loading?**
- Check browser console for errors
- Verify API URL is correct
- Check CORS settings
- Confirm chart ID exists in storage

**Can't save chart?**
- Verify API key is correct
- Check X-API-Key header in request
- Confirm storage zone exists
- Validate JSON before saving

**Chart looks wrong?**
- Preview in admin page first
- Check ECharts console errors
- Validate your config against ECharts docs
- Try a simple example config first

---

Built with ❤️ using Hugo + ECharts + Bunny.net
