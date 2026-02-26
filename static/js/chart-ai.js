/**
 * Chart AI Builder — Agentic Mistral AI chat for generating ECharts JSON.
 *
 * Features:
 *  - Multi-turn conversation with Mistral API (streaming)
 *  - CSV / TSV file upload with auto-analysis
 *  - Extracts JSON from assistant replies and renders a live preview
 *  - "Use in Editor" sends generated config to the main chart-admin editor
 */

// ============================================================
// State
// ============================================================
let aiMessages = [];          // {role, content} history sent to API
let aiCsvPayload = null;      // parsed CSV string to inject into context
let aiChartInstance = null;   // ECharts instance for the AI preview
let latestAiJson = null;      // last extracted JSON string

// Proxy endpoint — the Mistral API key lives server-side in this Edge Script.
const PROXY_URL = 'https://mistralchartmaker-8xc8i.bunny.run/v1/chat/completions';

// ============================================================
// System prompt — teaches the model ECharts best practices
// ============================================================
const SYSTEM_PROMPT = `You are an expert data visualisation assistant. Your ONLY job is to output valid **pure JSON** Apache ECharts option objects.

═══ CRITICAL — PURE JSON ONLY ═══
Your output MUST pass JSON.parse(). This means:
• NO JavaScript functions — never write function(...){...} or arrow functions (() => ...)
• NO comments (// or /* */)
• NO trailing commas
• NO unquoted keys
• ALL strings must use double quotes
• NO undefined, NaN, or Infinity values

═══ COMMON TRAPS TO AVOID ═══
❌ "formatter": function(params){ return params.name + ': ' + params.value; }
✅ "formatter": "{b}: {c}"     (use ECharts template strings instead)

❌ "color": function(params){ ... }
✅ "color": ["#5470c6", "#91cc75", "#fac858"]   (use an array of colours)

❌ "formatter": (value) => value + '%'
✅ "formatter": "{value}%"   or   "axisLabel": { "formatter": "{value}%" }

ECharts template variables: {a}=series name, {b}=category/name, {c}=value, {d}=percentage
For tooltip: use "formatter": "{b}: {c}" or just rely on default tooltip.
For axisLabel: use "formatter": "{value}%" or "formatter": "{value} units"
For rich labels: use the "rich" text style system with plain string templates.

═══ OUTPUT FORMAT ═══
1. Wrap the JSON in a \`\`\`json ... \`\`\` code fence.
2. Output ONLY ONE code block per response.
3. Keep explanatory text VERY short — the user wants the JSON.

═══ CHART GUIDELINES ═══
• Include sensible defaults: title, tooltip, legend, responsive grid, and at least one series.
• When the user provides CSV data, incorporate ALL of it. Summarise if > 200 rows (group by category or top-N with "Other").
• Choose the best chart type unless the user specifies one.
• Use attractive colour palettes — hex arrays like ["#5470c6","#91cc75","#fac858","#ee6666","#73c0de","#3ba272","#fc8452","#9a60b4","#ea7ccc"].
• If asked to refine a previous chart, output the FULL updated JSON — never a diff.
• For time axes, use xAxis type "category" with formatted date strings.
• For gradient fills: { "type": "linear", "x": 0, "y": 0, "x2": 0, "y2": 1, "colorStops": [{"offset": 0, "color": "rgba(…)"}, {"offset": 1, "color": "rgba(…)"}] }

CHART TYPE EXAMPLES:
- Line: { "xAxis": {"type":"category", "data":[...]}, "yAxis": {"type":"value"}, "series": [{"type":"line", "data":[...]}] }
- Bar: { "xAxis": {"type":"category", "data":[...]}, "yAxis": {"type":"value"}, "series": [{"type":"bar", "data":[...]}] }
- Pie: { "series": [{"type":"pie", "radius":"50%", "data":[{"value":335,"name":"A"}, ...]}] }
- Stacked Area: multiple series with "stack":"total" and "areaStyle":{}
- Radar: { "radar": {"indicator":[{"name":"A","max":100}]}, "series":[{"type":"radar","data":[{"value":[...],"name":"X"}]}] }

Remember: the JSON must be parseable by JSON.parse(). No exceptions.`;

// ============================================================
// Initialisation
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Restore model preference
  const savedModel = localStorage.getItem('mistral_model');
  if (savedModel) {
    const sel = document.getElementById('mistral-model');
    if ([...sel.options].some(o => o.value === savedModel)) sel.value = savedModel;
  }

  document.getElementById('mistral-model').addEventListener('change', function () {
    localStorage.setItem('mistral_model', this.value);
  });

  // CSV drag-and-drop
  setupCSVDrop();
});

// ============================================================
// CSV handling
// ============================================================
function setupCSVDrop() {
  const zone = document.getElementById('csv-dropzone');
  const fileInput = document.getElementById('csv-file-input');

  ['dragenter', 'dragover'].forEach(evt => {
    zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.remove('drag-over'); });
  });

  zone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleCSVFile(fileInput.files[0]);
    fileInput.value = '';
  });
}

function handleCSVFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const raw = e.target.result;
    aiCsvPayload = raw;

    // Count rows
    const lines = raw.split('\n').filter(l => l.trim());
    const rowCount = Math.max(0, lines.length - 1); // minus header

    document.getElementById('csv-file-name').textContent = file.name;
    document.getElementById('csv-row-count').textContent = `${rowCount} rows`;
    document.getElementById('csv-preview-bar').classList.remove('hidden');
    document.getElementById('csv-dropzone').style.display = 'none';

    // Auto-send an analysis prompt
    const promptEl = document.getElementById('ai-prompt');
    if (!promptEl.value.trim()) {
      promptEl.value = `I've uploaded a CSV file (${file.name}, ${rowCount} rows). Please analyse the data and suggest the best chart type, then generate the ECharts JSON.`;
    }
  };
  reader.readAsText(file);
}

function removeCSV() {
  aiCsvPayload = null;
  document.getElementById('csv-preview-bar').classList.add('hidden');
  document.getElementById('csv-dropzone').style.display = '';
}

// ============================================================
// Chat UI helpers
// ============================================================
function appendMessage(role, html) {
  const container = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-message ai-message-${role}`;
  div.innerHTML = `<div class="ai-bubble">${html}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function showTyping() {
  const container = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = 'ai-message ai-message-assistant';
  div.id = 'ai-typing-indicator';
  div.innerHTML = `<div class="ai-bubble ai-typing">
    <div class="ai-typing-dot"></div>
    <div class="ai-typing-dot"></div>
    <div class="ai-typing-dot"></div>
  </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('ai-typing-indicator');
  if (el) el.remove();
}

function clearAIChat() {
  aiMessages = [];
  latestAiJson = null;
  const container = document.getElementById('ai-messages');
  container.innerHTML = '';
  // Re-add welcome message
  appendMessage('assistant',
    `<p>👋 I can help you build ECharts configurations! Try:</p>
     <ul>
       <li><strong>Describe</strong> a chart — <em>"Create a bar chart showing monthly sales from Jan–Jun"</em></li>
       <li><strong>Upload a CSV</strong> — I'll analyse it and suggest a chart</li>
       <li><strong>Refine</strong> — <em>"Make the colours blue-to-purple gradient"</em></li>
     </ul>`
  );
  document.getElementById('ai-json-output').innerHTML = '<code>// JSON will appear here…</code>';
  if (aiChartInstance) aiChartInstance.clear();
}

function useHint(btn) {
  document.getElementById('ai-prompt').value = btn.textContent;
  document.getElementById('ai-prompt').focus();
}

// ============================================================
// Mistral API call
// ============================================================
async function sendAIPrompt() {
  const model = document.getElementById('mistral-model').value;
  const promptEl = document.getElementById('ai-prompt');
  let userText = promptEl.value.trim();
  if (!userText) return;

  // If CSV is attached, prepend its content (truncated if very large)
  if (aiCsvPayload) {
    let csvSnippet = aiCsvPayload;
    if (csvSnippet.length > 12000) {
      csvSnippet = csvSnippet.substring(0, 12000) + '\n\n… (truncated — ' + aiCsvPayload.split('\n').length + ' total rows)';
    }
    userText += '\n\nHere is the CSV data:\n```csv\n' + csvSnippet + '\n```';
    // Only attach CSV once per message
    removeCSV();
  }

  // Show user message in chat
  appendMessage('user', escapeHtml(promptEl.value.trim()));
  promptEl.value = '';
  promptEl.focus();

  // Build messages payload
  if (aiMessages.length === 0) {
    aiMessages.push({ role: 'system', content: SYSTEM_PROMPT });
  }
  aiMessages.push({ role: 'user', content: userText });

  // Disable send button
  const sendBtn = document.getElementById('ai-send-btn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Thinking…';
  showTyping();

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: aiMessages,
        temperature: 0.4,
        max_tokens: 8192,
        stream: true
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errBody.substring(0, 300)}`);
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let streamDiv = null;

    hideTyping();
    streamDiv = appendMessage('assistant', '');
    const bubble = streamDiv.querySelector('.ai-bubble');

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            bubble.innerHTML = renderMarkdown(fullContent);
          }
        } catch (_) { /* skip malformed chunks */ }
      }

      // Auto-scroll
      const container = document.getElementById('ai-messages');
      container.scrollTop = container.scrollHeight;
    }

    // Save assistant reply to conversation history
    aiMessages.push({ role: 'assistant', content: fullContent });

    // Extract and display JSON
    const json = extractJson(fullContent);
    if (json) {
      latestAiJson = json;
      document.getElementById('ai-json-output').innerHTML = '<code>' + syntaxHighlight(json) + '</code>';
      renderAIPreview(json);
    } else {
      // Show a helpful message in the JSON panel
      const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)```/;
      const raw = fenceRegex.exec(fullContent);
      if (raw) {
        let errMsg;
        try { JSON.parse(raw[1].trim()); } catch (e) { errMsg = e.message; }
        document.getElementById('ai-json-output').innerHTML =
          '<code style="color:#c53030">⚠️ Invalid JSON: ' + escapeHtml(errMsg || 'Unknown parse error') +
          '</code><br><code style="opacity:0.6;font-size:0.82em;white-space:pre-wrap">' +
          escapeHtml(raw[1].trim().substring(0, 500)) + '</code>';
      }
    }

  } catch (err) {
    hideTyping();
    appendMessage('assistant', `<p class="ai-error" style="color:#c53030">❌ ${escapeHtml(err.message)}</p>`);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send ➤';
  }
}

// ============================================================
// JSON extraction from markdown response
// ============================================================
/**
 * Sanitise a JSON-ish string that may contain JS functions.
 * Replaces function expressions / arrow functions with a placeholder string
 * so JSON.parse() can succeed.
 */
function sanitiseJsonString(str) {
  // Replace: function(anything){ ... }  (handles nested braces)
  // Strategy: match "function" then balanced braces
  let result = str;

  // 1. Arrow functions:  (params) => { ... }  or  (params) => expr
  //    and:  param => { ... }  or  param => expr
  result = result.replace(/(?:[a-zA-Z_$][\w$]*|\([^)]*\))\s*=>\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '"[dynamic]"');
  result = result.replace(/(?:[a-zA-Z_$][\w$]*|\([^)]*\))\s*=>\s*[^,}\]]+/g, '"[dynamic]"');

  // 2. function keyword:  function(params){ ... }
  result = result.replace(/function\s*\([^)]*\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '"[dynamic]"');

  // 3. Clean up any resulting double-quoted keys pointing to unquoted [dynamic]
  //    e.g. "formatter": "[dynamic]" is fine, but catch edge cases

  // 4. Remove trailing commas before } or ] (common LLM mistake)
  result = result.replace(/,\s*([}\]])/g, '$1');

  return result;
}

function extractJson(text) {
  // Look for ```json ... ``` blocks
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let best = null;
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    let candidate = match[1].trim();
    // Try raw first, then sanitised
    try {
      JSON.parse(candidate);
      best = candidate;
      continue;
    } catch (_) {}
    try {
      const cleaned = sanitiseJsonString(candidate);
      JSON.parse(cleaned);
      best = cleaned;
    } catch (_) {}
  }
  if (best) return best;

  // Fallback: try to find a top-level { ... } object
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      JSON.parse(braceMatch[0]);
      return braceMatch[0];
    } catch (_) {}
    try {
      const cleaned = sanitiseJsonString(braceMatch[0]);
      JSON.parse(cleaned);
      return cleaned;
    } catch (_) {}
  }

  return null;
}

// ============================================================
// AI preview (ECharts)
// ============================================================
function renderAIPreview(jsonStr) {
  try {
    const config = JSON.parse(jsonStr);
    const container = document.getElementById('ai-chart-preview');
    if (!aiChartInstance) {
      aiChartInstance = echarts.init(container);
      window.addEventListener('resize', () => { if (aiChartInstance) aiChartInstance.resize(); });
    }
    aiChartInstance.setOption(config, true);
  } catch (e) {
    console.error('AI preview render error:', e);
  }
}

// ============================================================
// Copy / Send to editor
// ============================================================
function copyAIJson() {
  if (!latestAiJson) return;
  navigator.clipboard.writeText(latestAiJson).then(() => {
    showAlert('Copied to clipboard!', 'success');
  });
}

function sendAIJsonToEditor() {
  if (!latestAiJson) {
    showAlert('No JSON generated yet — send a prompt first.', 'error');
    return;
  }
  // Put the JSON into the main chart-config textarea
  document.getElementById('chart-config').value = latestAiJson;

  // Try to parse and push to the main form + preview
  try {
    const config = JSON.parse(latestAiJson);
    if (typeof generateFormFields === 'function') generateFormFields(config);
    if (typeof chartInstance !== 'undefined' && chartInstance) chartInstance.setOption(config, true);
  } catch (_) {}

  // Switch to the Advanced tab to show the result
  switchTab('advanced');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab')[1].classList.add('active');

  showAlert('JSON loaded into the editor! Switch to "Preview" to see it.', 'success');
}

// ============================================================
// Rendering helpers
// ============================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Very lightweight markdown → HTML (handles bold, italic, code, code blocks, lists, paragraphs) */
function renderMarkdown(md) {
  // Code blocks (```lang ... ```)
  let html = md.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
    return '<pre style="background:#f5f5f5;padding:0.6rem;border-radius:6px;overflow-x:auto;font-size:0.84em;margin:0.5rem 0"><code>' + escapeHtml(code) + '</code></pre>';
  });
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Unordered lists (simple, one-level)
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  // Paragraphs — split on double newlines
  html = html.replace(/\n{2,}/g, '</p><p>');
  if (!html.startsWith('<')) html = '<p>' + html;
  if (!html.endsWith('>')) html += '</p>';
  return html;
}

/** Syntax-highlight JSON for the output panel */
function syntaxHighlight(jsonStr) {
  try {
    const pretty = JSON.stringify(JSON.parse(jsonStr), null, 2);
    return escapeHtml(pretty)
      .replace(/"([^"]+)":/g, '<span style="color:#89b4fa">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span style="color:#a6e3a1">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span style="color:#fab387">$1</span>')
      .replace(/: (true|false|null)/g, ': <span style="color:#cba6f7">$1</span>');
  } catch (_) {
    return escapeHtml(jsonStr);
  }
}
