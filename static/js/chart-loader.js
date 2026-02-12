/**
 * Observatory Chart Loader
 * Reusable ECharts component that loads chart configurations from API
 * 
 * Usage:
 * <div id="chart-container" data-chart-id="newsletter-gradient-area"></div>
 * <script src="/js/chart-loader.js"></script>
 */

class ObservatoryChart {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.chart = null;
    this.options = {
      apiUrl: options.apiUrl || 'https://api.yourdomain.com/api/charts',
      chartId: options.chartId || this.container?.dataset?.chartId,
      fallbackConfig: options.fallbackConfig || null,
      onLoad: options.onLoad || null,
      onError: options.onError || null,
      showLoading: options.showLoading !== false,
      responsive: options.responsive !== false
    };
    
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }
    
    this.init();
  }
  
  async init() {
    if (this.options.showLoading) {
      this.showLoading();
    }
    
    try {
      // Initialize ECharts instance
      this.chart = echarts.init(this.container);
      
      // Load configuration from API or use fallback
      const config = await this.loadConfig();
      
      // Apply configuration to chart
      this.chart.setOption(config);
      
      // Setup responsive behavior
      if (this.options.responsive) {
        this.setupResponsive();
      }
      
      // Call success callback
      if (this.options.onLoad) {
        this.options.onLoad(this.chart, config);
      }
      
    } catch (error) {
      console.error('Failed to initialize chart:', error);
      this.showError(error.message);
      
      if (this.options.onError) {
        this.options.onError(error);
      }
    }
  }
  
  async loadConfig() {
    if (!this.options.chartId) {
      if (this.options.fallbackConfig) {
        return this.options.fallbackConfig;
      }
      throw new Error('No chartId provided and no fallback config available');
    }
    
    try {
      const response = await fetch(`${this.options.apiUrl}/${this.options.chartId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the ECharts config from the API response
      return data.config || data;
      
    } catch (error) {
      console.warn(`Failed to load chart from API, using fallback:`, error);
      
      if (this.options.fallbackConfig) {
        return this.options.fallbackConfig;
      }
      
      throw error;
    }
  }
  
  setupResponsive() {
    const resizeHandler = () => {
      if (this.chart) {
        this.chart.resize();
      }
    };
    
    window.addEventListener('resize', resizeHandler);
    
    // Store handler for cleanup
    this._resizeHandler = resizeHandler;
  }
  
  showLoading() {
    if (this.chart) {
      this.chart.showLoading();
    } else {
      this.container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Loading chart...</div>';
    }
  }
  
  hideLoading() {
    if (this.chart) {
      this.chart.hideLoading();
    }
  }
  
  showError(message) {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #e74c3c;">
        <strong>Error loading chart</strong><br>
        <small>${message}</small>
      </div>
    `;
  }
  
  updateData(newConfig) {
    if (this.chart) {
      this.chart.setOption(newConfig, true);
    }
  }
  
  destroy() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }
}

// Auto-initialize charts with data-chart-id attribute
document.addEventListener('DOMContentLoaded', () => {
  const chartElements = document.querySelectorAll('[data-chart-id]');
  
  chartElements.forEach(element => {
    const chartId = element.dataset.chartId;
    const apiUrl = element.dataset.apiUrl;
    
    new ObservatoryChart(element.id, {
      chartId,
      apiUrl: apiUrl || undefined
    });
  });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ObservatoryChart;
}
