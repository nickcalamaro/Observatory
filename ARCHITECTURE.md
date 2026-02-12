# 📊 Observatory Charts - System Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CHART CREATION                          │
└─────────────────────────────────────────────────────────────┘

User visits /admin/charts/
         │
         ├─→ Loads example OR creates custom config
         ├─→ Previews in browser (ECharts renders)
         ├─→ Validates JSON
         └─→ Saves via API
                │
                ▼
         POST /api/charts/{chartId}
         Headers: X-API-Key, Content-Type
         Body: { type, metadata, config }
                │
                ▼
         Bunny.net Edge Script
                │
                ├─→ Validates API key
                ├─→ Validates data structure
                └─→ Saves to Bunny.net Storage
                         │
                         ▼
                  {chartId}.json stored


┌─────────────────────────────────────────────────────────────┐
│                     CHART DISPLAY                           │
└─────────────────────────────────────────────────────────────┘

User visits /newsletter/ (or any page)
         │
         ▼
    Hugo renders page
    <div id="main" data-chart-id="newsletter-gradient-area">
         │
         ▼
    chart-loader.js initializes
         │
         ├─→ Reads data-chart-id attribute
         ├─→ Fetches from API
         │        │
         │        ▼
         │   GET /api/charts/{chartId}
         │        │
         │        ▼
         │   Bunny.net Edge Script
         │        │
         │        └─→ Retrieves from storage
         │                 │
         │                 ▼
         │            Returns JSON
         │                 │
         ├────────────────┘
         │
         ├─→ If API fails → use fallbackConfig
         │
         └─→ Pass config to ECharts
                  │
                  ▼
             Chart renders!


┌─────────────────────────────────────────────────────────────┐
│                   FUTURE: AUTOMATED UPDATES                 │
└─────────────────────────────────────────────────────────────┘

Scheduled Task / Webhook / CI/CD
         │
         ├─→ Fetch data from source (database, API, CSV, etc.)
         ├─→ Transform to ECharts format
         └─→ POST to Observatory API
                │
                ▼
         Chart auto-updates on all pages!
         (No redeployment needed)
```

## Component Responsibilities

### 1. **Bunny.net Edge Script** (`bunny-edge-script.js`)
**What:** Serverless API running at the edge  
**Does:**
- Validates incoming requests
- Manages authentication (X-API-Key)
- Stores/retrieves chart configs from Bunny Storage
- Handles CORS

**Why Bunny.net?**
- ⚡ Fast (global edge network)
- 💰 Cheap (~$0.01/GB)
- 🔧 Simple (no server management)
- 🚀 Scalable (auto-scales)

### 2. **Chart Loader** (`chart-loader.js`)
**What:** Reusable JavaScript component  
**Does:**
- Auto-detects charts via `data-chart-id`
- Fetches configs from API
- Falls back to embedded config
- Initializes ECharts instances
- Handles errors gracefully
- Makes charts responsive

**Why Reusable?**
- Write once, use everywhere
- Consistent behavior
- Easy to maintain
- Automatic initialization

### 3. **Admin Interface** (`/admin/charts/`)
**What:** Visual chart editor  
**Does:**
- WYSIWYG chart creation
- Live preview
- JSON validation
- Example templates
- Save/Load from API

**Why Visual?**
- No code editing required
- Immediate feedback
- Lower barrier to entry
- Faster iterations

### 4. **Hugo Integration**
**What:** Static site generator  
**Does:**
- Renders pages with chart placeholders
- Serves chart-loader.js
- Builds site structure

**Why Hugo + Dynamic Charts?**
- Static site = fast & cheap hosting
- Dynamic charts = flexible content
- Best of both worlds!

## Configuration Format

Every chart is stored as a JSON object:

```json
{
  "chartId": "unique-identifier",
  "type": "line|bar|pie|...",
  "metadata": {
    "title": "Human-readable title",
    "description": "What this chart shows",
    "created": "2026-02-12T00:00:00Z",
    "updated": "2026-02-12T10:30:00Z"
  },
  "config": {
    // Raw ECharts option object
    "title": { "text": "Chart Title" },
    "xAxis": { ... },
    "yAxis": { ... },
    "series": [ ... ],
    // ANY valid ECharts configuration
  }
}
```

**Key Insight:** The `config` field is a **complete ECharts option object**.  
No transformation needed! Just pass it directly to `myChart.setOption(config)`.

## Why This Architecture Is Futureproof

### 1. **No Custom Data Model**
```javascript
// ❌ Bad: Custom transformation
const customData = { labels: [...], values: [...] };
const echartsConfig = transformToECharts(customData); // Breaks on updates

// ✅ Good: Store what you use
const echartsConfig = { series: [...], xAxis: [...] };
myChart.setOption(echartsConfig); // Always works
```

### 2. **ECharts Handles Complexity**
- Want animations? ECharts has it
- Want interactions? ECharts has it
- Want 3D? ECharts has it
- New feature? ECharts adds it → you automatically get it

### 3. **Single Source of Truth**
```
Chart Config (JSON) → ECharts → Rendered Chart
        ↑
   Single source!
```

No intermediate formats, no transformations, no sync issues.

### 4. **Composable & Extensible**
```html
<!-- Basic usage -->
<div data-chart-id="my-chart"></div>

<!-- With custom API -->
<div data-chart-id="my-chart" data-api-url="https://custom.api"></div>

<!-- Programmatic -->
<script>
new ObservatoryChart('container', {
  chartId: 'my-chart',
  onLoad: (chart) => {
    // Custom logic here
  }
});
</script>
```

## Performance Characteristics

### Initial Load
1. Hugo renders HTML: ~10ms
2. Browser fetches page: ~50-200ms (depending on distance)
3. chart-loader.js loads: ~20ms
4. API request: ~50-100ms (Bunny.net edge)
5. ECharts renders: ~10-50ms (depending on complexity)

**Total: ~140-380ms** ⚡

### Subsequent Loads
- Browser cache: chart-loader.js, ECharts library
- CDN cache: Chart configs (if configured)
- **Even faster!**

### Updates
- Change chart config via API: ~100ms
- All pages get update: **Instant** (next page load)
- No redeployment needed: **Ever**

## Scaling Considerations

### How many charts can you have?

**Storage:**
- Average chart: ~5KB
- 1GB = 200,000 charts
- Cost: $0.01/GB = **$0.01 for 200,000 charts!**

**Bandwidth:**
- 1 chart load: ~5KB
- 1 million loads: ~5GB
- Cost: ~$0.05

**Realistically:** You'll never worry about cost.

### How many requests?

Bunny.net handles millions of requests. Your bottleneck will be Hugo build time or browser rendering, not the chart system.

## Future Enhancements (Optional)

### 1. Chart Versioning
```json
{
  "chartId": "sales-2024",
  "version": 2,
  "history": [...]
}
```

### 2. Chart Templates
```json
{
  "template": "line-chart-template",
  "overrides": { "series": [...] }
}
```

### 3. Real-time Updates
```javascript
const ws = new WebSocket('wss://api.yourdomain.com/charts/live');
ws.on('update', (chartId) => {
  chart.refresh(chartId);
});
```

### 4. A/B Testing
```javascript
const variant = Math.random() < 0.5 ? 'chart-a' : 'chart-b';
loadChart(variant);
```

### 5. Analytics
```javascript
onLoad: (chart) => {
  trackEvent('chart_view', { chartId });
}
```

## Summary

This architecture works because it **embraces simplicity**:

1. Store the format you need (ECharts config)
2. Use tools that understand that format (ECharts)
3. Don't transform unless necessary (we never do)
4. Let specialists do specialist work (ECharts renders, Bunny.net delivers)

**Result:** A system that's fast, cheap, maintainable, and futureproof.

---

Questions? Check the docs or dive into the code—it's simple by design! 🚀
