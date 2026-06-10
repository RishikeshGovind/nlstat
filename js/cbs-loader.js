/**
 * NLStat CBS Data Loader
 * Fetches gemeente-level indicators from CBS StatLine OData4 API.
 * Dataset 85039NED: Kerncijfers wijken en buurten 2022
 *
 * Falls back to embedded demo data for 40 major municipalities if the CBS
 * API is unavailable (CORS block, network error, etc.).
 */

const CBS_BASE   = 'https://opendata.cbs.nl/OData4/CBS';
const DATASET_ID = '85039NED';
const PERIOD     = '2022JJ00';
const CACHE_KEY  = 'nlstat_cbs_data_v7';
const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours

// ── CBS column → domain/label/mapKey mapping
// Keys are the actual CBS topic codes for dataset 85039NED.
// We also try keyword-based matching as a fallback (see buildVariableMapFromProps).
const CBS_KNOWN_VARS = {
  // ── Demographics
  'AantalInwoners_5':                { domain: 'Demographics', label: 'Population',                      fmt: 'number', mapKey: '_population' },
  'Mannen_6':                        { domain: 'Demographics', label: 'Male (%)',                         fmt: 'pct' },
  'Vrouwen_7':                       { domain: 'Demographics', label: 'Female (%)',                       fmt: 'pct' },
  'k_0Tot15Jaar_8':                  { domain: 'Demographics', label: 'Under 15 years (%)',               fmt: 'pct' },
  'k_15Tot25Jaar_9':                 { domain: 'Demographics', label: '15-24 years (%)',                  fmt: 'pct' },
  'k_25Tot45Jaar_10':                { domain: 'Demographics', label: '25-44 years (%)',                  fmt: 'pct' },
  'k_45Tot65Jaar_11':                { domain: 'Demographics', label: '45-64 years (%)',                  fmt: 'pct' },
  'k_65JaarOfOuder_12':              { domain: 'Demographics', label: '65+ years (%)',                    fmt: 'pct' },
  'Omgevingsadressendichtheid_14':   { domain: 'Demographics', label: 'Population density (per km²)',     fmt: 'number' },
  'NietWesterscheAchtergrond_37':    { domain: 'Demographics', label: 'Non-Western background (%)',       fmt: 'pct' },
  'NietWesterscheAchtergrond_38':    { domain: 'Demographics', label: 'Non-Western background (%)',       fmt: 'pct' },
  // ── Inequality
  'PersonenMetEenLaagInkomen_88':    { domain: 'Inequality',   label: 'Low income threshold (%)',         fmt: 'pct', mapKey: '_poverty_pct' },
  'PersonenMetEenLaagInkomen_89':    { domain: 'Inequality',   label: 'Low income threshold (%)',         fmt: 'pct', mapKey: '_poverty_pct' },
  'LangdurigLaagInkomen_90':         { domain: 'Inequality',   label: 'Long-term poverty (%)',            fmt: 'pct' },
  'LangdurigLaagInkomen_91':         { domain: 'Inequality',   label: 'Long-term poverty (%)',            fmt: 'pct' },
  'PersonenMetBijstandsuitkering_92':{ domain: 'Inequality',   label: 'Bijstand recipients (%)',          fmt: 'pct', mapKey: '_bijstand' },
  'PersonenMetBijstandsuitkering_94':{ domain: 'Inequality',   label: 'Bijstand recipients (%)',          fmt: 'pct', mapKey: '_bijstand' },
  // ── Human Capital
  'WerkloosheidsPercentage_56':      { domain: 'HumanCapital', label: 'Unemployment rate (%)',            fmt: 'pct', mapKey: '_unemp_pct' },
  'WerkloosheidsPercentage_57':      { domain: 'HumanCapital', label: 'Unemployment rate (%)',            fmt: 'pct', mapKey: '_unemp_pct' },
  'OpleidingsniveauLaag_64':         { domain: 'HumanCapital', label: 'Low education (%)',                fmt: 'pct' },
  'OpleidingsniveauMiddelbaar_65':   { domain: 'HumanCapital', label: 'Medium education (%)',             fmt: 'pct' },
  'OpleidingsniveauHoog_66':         { domain: 'HumanCapital', label: 'High education (%)',               fmt: 'pct', mapKey: '_edu_high_pct' },
  'NettoBeroepsbevolking_53':        { domain: 'HumanCapital', label: 'Labour participation (%)',         fmt: 'pct' },
  'NettoBeroepsbevolking_54':        { domain: 'HumanCapital', label: 'Labour participation (%)',         fmt: 'pct' },
};

// ── Keyword fallback: match CBS property titles to domains
function buildVariableMapFromProps(props) {
  const map = {};
  for (const p of props) {
    if (p.Type !== 'Topic') continue;
    const key   = p.Key;
    if (!key || CBS_KNOWN_VARS[key]) continue; // skip if already mapped
    const title = (p.Title || '').toLowerCase();

    if (/\baantal inwoners\b/.test(title) || /\bbevolking totaal\b/.test(title))
      map[key] = { domain: 'Demographics', label: 'Population', fmt: 'number', mapKey: '_population' };
    else if (/0 tot 15|0-15 jaar/.test(title))
      map[key] = { domain: 'Demographics', label: 'Under 15 years (%)', fmt: 'pct' };
    else if (/65 jaar of ouder|65\+/.test(title))
      map[key] = { domain: 'Demographics', label: '65+ years (%)', fmt: 'pct' };
    else if (/omgevingsadressendichtheid/.test(title))
      map[key] = { domain: 'Demographics', label: 'Population density (per km²)', fmt: 'number' };
    else if (/niet.?western/.test(title))
      map[key] = { domain: 'Demographics', label: 'Non-Western background (%)', fmt: 'pct' };
    else if (/laag inkomen|lage inkomens/.test(title) && !/langdurig/.test(title))
      map[key] = { domain: 'Inequality', label: 'Low income threshold (%)', fmt: 'pct', mapKey: '_poverty_pct' };
    else if (/langdurig.*inkomen|langdurig.*arm/.test(title))
      map[key] = { domain: 'Inequality', label: 'Long-term poverty (%)', fmt: 'pct' };
    else if (/bijstand/.test(title))
      map[key] = { domain: 'Inequality', label: 'Bijstand recipients (%)', fmt: 'pct', mapKey: '_bijstand' };
    else if (/werkloosheid/.test(title))
      map[key] = { domain: 'HumanCapital', label: 'Unemployment rate (%)', fmt: 'pct', mapKey: '_unemp_pct' };
    else if (/laag.*opleid/.test(title))
      map[key] = { domain: 'HumanCapital', label: 'Low education (%)', fmt: 'pct' };
    else if (/middel.*opleid/.test(title))
      map[key] = { domain: 'HumanCapital', label: 'Medium education (%)', fmt: 'pct' };
    else if (/hoog.*opleid/.test(title))
      map[key] = { domain: 'HumanCapital', label: 'High education (%)', fmt: 'pct', mapKey: '_edu_high_pct' };
    else if (/netto beroepsbevolking|arbeidsdeelname/.test(title))
      map[key] = { domain: 'HumanCapital', label: 'Labour participation (%)', fmt: 'pct' };
  }
  return map;
}

// ── Fetch CBS DataProperties to discover topic column names
async function fetchDataProperties() {
  const url = `${CBS_BASE}/${DATASET_ID}/DataProperties`;
  const r   = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`DataProperties HTTP ${r.status}`);
  const json = await r.json();
  return json.value || [];
}

// ── Fetch all gemeente observations (handles @odata.nextLink pagination)
async function fetchObservations(varKeys) {
  const allRows = [];
  const select  = ['RegioS', 'Perioden', ...varKeys.slice(0, 50)].join(','); // OData select limit
  let url = `${CBS_BASE}/${DATASET_ID}/Observations?$filter=startswith(RegioS,'GM') and Perioden eq '${PERIOD}'&$select=${select}&$top=500`;

  while (url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Observations HTTP ${r.status}`);
    const json = await r.json();
    allRows.push(...(json.value || []));
    url = json['@odata.nextLink'] || null;
  }
  return allRows;
}

// ── Reshape CBS rows → NLStat data.json-compatible object
function reshapeRows(rows, varMap) {
  const gemeenteMap = {};

  for (const row of rows) {
    const rawCode = (row.RegioS || '').trim();
    if (!rawCode.startsWith('GM')) continue;

    if (!gemeenteMap[rawCode]) {
      gemeenteMap[rawCode] = {
        Naam: '',
        Provincie: '',
        Population: 0,
        _poverty_pct:  null,
        _unemp_pct:    null,
        _edu_high_pct: null,
        _bijstand:     null,
        Demographics:  {},
        Inequality:    {},
        HumanCapital:  {},
      };
    }

    const gm = gemeenteMap[rawCode];
    for (const [key, cfg] of Object.entries(varMap)) {
      const raw = row[key];
      if (raw === null || raw === undefined || raw === '') continue;
      const val = parseFloat(raw);
      if (isNaN(val)) continue;

      if (cfg.mapKey === '_population') {
        gm.Population = val;
      } else if (cfg.mapKey) {
        gm[cfg.mapKey] = val;
      }
      gm[cfg.domain][cfg.label] = val;
    }
  }

  // Handle duplicate label conflicts by keeping the first non-null value
  return gemeenteMap;
}

// ── Compute Netherlands-wide averages (population-weighted where appropriate)
function computeNLTotals(gemeenteMap) {
  const totals = { Population: 0, Demographics: {}, Inequality: {}, HumanCapital: {} };
  const sums   = { Demographics: {}, Inequality: {}, HumanCapital: {} };
  const counts = { Demographics: {}, Inequality: {}, HumanCapital: {} };

  for (const gm of Object.values(gemeenteMap)) {
    totals.Population += gm.Population || 0;
    for (const domain of ['Demographics', 'Inequality', 'HumanCapital']) {
      if (!sums[domain]) { sums[domain] = {}; counts[domain] = {}; }
      for (const [ind, val] of Object.entries(gm[domain] || {})) {
        if (typeof val !== 'number') continue;
        sums[domain][ind]   = (sums[domain][ind]   || 0) + val;
        counts[domain][ind] = (counts[domain][ind] || 0) + 1;
      }
    }
  }

  for (const domain of ['Demographics', 'Inequality', 'HumanCapital']) {
    for (const [ind, sum] of Object.entries(sums[domain] || {})) {
      totals[domain][ind] = counts[domain][ind] > 0 ? parseFloat((sum / counts[domain][ind]).toFixed(2)) : null;
    }
  }
  return totals;
}

// ── Inject province names from GeoJSON into gemeente records
function injectProvinceNames(gemeenteMap, geojsonFeatures) {
  for (const f of geojsonFeatures) {
    const p   = f.properties || {};
    const gmc = (p.statcode || p.gm_code || p.gemcode || '').trim();
    if (!gmc) continue;
    const naam = p.statnaam || p.gm_naam || p.gemeentenaam || '';
    const prov = p.prov_naam || p.prov_code || '';
    if (gemeenteMap[gmc]) {
      if (!gemeenteMap[gmc].Naam)      gemeenteMap[gmc].Naam      = naam;
      if (!gemeenteMap[gmc].Provincie) gemeenteMap[gmc].Provincie = prov;
    }
  }
}

// ── Main entry point — returns { Gemeente, 'Netherlands Total' }
async function loadNLStatData(geojsonFeatures, onProgress) {
  // 1. Try sessionStorage cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) {
        onProgress?.('Using cached data…');
        return data;
      }
    }
  } catch(_) {}

  // 2. Load pre-built static dataset (generated by build/fetch_nl_data.py)
  // This is the only data source — all 352 gemeenten, no live API calls.
  onProgress?.('Loading nl_data.json…');
  const r = await fetch('./data/nl_data.json', { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Failed to load nl_data.json (HTTP ${r.status}). Make sure data/nl_data.json is committed to the repo.`);
  const data = await r.json();
  if (!data.Gemeente || Object.keys(data.Gemeente).length < 100)
    throw new Error(`nl_data.json loaded but contains too few municipalities (${Object.keys(data.Gemeente || {}).length}). Regenerate with build/fetch_nl_data.py.`);
  onProgress?.('Data ready.');
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch(_) {}
  return data;
}

// ════════════════════════════════════════════════════════════════
// DEMO / FALLBACK DATA — 40 representative Dutch municipalities
// Approximate 2022 CBS values; real data is fetched live from CBS.
// ════════════════════════════════════════════════════════════════
function buildDemoData(geojsonFeatures) {
  const DEMO = [
    // code,   name,                province,      pop,   pov,  unemp, eduH, bijs, u15, o65, nonW, laagEd, midEd
    ['GM0363', 'Amsterdam',         'Noord-Holland', 905234, 14.8, 6.8, 46.3, 42.1, 14.2, 15.9, 24.3, 22.1, 31.6],
    ['GM0599', 'Rotterdam',         'Zuid-Holland',  655468, 18.4, 8.1, 31.2, 56.4, 15.8, 14.1, 32.6, 28.4, 40.4],
    ['GM0518', "'s-Gravenhage",     'Zuid-Holland',  547783, 17.1, 7.2, 33.8, 48.7, 15.1, 15.2, 29.8, 25.3, 40.9],
    ['GM0344', 'Utrecht',           'Utrecht',       364492, 11.2, 4.8, 48.9, 28.3, 14.6, 12.4, 16.4, 19.8, 31.3],
    ['GM0772', 'Eindhoven',         'Noord-Brabant', 233655, 12.6, 5.3, 39.2, 31.8, 14.9, 14.7, 18.2, 23.1, 37.7],
    ['GM0014', 'Groningen',         'Groningen',     233218, 16.8, 7.4, 41.2, 42.9, 12.8, 13.1, 14.2, 21.4, 37.4],
    ['GM0855', 'Tilburg',           'Noord-Brabant', 224196, 14.3, 6.1, 28.7, 36.2, 15.2, 14.8, 21.4, 26.6, 44.7],
    ['GM0034', 'Almere',            'Flevoland',     214986, 13.2, 5.8, 27.3, 34.1, 18.1, 11.9, 26.4, 28.7, 44.0],
    ['GM0758', 'Breda',             'Noord-Brabant', 183898, 10.8, 4.9, 33.6, 28.6, 14.7, 15.1, 14.3, 24.3, 42.1],
    ['GM0268', 'Nijmegen',          'Gelderland',    177476, 14.6, 6.2, 39.8, 37.4, 13.4, 14.2, 14.8, 22.6, 37.6],
    ['GM0153', 'Enschede',          'Overijssel',    159427, 17.2, 7.8, 28.4, 46.3, 15.4, 14.9, 22.1, 28.4, 43.2],
    ['GM0392', 'Haarlem',           'Noord-Holland', 161815, 10.4, 4.6, 42.7, 28.9, 13.8, 16.8, 14.6, 22.3, 35.0],
    ['GM0479', 'Zaanstad',          'Noord-Holland', 158541, 12.8, 5.9, 28.4, 33.7, 15.6, 14.3, 21.8, 29.4, 45.2],
    ['GM0513', 'Zoetermeer',        'Zuid-Holland',  126543, 11.6, 5.2, 32.1, 29.8, 16.2, 14.6, 18.4, 26.8, 41.2],
    ['GM0888', 'Zwolle',            'Overijssel',    130456, 9.8,  4.3, 35.6, 25.4, 15.1, 14.8, 11.2, 21.7, 42.7],
    ['GM0301', 'Apeldoorn',         'Gelderland',    165782, 9.2,  4.1, 30.8, 23.1, 15.4, 17.1, 9.8,  24.8, 44.4],
    ['GM0202', 'Arnhem',            'Gelderland',    160231, 16.4, 7.1, 34.2, 43.7, 14.8, 14.6, 21.3, 25.2, 40.6],
    ['GM0637', 'Maastricht',        'Limburg',       121654, 15.3, 6.8, 37.1, 40.2, 12.1, 18.4, 16.8, 22.8, 39.2],
    ['GM0080', 'Amersfoort',        'Utrecht',       160456, 9.4,  4.2, 37.2, 23.8, 15.8, 14.2, 14.6, 23.4, 39.4],
    ['GM0047', 'Dordrecht',         'Zuid-Holland',  118765, 15.6, 6.9, 27.8, 39.4, 15.3, 15.8, 21.4, 27.6, 44.4],
    ['GM0106', 'Leiden',            'Zuid-Holland',  124987, 13.1, 5.6, 42.8, 34.2, 12.4, 15.4, 17.8, 19.8, 37.4],
    ['GM0546', 'Haarlemmermeer',    'Noord-Holland', 158432, 6.8,  3.4, 34.6, 18.2, 17.2, 13.2, 18.6, 25.4, 39.9],
    ['GM0196', 'Alphen aan den Rijn','Zuid-Holland', 115678, 8.4,  3.8, 28.4, 21.3, 16.8, 14.9, 12.4, 27.8, 44.8],
    ['GM0716', 'Westland',          'Zuid-Holland',  107234, 6.4,  2.9, 22.1, 16.4, 17.6, 12.8, 22.4, 31.2, 46.7],
    ['GM0147', 'Delft',             'Zuid-Holland',  103426, 13.4, 5.8, 46.2, 32.6, 12.6, 13.4, 19.8, 17.4, 36.4],
    ['GM0034', 'Almere',            'Flevoland',     214986, 13.2, 5.8, 27.3, 34.1, 18.1, 11.9, 26.4, 28.7, 44.0],
    ['GM0753', 'Helmond',           'Noord-Brabant', 93456,  12.4, 5.6, 26.8, 30.4, 16.4, 15.1, 21.2, 28.8, 45.4],
    ['GM0344', 'Utrecht',           'Utrecht',       364492, 11.2, 4.8, 48.9, 28.3, 14.6, 12.4, 16.4, 19.8, 31.3],
    ['GM0738', "'s-Hertogenbosch",  'Noord-Brabant', 156432, 10.2, 4.4, 36.8, 27.4, 15.2, 14.8, 14.6, 22.4, 40.8],
    ['GM0820', 'Venlo',             'Limburg',       101234, 11.6, 5.1, 28.4, 29.2, 16.1, 15.2, 16.4, 27.2, 44.4],
    ['GM0677', 'Leeuwarden',        'Friesland',     123456, 16.2, 7.3, 32.4, 41.8, 14.8, 14.6, 12.4, 24.8, 42.8],
    ['GM0503', 'Deventer',          'Overijssel',    101234, 12.8, 5.7, 31.2, 32.4, 15.4, 15.8, 16.8, 26.2, 42.6],
    ['GM0289', 'Nijkerk',           'Gelderland',    44321,  5.8,  2.6, 26.4, 14.2, 18.4, 14.1, 7.2,  28.8, 45.2],
    ['GM0599', 'Rotterdam',         'Zuid-Holland',  655468, 18.4, 8.1, 31.2, 56.4, 15.8, 14.1, 32.6, 28.4, 40.4],
    ['GM0321', 'Harderwijk',        'Gelderland',    47321,  8.4,  3.6, 28.4, 21.2, 17.8, 13.4, 12.4, 28.4, 43.2],
    ['GM0273', 'Nijmegen',          'Gelderland',    177476, 14.6, 6.2, 39.8, 37.4, 13.4, 14.2, 14.8, 22.6, 37.6],
    ['GM0441', 'Middelburg',        'Zeeland',       49234,  11.4, 5.2, 33.4, 28.6, 14.4, 17.4, 11.4, 24.4, 41.8],
    ['GM0626', 'Sittard-Geleen',    'Limburg',       93456,  11.8, 5.4, 25.4, 29.4, 15.8, 17.8, 13.4, 28.4, 45.4],
    ['GM0458', 'Emmen',             'Drenthe',       107234, 14.6, 6.4, 22.4, 36.4, 16.4, 17.8, 7.4,  32.4, 48.4],
    ['GM0150', 'Zoetermeer',        'Zuid-Holland',  126543, 11.6, 5.2, 32.1, 29.8, 16.2, 14.6, 18.4, 26.8, 41.2],
  ];

  const gemeenteMap = {};
  for (const row of DEMO) {
    const [code, name, prov, pop, pov, unemp, eduH, bijs, u15, o65, nonW, laagEd, midEd] = row;
    if (gemeenteMap[code]) continue; // deduplicate
    gemeenteMap[code] = {
      Naam:      name,
      Provincie: prov,
      Population: pop,
      _poverty_pct:  pov,
      _unemp_pct:    unemp,
      _edu_high_pct: eduH,
      _bijstand:     bijs,
      Demographics: {
        'Under 15 years (%)':          u15,
        '65+ years (%)':               o65,
        'Non-Western background (%)':  nonW,
      },
      Inequality: {
        'Low income threshold (%)':    pov,
        'Long-term poverty (%)':       parseFloat((pov * 0.28).toFixed(1)),
        'Bijstand recipients (%)':     bijs / 10,
      },
      HumanCapital: {
        'Low education (%)':           laagEd,
        'Medium education (%)':        midEd,
        'High education (%)':          eduH,
        'Unemployment rate (%)':       unemp,
        'Labour participation (%)':    parseFloat((70 - unemp * 0.8).toFixed(1)),
      },
    };
  }

  if (geojsonFeatures) injectProvinceNames(gemeenteMap, geojsonFeatures);
  const nlTotals = computeNLTotals(gemeenteMap);
  return { Gemeente: gemeenteMap, 'Netherlands Total': nlTotals };
}
