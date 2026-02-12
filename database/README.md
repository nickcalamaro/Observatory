# Chart Templates Setup

## Database Setup

Run the SQL commands in `chart_templates.sql` in your BunnyDB console to:
1. Create the `chart_templates` table
2. Insert starter templates for all chart types (line, bar, pie, scatter, radar, candlestick)

## How It Works

When you change the chart type dropdown in the admin interface, it automatically:
1. Fetches the template for that chart type from `GET /api/charts/templates/{type}`
2. Loads the template configuration into the editor
3. Updates the preview

## Adding/Updating Templates

You can customize templates directly in BunnyDB:

```sql
-- Update existing template
UPDATE chart_templates 
SET template_config = '{ ... your config ... }',
    updated_at = datetime('now')
WHERE chart_type = 'line';

-- Add new template
INSERT INTO chart_templates (chart_type, template_config, description, created_at, updated_at)
VALUES ('funnel', '{ ... }', 'Funnel chart template', datetime('now'), datetime('now'));
```

## ECharts Documentation

Full configuration options for each chart type:
- https://echarts.apache.org/en/option.html

Chart type examples:
- Line: https://echarts.apache.org/examples/en/editor.html?c=line-simple
- Bar: https://echarts.apache.org/examples/en/editor.html?c=bar-simple
- Pie: https://echarts.apache.org/examples/en/editor.html?c=pie-simple
- Scatter: https://echarts.apache.org/examples/en/editor.html?c=scatter-simple
- Radar: https://echarts.apache.org/examples/en/editor.html?c=radar
- Candlestick: https://echarts.apache.org/examples/en/editor.html?c=candlestick-simple
