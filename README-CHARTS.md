# 📊 Observatory Charts System

A complete, futureproof chart management system for Hugo using **ECharts** + **Bunny.net Edge Scripts**.

## 🎯 Features

- ✅ **Any Chart Type** - Line, bar, pie, scatter, radar, heatmaps, and 20+ more
- ✅ **API-Driven** - Update charts without code deployments
- ✅ **Reusable** - One component works everywhere
- ✅ **Admin Interface** - Visual editor with live preview
- ✅ **Fast & Cheap** - Bunny.net CDN delivery
- ✅ **Graceful Fallback** - Works offline with embedded configs
- ✅ **Responsive** - Auto-resizes with window

## 🚀 Quick Start

### Current State (Works Now!)
Your newsletter chart is already working at: **http://localhost:61792/newsletter/**

It uses a fallback configuration, so no API deployment needed yet.

### View Admin Interface
Visit: **http://localhost:61792/admin/charts/**

Try loading examples and previewing charts!

### Deploy to Production (When Ready)

1. **Deploy Bunny.net API** (5 mins)
   - See `BUNNY-API-SETUP.md`
   
2. **Update API URLs** (2 mins)
   - In `layouts/_default/newsletter.html` line 23
   - In `layouts/_default/chart-admin.html` default input
   
3. **Test End-to-End**
   - Save a chart via admin
   - Verify it loads on a page

## 📁 Project Structure

```
Observatory/
├── bunny-edge-script.js          # Deploy this to Bunny.net
├── static/js/chart-loader.js     # Reusable chart component
├── layouts/_default/
│   ├── newsletter.html           # Example: Newsletter page with chart
│   └── chart-admin.html          # Admin interface layout
├── content/
│   ├── Newsletter.html           # Newsletter page content
│   └── admin/charts.html         # Admin page content
├── sample-chart-data/            # Example chart configs
│   └── newsletter-gradient-area.json
└── Documentation:
    ├── MVP-COMPLETE.md           # 👈 START HERE - Overview
    ├── CHARTS-QUICKSTART.md      # Daily usage guide
    ├── BUNNY-API-SETUP.md        # API deployment guide
    └── LOCAL-DEV.md              # Local development tips
```

## 📊 Adding Charts to Pages

### Method 1: Auto-Initialize (Easiest)
```html
<div id="my-chart" 
     data-chart-id="my-chart-id"
     style="height: 500px;">
</div>

<!-- In footer -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
<script src="/js/chart-loader.js"></script>
```

### Method 2: Manual Control
```javascript
const chart = new ObservatoryChart('chart-container', {
  apiUrl: 'https://api.yourdomain.com/api/charts',
  chartId: 'my-chart',
  fallbackConfig: { /* optional */ },
  onLoad: (instance, config) => {
    console.log('Loaded!', config);
  }
});
```

## 🎨 Chart Type Support

**ALL ECharts charts are supported!** Including:

- 📈 Line Charts (area, stacked, smooth)
- 📊 Bar Charts (vertical, horizontal, stacked)
- 🥧 Pie & Donut Charts
- 🎯 Scatter & Bubble Charts
- 🕸️ Radar Charts
- 📉 Candlestick (financial)
- 🗺️ Heatmaps & Tree Maps
- ⏱️ Gauge Charts
- 📐 Funnel Charts
- And many more...

See all examples: https://echarts.apache.org/examples/en/index.html

## 🔄 Workflow

### Create Chart:
1. Visit `/admin/charts/`
2. Design chart (or load example)
3. Preview
4. Save to API

### Use Chart:
1. Add `<div data-chart-id="your-id"></div>` to any page
2. Done! Chart auto-loads

### Update Chart:
1. Edit in admin interface
2. Save
3. All pages using that chart auto-update!

## 🏗️ Architecture

```
┌─────────────┐
│  Admin UI   │ ─── POST ──→ ┌──────────────┐
└─────────────┘               │  Bunny.net   │
                              │  Edge Script │
┌─────────────┐               │     API      │
│   Pages     │ ←── GET ───── └──────────────┘
└─────────────┘                      ↓
      ↓                               ↓
  ECharts                      ┌──────────────┐
  Renders                      │ Bunny Storage│
                               │ (JSON files) │
                               └──────────────┘
```

**Why This Works:**
- Stores **complete ECharts configs** (no transformation)
- Leverages **ECharts' own API** (no custom code)
- Future ECharts features **automatically supported**
- Charts are **just configuration data**

## 🔐 Security

Before going live:

- [ ] Change `X-API-Key` in edge script
- [ ] Restrict CORS to your domain
- [ ] Add authentication to admin page
- [ ] Enable rate limiting
- [ ] Don't commit secrets to git

## 💰 Cost

- Bunny.net Storage: **~$0.01/GB** ($0.10 for 10,000 charts!)
- Bunny.net Bandwidth: **~$0.01/GB**
- Edge Script: **Included** in most plans

**Total monthly cost:** Probably under $1 for typical usage.

## 📚 Documentation

- **[MVP-COMPLETE.md](MVP-COMPLETE.md)** - Project overview & status
- **[CHARTS-QUICKSTART.md](CHARTS-QUICKSTART.md)** - Quick reference guide
- **[BUNNY-API-SETUP.md](BUNNY-API-SETUP.md)** - Deployment instructions
- **[LOCAL-DEV.md](LOCAL-DEV.md)** - Local development tips

## 🎯 Next Steps

1. **Explore** - Check out `/admin/charts/` and `/newsletter/`
2. **Read** - Start with `MVP-COMPLETE.md`
3. **Deploy** - Follow `BUNNY-API-SETUP.md` when ready
4. **Create** - Build your first chart!

## 🐛 Troubleshooting

**Chart not loading?**
- Check browser console
- Verify API URL is correct
- Confirm chart ID exists
- Check CORS settings

**Admin won't save?**
- Verify API key is correct
- Check network tab for errors
- Validate JSON syntax

**Chart looks wrong?**
- Preview in admin first
- Check ECharts console errors
- Try a simple example config
- Reference ECharts docs

## 🎉 What Makes This Special

1. **Zero Transformation** - Store raw ECharts config = zero bugs
2. **Infinite Flexibility** - Any ECharts feature works immediately
3. **No Maintenance** - ECharts updates → automatic support
4. **Simple Mental Model** - Charts are just JSON files
5. **Graceful Degradation** - Works with or without API

This isn't just a chart system—it's a **philosophy**: 
> Store the thing you need in the format you need it.

No custom data models, no transformation layers, no abstractions. Just pure ECharts configs.

---

**Built with:** Hugo + ECharts + Bunny.net  
**License:** MIT (or your choice)  
**Maintained by:** You!

Ready to create amazing data visualizations? Start with `/admin/charts/` 🚀
