/* NLStat — shared config and utility functions */

// ── API bases (no backend needed — CBS data is loaded at runtime)
const PLUMBER_BASE = null;
const ML_BASE      = null;

// ── Domain definitions
const DEFAULT_PROFILE_CATEGORIES = [
  'Demographics',
  'Inequality',
  'HumanCapital',
];

const EXCLUDED_PROFILE_KEYS = [
  'Naam', 'Provincie', 'Population',
  '_poverty_pct', '_unemp_pct', '_edu_high_pct', '_bijstand',
  '_avg_income', '_woz_value', '_social_hh',
  '_wmo_per1k', '_biz_density', '_ao_per1k',
  '_density', '_settle',
];

// ── Map choropleth modes
const CHOROPLETH_CONFIG = {
  poverty: {
    label:   'Poverty rate',
    prop:    '_poverty_pct',
    unit:    '%',
    palette: ['#fee5d9','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#99000d'],
    nullColor: '#e0ddd8',
  },
  unemployment: {
    label:   'Unemployment (WW proxy)',
    prop:    '_unemp_pct',
    unit:    '%',
    palette: ['#edf8fb','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#005824'],
    nullColor: '#e0ddd8',
  },
  edu_high: {
    label:   'High education',
    prop:    '_edu_high_pct',
    unit:    '%',
    palette: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#3182bd','#08519c'],
    nullColor: '#e0ddd8',
  },
  bijstand: {
    label:   'Bijstand recipients',
    prop:    '_bijstand',
    unit:    '/1k',
    palette: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#756bb1','#54278f'],
    nullColor: '#e0ddd8',
  },
  avg_income: {
    label:   'Avg income per inhabitant',
    prop:    '_avg_income',
    unit:    'k€',
    palette: ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#e34a33','#b30000'],
    nullColor: '#e0ddd8',
  },
  woz_value: {
    label:   'Avg WOZ property value',
    prop:    '_woz_value',
    unit:    'k€',
    palette: ['#f7f4f9','#e7e1ef','#d4b9da','#c994c7','#df65b0','#e7298a','#91003f'],
    nullColor: '#e0ddd8',
  },
  social_hh: {
    label:   'Social housing',
    prop:    '_social_hh',
    unit:    '%',
    palette: ['#ffffd9','#edf8b1','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#0c2c84'],
    nullColor: '#e0ddd8',
  },
  wmo_clients: {
    label:   'Wmo care clients',
    prop:    '_wmo_per1k',
    unit:    '/1k',
    palette: ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#43a2ca','#0868ac'],
    nullColor: '#e0ddd8',
  },
  biz_density: {
    label:   'Business density',
    prop:    '_biz_density',
    unit:    '/1k',
    palette: ['#fff7fb','#ece2f0','#d0d1e6','#a6bddb','#67a9cf','#1c9099','#016c59'],
    nullColor: '#e0ddd8',
  },
  disability: {
    label:   'Disability benefit',
    prop:    '_ao_per1k',
    unit:    '/1k',
    palette: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#e6550d','#a63603'],
    nullColor: '#e0ddd8',
  },
};

// ── Provinces (12 Dutch provinces)
const NL_PROVINCES = [
  { code: 'PV20', name: 'Groningen',     abbr: 'Gron.' },
  { code: 'PV21', name: 'Friesland',     abbr: 'Friesl.' },
  { code: 'PV22', name: 'Drenthe',       abbr: 'Drenthe' },
  { code: 'PV23', name: 'Overijssel',    abbr: 'Overijs.' },
  { code: 'PV24', name: 'Flevoland',     abbr: 'Flevol.' },
  { code: 'PV25', name: 'Gelderland',    abbr: 'Gelderl.' },
  { code: 'PV26', name: 'Utrecht',       abbr: 'Utrecht' },
  { code: 'PV27', name: 'Noord-Holland', abbr: 'N-Holl.' },
  { code: 'PV28', name: 'Zuid-Holland',  abbr: 'Z-Holl.' },
  { code: 'PV29', name: 'Zeeland',       abbr: 'Zeeland' },
  { code: 'PV30', name: 'Noord-Brabant', abbr: 'Brabant' },
  { code: 'PV31', name: 'Limburg',       abbr: 'Limburg' },
];

// ── Domain display labels
const DOMAIN_EN = {
  Demographics: 'Demographics',
  Inequality:   'Inequality & Poverty',
  HumanCapital: 'Human Capital',
  Housing:      'Housing',
  IncomeWealth: 'Income & Wealth',
  Services:     'Services Accessibility',
  WelfareCare:  'Welfare & Care',
  Economy:      'Economy & Business',
  Environment:  'Energy & Environment',
};

// ── Indicator labels
const LABEL_EN = {
  // Demographics
  'Under 15 years (%)':              'Under 15 years (%)',
  '15-24 years (%)':                 '15–24 years (%)',
  '25-44 years (%)':                 '25–44 years (%)',
  '45-64 years (%)':                 '45–64 years (%)',
  '65+ years (%)':                   '65+ years (%)',
  'Non-Western background (%)':      'Non-Western background (%)',
  'Foreign born (%)':                'Foreign born (%)',
  'Population density (per km²)':    'Population density (per km²)',
  'Birth rate (per 1000)':           'Birth rate (per 1,000)',
  'Mortality rate (per 1000)':       'Mortality rate (per 1,000)',
  'Unmarried (%)':                   'Single / unmarried (%)',
  'Married (%)':                     'Married (%)',
  'Divorced (%)':                    'Divorced (%)',
  'Widowed (%)':                     'Widowed (%)',
  'Avg household size':              'Avg household size',
  // Inequality
  'Low income threshold (%)':        'Below low-income threshold (%)',
  'At-or-below social minimum (%)':  'At/below social minimum (%)',
  'Bijstand recipients (per 1k)':    'Bijstand recipients (per 1,000)',
  'Youth welfare (%)':               'Youth welfare (%)',
  'Bottom-40% income share (%)':     'Bottom-40% income share (%)',
  'Top-20% income share (%)':        'Top-20% income share (%)',
  // Human Capital
  'Low education (%)':               'Low education (%)',
  'Medium education (%)':            'Medium education (%)',
  'High education (%)':              'High education (%)',
  'Labour participation (%)':        'Labour participation (%)',
  'Employees (% of workforce)':      'Employees (% of workforce)',
  'Self-employed (% of workforce)':  'Self-employed (% of workforce)',
  'Unemployment proxy (%)':          'WW unemployment benefit (%)',
  // Housing
  'Avg WOZ value (x€1k)':            'Avg WOZ property value (×€1k)',
  'Owner-occupied (%)':              'Owner-occupied (%)',
  'Rental homes (%)':                'Rental homes (%)',
  'Social housing (%)':              'Social housing (%)',
  'Pre-2000 stock (%)':              'Pre-2000 building stock (%)',
  'Post-2000 stock (%)':             'Post-2000 building stock (%)',
  // Income & Wealth
  'Avg income per inhabitant (x€1k)': 'Avg income per inhabitant (×€1k)',
  'Avg income per earner (x€1k)':     'Avg income per earner (×€1k)',
  'Avg household income (x€1k)':      'Avg household income (×€1k)',
  'Median household wealth (x€1k)':   'Median household wealth (×€1k)',
  // Services
  'Distance to GP (km)':             'Distance to GP (km)',
  'Distance to supermarket (km)':    'Distance to supermarket (km)',
  'Distance to school (km)':         'Distance to school (km)',
  'Distance to daycare (km)':        'Distance to daycare (km)',
  'Schools within 3km':              'Schools within 3 km',
  'Degree of urbanisation (1–5)':    'Degree of urbanisation (1–5)',
  // Demographics (new)
  'Male (%)':                        'Male (%)',
  'Female (%)':                      'Female (%)',
  'Western background (%)':          'Western migration background (%)',
  'Single-person households (%)':    'Single-person households (%)',
  // Inequality (new)
  'Near-poverty 110% (%)':           'Near-poverty 110% threshold (%)',
  'Near-poverty 120% (%)':           'Near-poverty 120% threshold (%)',
  // Housing (new)
  'Single-family homes (%)':         'Single-family homes (%)',
  'Multi-family homes (%)':          'Multi-family homes (%)',
  'Vacancy rate (%)':                'Vacant homes (%)',
  // Welfare & Care
  'Wmo care clients (per 1k)':       'Wmo care clients (per 1,000)',
  'Disability benefit (per 1k)':     'Disability benefit recipients (per 1,000)',
  'AOW pension recipients (per 1k)': 'AOW pension recipients (per 1,000)',
  // Economy & Business
  'Business density (per 1k pop)':   'Business density (per 1,000 pop.)',
  'Agriculture sector (%)':          'Agriculture sector (%)',
  'Industry & energy sector (%)':    'Industry & energy sector (%)',
  'Trade & hospitality sector (%)':  'Trade & hospitality sector (%)',
  'Transport & ICT sector (%)':      'Transport & ICT sector (%)',
  'Finance & real estate sector (%)':'Finance & real estate sector (%)',
  'Business services sector (%)':    'Business services sector (%)',
  'Public/edu/health sector (%)':    'Public / education / health sector (%)',
  'Culture & recreation sector (%)': 'Culture & recreation sector (%)',
  'Cars per household':              'Cars per household',
  'EV & alternative fuel cars (%)':  'EV & alt. fuel cars (%)',
  // Environment
  'Avg electricity use (kWh/yr)':    'Avg electricity use (kWh/yr)',
  'Avg gas use (m³/yr)':             'Avg natural gas use (m³/yr)',
  'District heating (%)':            'District heating (%)',
  'Land area (km²)':                 'Land area (km²)',
  'Water area (km²)':                'Water area (km²)',
  'Water share (%)':                 'Water share of total area (%)',
};

// ── I18n strings
const I18N = {
  'app.title':       'NLStat',
  'app.subtitle':    'Netherlands Inequality & Human Capital Dashboard',
  'card.level':      'Geographic Level',
  'card.province':   'Province',
  'card.colour':     'Map Colour',
  'card.clear':      'Clear',
  'card.reset':      'Reset',
  'btn.build':       'Open in NLStat →',
  'col.indicator':   'Indicator',
  'col.selected':    'Avg Selected',
  'col.nl':          'NL Average',
  'tab.demo':        'Demographics',
  'tab.ineq':        'Inequality',
  'tab.hc':          'Human Capital',
  'tab.typo':        'Typology',
  'tab.analysis':    'Analysis',
};

const currentLang = 'en';

// ── Helpers
function t(key)       { return I18N[key]    ?? key; }
function tLabel(l)    { return LABEL_EN[l]  ?? l;   }
function tDomain(d)   { return DOMAIN_EN[d] ?? d;   }

function getScalar(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v))             return v[0];
  if (typeof v === 'object')        return Object.values(v)[0];
  return v;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatIndicatorValue(domain, indicator, value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–';
  if (indicator.includes('(%)'))   return `${value.toFixed(1)}%`;
  if (indicator.includes('km²'))   return value.toLocaleString();
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function displayIndicatorLabel(domain, indicator) {
  return tLabel(indicator);
}

function totalPopulationForData(dataMap) {
  return Object.values(dataMap || {}).reduce((sum, zone) => {
    return sum + (Number(getScalar(zone?.Population)) || 0);
  }, 0);
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
}

// ── Quantile breaks helper (for choropleth)
function computeQuantileBreaks(values, n) {
  const sorted = values.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const breaks = [];
  for (let i = 1; i < n; i++) {
    const idx = Math.floor((i / n) * sorted.length);
    breaks.push(sorted[idx]);
  }
  return breaks;
}

// ── Pure JS k-means (Lloyd's algorithm, multiple restarts)
function kMeans(points, k, restarts = 5, iterations = 100) {
  if (points.length < k) k = points.length;
  let bestResult = null;
  let bestInertia = Infinity;

  for (let r = 0; r < restarts; r++) {
    const centroids = shuffle(points.slice()).slice(0, k).map(p => p.slice());
    let assignments = new Array(points.length).fill(0);

    for (let iter = 0; iter < iterations; iter++) {
      let changed = false;
      for (let i = 0; i < points.length; i++) {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = euclidean(points[i], centroids[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (assignments[i] !== best) { assignments[i] = best; changed = true; }
      }
      if (!changed) break;

      // Update centroids
      const sums   = Array.from({length: k}, () => new Array(points[0].length).fill(0));
      const counts = new Array(k).fill(0);
      for (let i = 0; i < points.length; i++) {
        const c = assignments[i];
        counts[c]++;
        points[i].forEach((v, j) => { sums[c][j] += v; });
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) centroids[c] = sums[c].map(v => v / counts[c]);
      }
    }

    // Compute inertia
    const inertia = points.reduce((s, p, i) => s + euclidean(p, centroids[assignments[i]]) ** 2, 0);
    if (inertia < bestInertia) {
      bestInertia = inertia;
      bestResult  = { assignments: assignments.slice(), centroids: centroids.map(c => c.slice()) };
    }
  }
  return bestResult;
}

function euclidean(a, b) {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Z-score normalise for clustering/analysis
function zScoreNormalise(vectors) {
  const n   = vectors.length;
  const dim = vectors[0].length;
  const means = new Array(dim).fill(0);
  const stds  = new Array(dim).fill(0);

  vectors.forEach(v => v.forEach((x, j) => { means[j] += x / n; }));
  vectors.forEach(v => v.forEach((x, j) => { stds[j]  += (x - means[j]) ** 2 / n; }));
  stds.forEach((v, j) => { stds[j] = Math.sqrt(v) || 1; });

  return { normalised: vectors.map(v => v.map((x, j) => (x - means[j]) / stds[j])), means, stds };
}

// Cluster colour palette
const CLUSTER_COLORS = ['#4f46e5','#dc2626','#2ca25f','#f97316','#7c3aed'];
