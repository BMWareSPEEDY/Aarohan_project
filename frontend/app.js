// --------- CONFIG: API base URL ----------------------------------------
// Point this at your backend. For local dev with Flask on port 5000:
const API_BASE_URL = "http://127.0.0.1:5500";

// --------- GLOBAL STATE ------------------------------------------------

let INCIDENTS = [];          // full dataset from backend for current place
let FILTERED_INCIDENTS = []; // after applying UI filters
let CURRENT_PLACE_ID = null;
let socket = null;           // Socket.IO connection
let isConnected = false;     // Connection status

// --------- UTILITIES ---------------------------------------------------

function formatDateTime(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function differenceInHours(fromISO, toISO) {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return (b - a) / (1000 * 60 * 60);
}

// --------- API LAYER ---------------------------------------------------

async function fetchIncidentsForPlace(placeId) {
  try {
    const url = `${API_BASE_URL}/api/incidents?place_id=${encodeURIComponent(
      placeId
    )}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error("API error", res.status);
      updateStatusBanner(
        `Backend responded with ${res.status}. Check your server and place ID.`,
        true
      );
      return [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.incidents)) {
      updateStatusBanner(
        "API response format is invalid. Expected { incidents: [...] }.",
        true
      );
      return [];
    }

    return data.incidents;
  } catch (err) {
    console.error("Network/API error:", err);
    updateStatusBanner(
      "Unable to reach backend API. Verify API_BASE_URL and that the server is running.",
      true
    );
    return [];
  }
}

// --------- STATUS BANNER -----------------------------------------------

function updateStatusBanner(text, isError = false) {
  const banner = document.getElementById("status-banner");
  const span = document.getElementById("status-text");
  span.textContent = text;
  banner.style.borderColor = isError
    ? "rgba(248, 113, 113, 0.7)"
    : "rgba(148, 163, 184, 0.6)";
}

// --------- FILTERS -----------------------------------------------------

function getFilters() {
  return {
    issue: document.getElementById("filter-issue").value,
    severity: document.getElementById("filter-severity").value,
    status: document.getElementById("filter-status").value,
    zone: document.getElementById("filter-zone").value
  };
}

function applyFilters(data, filters) {
  return data.filter((item) => {
    if (filters.issue && item.type !== filters.issue) return false;
    if (filters.severity && item.severity !== filters.severity) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.zone && item.zone !== filters.zone) return false;
    return true;
  });
}

// --------- METRICS -----------------------------------------------------

function updateMetrics(data) {
  const total = data.length;

  const criticalOpen = data.filter(
    (d) => d.severity === "Critical" && d.status !== "Resolved"
  ).length;

  const resolved = data.filter((d) => d.status === "Resolved");
  let avgHours = 0;
  if (resolved.length) {
    const nowISO = new Date().toISOString();
    const totalHours = resolved.reduce(
      (sum, d) => sum + differenceInHours(d.detectedAt, nowISO),
      0
    );
    avgHours = totalHours / resolved.length;
  }

  document.getElementById("metric-total").textContent = total || "0";
  document.getElementById("metric-critical").textContent = criticalOpen || "0";
  document.getElementById("metric-ttc").textContent = resolved.length
    ? `${avgHours.toFixed(1)} h`
    : "–";
}

// --------- CHARTS ------------------------------------------------------

function buildIncidentsByType(data) {
  const container = document.getElementById("chart-by-type");
  container.innerHTML = "";

  if (!data.length) {
    container.classList.add("empty-placeholder");
    container.textContent = "No incidents loaded for this place.";
    return;
  }
  container.classList.remove("empty-placeholder");

  const counts = {};
  data.forEach((d) => {
    counts[d.type] = (counts[d.type] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 1);

  entries.forEach(([type, count]) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = type || "Unknown";

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(count / max) * 100}%`;
    track.appendChild(fill);

    const value = document.createElement("div");
    value.className = "bar-value";
    value.textContent = count;

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    container.appendChild(row);
  });
}

function buildIncidentsBySeverity(data) {
  const container = document.getElementById("chart-by-severity");
  container.innerHTML = "";

  if (!data.length) {
    container.classList.add("empty-placeholder");
    container.textContent = "No incidents loaded for this place.";
    return;
  }
  container.classList.remove("empty-placeholder");

  const levels = ["Critical", "High", "Medium", "Low"];
  const colors = {
    Critical: "segment-critical",
    High: "segment-high",
    Medium: "segment-medium",
    Low: "segment-low"
  };

  const counts = {};
  levels.forEach((l) => (counts[l] = 0));
  data.forEach((d) => {
    counts[d.severity] = (counts[d.severity] || 0) + 1;
  });

  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  const row = document.createElement("div");
  row.className = "bar-row";

  const label = document.createElement("div");
  label.className = "bar-label";
  label.textContent = "Share of incidents";

  const track = document.createElement("div");
  track.className = "severity-track";

  levels.forEach((level) => {
    const count = counts[level];
    if (!count) return;
    const seg = document.createElement("div");
    seg.className = `severity-segment ${colors[level]}`;
    seg.style.width = `${(count / (total || 1)) * 100}%`;
    track.appendChild(seg);
  });

  const value = document.createElement("div");
  value.className = "bar-value";
  value.textContent = total ? total : "0";

  row.appendChild(label);
  row.appendChild(track);
  row.appendChild(value);
  container.appendChild(row);
}

// --------- TABLE -------------------------------------------------------

function severityClass(severity) {
  return {
    Critical: "tag-severity-critical",
    High: "tag-severity-high",
    Medium: "tag-severity-medium",
    Low: "tag-severity-low"
  }[severity];
}

function statusClass(status) {
  return {
    Open: "tag-status-open",
    "In Progress": "tag-status-inprogress",
    Resolved: "tag-status-resolved"
  }[status];
}

function renderTable(data) {
  const tbody = document.getElementById("incident-table-body");
  tbody.innerHTML = "";

  data.forEach((d) => {
    const tr = document.createElement("tr");

    const id = d.id || "—";
    const type = d.type || "—";
    const severity = d.severity || "—";
    const status = d.status || "—";
    const zone = d.zone || "—";
    const detectedAt = d.detectedAt || d.detected_at || null;
    const drone = d.drone || d.source || "—";
    const evidenceUrl = d.evidenceUrl || d.evidence_url || "#";

    tr.innerHTML = `
      <td>${id}</td>
      <td>${type}</td>
      <td>
        <span class="tag ${severityClass(severity) || ""}">${severity}</span>
      </td>
      <td>
        <span class="tag ${statusClass(status) || ""}">${status}</span>
      </td>
      <td>${zone}</td>
      <td>${formatDateTime(detectedAt)}</td>
      <td>${drone}</td>
      <td><a class="evidence-link" href="${evidenceUrl}">View Frame</a></td>
    `;

    tbody.appendChild(tr);
  });

  const countEl = document.getElementById("table-count");
  countEl.textContent = `${data.length} incident${data.length === 1 ? "" : "s"
    }`;
}

// --------- CLOCK -------------------------------------------------------

function startClock() {
  const dateEl = document.getElementById("clock-date");
  const timeEl = document.getElementById("clock-time");

  function tick() {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    timeEl.textContent = now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  tick();
  setInterval(tick, 1000);
}

// --------- CORE REFRESH PIPELINE --------------------------------------

function refreshAllViews() {
  updateMetrics(FILTERED_INCIDENTS);
  buildIncidentsByType(FILTERED_INCIDENTS);
  buildIncidentsBySeverity(FILTERED_INCIDENTS);
  renderTable(FILTERED_INCIDENTS);
}

// --------- PLACE LOADING ----------------------------------------------

async function loadPlace(placeId) {
  if (!placeId) {
    updateStatusBanner("Enter a valid place ID or name to load scan data.", true);
    return;
  }

  updateStatusBanner(`Loading incidents for "${placeId}"...`, false);
  document.getElementById("current-place-label").textContent = placeId;

  const incidents = await fetchIncidentsForPlace(placeId);

  INCIDENTS = incidents;
  CURRENT_PLACE_ID = placeId;

  // Reset filters when place changes
  ["filter-issue", "filter-severity", "filter-status", "filter-zone"].forEach(
    (id) => (document.getElementById(id).value = "")
  );

  FILTERED_INCIDENTS = [...INCIDENTS];

  if (!INCIDENTS.length) {
    updateStatusBanner(
      `No incidents found for "${placeId}". Ensure YOLO pipeline has written data for this area.`,
      false
    );
  } else {
    updateStatusBanner(
      `Loaded ${INCIDENTS.length} incidents for "${placeId}" from proprietary database.`,
      false
    );
  }

  refreshAllViews();
}

// --------- WIRING ------------------------------------------------------

function wireEvents() {
  // Load button
  document
    .getElementById("place-load-btn")
    .addEventListener("click", () => {
      const placeId = document.getElementById("place-input").value.trim();
      loadPlace(placeId);
    });

  // Enter key on place input
  document
    .getElementById("place-input")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const placeId = e.target.value.trim();
        loadPlace(placeId);
      }
    });

  // Filters
  document
    .getElementById("apply-filters")
    .addEventListener("click", () => {
      const filters = getFilters();
      FILTERED_INCIDENTS = applyFilters(INCIDENTS, filters);
      refreshAllViews();
    });

  document
    .getElementById("clear-filters")
    .addEventListener("click", () => {
      ["filter-issue", "filter-severity", "filter-status", "filter-zone"].forEach(
        (id) => (document.getElementById(id).value = "")
      );
      FILTERED_INCIDENTS = [...INCIDENTS];
      refreshAllViews();
    });
}

// --------- SOCKET.IO INTEGRATION ---------------------------------------

function initializeSocketIO() {
  console.log('Initializing Socket.IO connection to:', API_BASE_URL);

  // Check if io is available
  if (typeof io === 'undefined') {
    console.error('Socket.IO client library not loaded!');
    updateConnectionStatus('Socket.IO library failed to load', true);
    return;
  }

  try {
    socket = io(API_BASE_URL);
    console.log('Socket.IO instance created');

    // Connection events
    socket.on('connect', () => {
      console.log('Socket.IO connected');
      isConnected = true;
      updateConnectionStatus('Connected to live detection server', false);
      document.getElementById('live-badge').style.display = 'inline-block';
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      isConnected = false;
      updateConnectionStatus('Disconnected from server. Attempting to reconnect...', true);
      document.getElementById('live-badge').style.display = 'none';
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      updateConnectionStatus('Connection error: ' + error.message, true);
    });

    socket.on('connection_status', (data) => {
      console.log('Connection status:', data);
      updateConnectionStatus(data.message, false);
    });

    // Live video feed
    socket.on('video_frame', (data) => {
      const feedImg = document.getElementById('live-feed');
      if (feedImg && data.frame) {
        feedImg.src = data.frame;
      }
    });

    // New detection events
    socket.on('new_detection', (detection) => {
      console.log('New detection received:', detection);

      // Add to incidents array (prepend so it appears at top)
      INCIDENTS.unshift(detection);

      // Reapply filters
      const filters = getFilters();
      FILTERED_INCIDENTS = applyFilters(INCIDENTS, filters);

      // Refresh all views
      refreshAllViews();

      // Show notification
      updateConnectionStatus(
        `New ${detection.severity} detection: ${detection.type} (conf: ${detection.confidence})`,
        false
      );
    });

    // Statistics updates
    socket.on('detection_stats', (stats) => {
      console.log('Stats update:', stats);
    });

    // Detection history (when requested)
    socket.on('detection_history', (data) => {
      console.log('Received detection history:', data.incidents.length);
      INCIDENTS = data.incidents;
      FILTERED_INCIDENTS = [...INCIDENTS];
      refreshAllViews();
    });
  } catch (error) {
    console.error('Error creating Socket.IO connection:', error);
    updateConnectionStatus('Failed to initialize connection: ' + error.message, true);
  }
}

function updateConnectionStatus(text, isError = false) {
  const banner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const indicator = document.getElementById('status-indicator');

  if (statusText) {
    statusText.textContent = text;
  }

  if (banner) {
    banner.style.borderColor = isError
      ? 'rgba(248, 113, 113, 0.7)'
      : 'rgba(34, 197, 94, 0.7)';
  }

  if (indicator) {
    indicator.style.color = isError ? '#f87171' : '#22c55e';
  }
}

function setupLiveFeedToggle() {
  const toggleBtn = document.getElementById('toggle-feed');
  const feedWrapper = document.getElementById('live-feed-wrapper');
  let isShowing = false;

  toggleBtn.addEventListener('click', () => {
    isShowing = !isShowing;
    feedWrapper.style.display = isShowing ? 'block' : 'none';
    toggleBtn.textContent = isShowing ? 'Hide Feed' : 'Show Feed';
  });
}

// -------- BOOTSTRAP ---------------------------------------------------

// Initialize when DOMis ready
function initialize() {
  console.log('Initializing SkySpect dashboard...');
  startClock();
  wireEvents();
  setupLiveFeedToggle();
  initializeSocketIO();

  // Request historical detections from server after connection
  setTimeout(() => {
    if (socket && isConnected) {
      console.log('Requesting detection history from server');
      socket.emit('request_history');
    }
  }, 500);
}

// Primary initialization: DOMContentLoaded event
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOMContentLoaded fired');
  initialize();
});

// Fallback: If DOM is already ready when this script runs
if (document.readyState !== 'loading') {
  console.log('DOM already ready (readyState: ' + document.readyState + '), initializing immediately');
  initialize();
}
