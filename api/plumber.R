library(plumber)
library(jsonlite)
library(cluster)

`%||%` <- function(a, b) if (!is.null(a)) a else b

# ── Load & pre-process data at startup ────────────────────────────────────
cat("Loading nl_data.json...\n")
DATA_PATH <- if (file.exists("nl_data.json")) "nl_data.json" else "/app/nl_data.json"
raw       <- fromJSON(DATA_PATH, simplifyDataFrame = FALSE)
NL_DATA   <- raw$Gemeente %||% raw   # unwrap Gemeente wrapper if present
cat(sprintf("Loaded %d municipalities\n", length(NL_DATA)))

DOMAINS <- c("Demographics","Inequality","HumanCapital","Housing","IncomeWealth",
             "Services","WelfareCare","Economy","Environment")

# Flatten one municipality's domain data into a named numeric vector
flatten_vec <- function(gmc_data) {
  vals <- c()
  for (dom in DOMAINS) {
    d <- gmc_data[[dom]]
    if (is.null(d)) next
    for (nm in names(d)) {
      v <- d[[nm]]
      if (is.numeric(v) && length(v) == 1 && !is.na(v))
        vals[paste0(dom, ".", nm)] <- v
    }
  }
  vals
}

ALL_VECS <- lapply(NL_DATA, flatten_vec)
ALL_KEYS <- sort(Reduce(union, lapply(ALL_VECS, names)))

# NL-wide mean and SD per indicator (across all 352 municipalities)
NL_MEANS <- sapply(ALL_KEYS, function(k) {
  v <- sapply(ALL_VECS, function(x) { val <- x[k]; if (is.null(val) || is.na(val)) NA_real_ else val })
  mean(v, na.rm = TRUE)
})
NL_SDS <- sapply(ALL_KEYS, function(k) {
  v <- sapply(ALL_VECS, function(x) { val <- x[k]; if (is.null(val) || is.na(val)) NA_real_ else val })
  sd_val <- sd(v, na.rm = TRUE)
  if (is.na(sd_val) || sd_val == 0) 1 else sd_val
})
cat(sprintf("Pre-computed %d indicators\n", length(ALL_KEYS)))


# ── Dutch policy trait map ─────────────────────────────────────────────────
# Each rule: vars = regex matching indicator key, direction = "high"/"low",
# then trait label, challenge text, and opportunity text for policy makers.

TRAIT_MAP <- list(
  # ── Demographics ──────────────────────────────────────────────────────────
  list(vars = "65\\+|AOW pension",
       direction = "high",
       trait       = "Vergrijzende bevolking",
       challenge   = "Toenemende ouderenzorg- en Wmo-vraag; AOW-druk op gemeentebegroting",
       opportunity = "Zilveren economie; ouderenwelzijn als lokale groeisector"),

  list(vars = "Under 15|Birth rate",
       direction = "high",
       trait       = "Jonge bevolking",
       challenge   = "Capaciteitsdruk op onderwijs, kinderopvang en jeugdzorg",
       opportunity = "Toekomstig arbeidsaanbod; vroeg investeren rendeert op lange termijn"),

  list(vars = "Non.Western background",
       direction = "high",
       trait       = "Diverse bevolkingssamenstelling",
       challenge   = "Integratie, taalvaardigheid en gelijke kansen op arbeidsmarkt",
       opportunity = "Multiculturele economie; diversiteitsbeleid als innovatiekracht"),

  list(vars = "Single.person household",
       direction = "high",
       trait       = "Hoog aandeel eenpersoonshuishoudens",
       challenge   = "Eenzaamheidsrisico; grote vraag naar kleine betaalbare woningen",
       opportunity = "Innovatieve woonvormen; sociale activeringsprojecten"),

  list(vars = "Population density",
       direction = "high",
       trait       = "Hoge bevolkingsdichtheid",
       challenge   = "Ruimtedruk, woningbouwtekort en leefbaarheid in stedelijk gebied",
       opportunity = "Agglomeratievoordelen; OV-aanbod en stedelijke voorzieningen"),

  list(vars = "Population density",
       direction = "low",
       trait       = "Landelijk / dunbevolkt gebied",
       challenge   = "Hoge servicekosten per inwoner; voorzieningen onder druk",
       opportunity = "Ruimte voor energietransitie (wind/zon); agrifood en natuur"),

  # ── Inequality / Poverty ──────────────────────────────────────────────────
  list(vars = "Bijstand recipients",
       direction = "high",
       trait       = "Hoge bijstandsafhankelijkheid",
       challenge   = "Re-integratie naar werk; uitstroom bevorderen via participatiewet",
       opportunity = "Sociale werkgelegenheidsprojecten; beschut werk uitbreiden"),

  list(vars = "Low income threshold|social minimum|Near.poverty",
       direction = "high",
       trait       = "Hoog armoederisico",
       challenge   = "Schuldhulpverlening; bestaanszekerheid van kwetsbare huishoudens",
       opportunity = "Vroeg-signalering armoede; voorkomen van generatiearmoede"),

  list(vars = "Top.20.*income share",
       direction = "high",
       trait       = "Inkomensongelijkheid",
       challenge   = "Sociale cohesie en risico op ruimtelijke segregatie",
       opportunity = "Herverdelingsbeleid; gemengde wijkontwikkeling"),

  list(vars = "Bottom.40.*income share",
       direction = "low",
       trait       = "Zwakke positie laagste inkomens",
       challenge   = "Kansengelijkheid en sociale mobiliteit verbeteren",
       opportunity = "Gerichte inkomensondersteuning; sociale stijgingsprogramma's"),

  # ── Human Capital / Labour ────────────────────────────────────────────────
  list(vars = "High education",
       direction = "low",
       trait       = "Laag opleidingsniveau",
       challenge   = "Vacaturevervulling in kenniseconomie; braindrain risico",
       opportunity = "Investering in MBO/HBO; leven-lang-leren en omscholing"),

  list(vars = "High education",
       direction = "high",
       trait       = "Hoog opgeleide bevolking",
       challenge   = "Betaalbaarheid woningmarkt voor lage en middeninkomens",
       opportunity = "Kenniseconomie en innovatievermogen; startups aantrekken"),

  list(vars = "Labour participation",
       direction = "low",
       trait       = "Lage arbeidsparticipatie",
       challenge   = "Activering niet-werkenden; hoge druk op sociale uitkeringen",
       opportunity = "Re-integratietrajecten; deeltijdwerken en flexibele inzet"),

  list(vars = "Unemployment proxy",
       direction = "high",
       trait       = "Hoge werkloosheid",
       challenge   = "Economische achterblijver; sociale kosten langdurige werkloosheid",
       opportunity = "Regionale arbeidsmarktcoöperaties; werkgelegenheidsbeleid"),

  list(vars = "Self.employed",
       direction = "high",
       trait       = "Hoog aandeel zelfstandigen",
       challenge   = "Inkomensonzekerheid ZZP'ers; pensioenkloof",
       opportunity = "Ondernemersvriendelijk klimaat; innovatie-ecosysteem versterken"),

  # ── Housing ───────────────────────────────────────────────────────────────
  list(vars = "Social housing",
       direction = "high",
       trait       = "Hoge concentratie sociale woningbouw",
       challenge   = "Segregatierisico; beperkte doorstroming op woningmarkt",
       opportunity = "Herstructureringsopgave; mixed-income wijkontwikkeling"),

  list(vars = "Owner.occupied",
       direction = "high",
       trait       = "Hoog eigenwoningbezit",
       challenge   = "Beperkt huurwoningaanbod voor starters en lagere inkomens",
       opportunity = "Hoge investeringsbereidheid bewoners; sterke buurtidentiteit"),

  list(vars = "WOZ value",
       direction = "low",
       trait       = "Lage woningwaarden",
       challenge   = "Beperkte investeringsaantrekkelijkheid; economische achterstand",
       opportunity = "Kansen voor betaalbare woningbouw en herbestemming"),

  list(vars = "WOZ value",
       direction = "high",
       trait       = "Hoge woningwaarden",
       challenge   = "Betaalbaarheid voor starters en middeninkomens onder druk",
       opportunity = "Hoge investeringscapaciteit; aantrekkelijk vestigingsklimaat"),

  list(vars = "Unoccupied|leegstand",
       direction = "high",
       trait       = "Hoge leegstand",
       challenge   = "Verloedering en krimpproblematiek",
       opportunity = "Herbestemming leegstand voor wonen, zorg of creatieve sector"),

  # ── Welfare & Care ────────────────────────────────────────────────────────
  list(vars = "Wmo care|Wmo client",
       direction = "high",
       trait       = "Hoge Wmo-zorgvraag",
       challenge   = "Wmo-budgetdruk; toenemende complexiteit van zorgvragen",
       opportunity = "Preventieve zorg; welzijn-op-recept en informele zorgnetwerken"),

  list(vars = "Disability benefit",
       direction = "high",
       trait       = "Hoog arbeidsongeschiktheidspercentage",
       challenge   = "WIA/WGA-instroom beperken; re-integratie en beschut werk",
       opportunity = "Inclusieve arbeidsmarkt; werkplaatsen beschut werk uitbreiden"),

  list(vars = "Youth welfare",
       direction = "high",
       trait       = "Hoog jeugdzorggebruik",
       challenge   = "Overbelasting jeugdzorgstelsel; vroeginterventie urgent",
       opportunity = "Preventief jeugdbeleid; gezinsondersteuning en buurtteams"),

  # ── Economy ───────────────────────────────────────────────────────────────
  list(vars = "Business density",
       direction = "low",
       trait       = "Lage bedrijvigheid",
       challenge   = "Werkgelegenheidsgebrek; economische kwetsbaarheid",
       opportunity = "Vestigingsklimaat verbeteren; bedrijventerreinontwikkeling"),

  list(vars = "Business density",
       direction = "high",
       trait       = "Hoge bedrijvigheid",
       challenge   = "Ruimtedruk; verdringing woonfunctie en netcongestie",
       opportunity = "Economische motor van de regio; innovatiehub potentieel"),

  list(vars = "EV.*alternative|alternative.*fuel",
       direction = "high",
       trait       = "Hoog aandeel elektrisch rijden",
       challenge   = "Laadinfrastructuur uitbreiden; netcapaciteit versterken",
       opportunity = "Voortrekkersrol duurzame mobiliteit; EV-ecosysteem"),

  list(vars = "Cars per household",
       direction = "high",
       trait       = "Hoge auto-afhankelijkheid",
       challenge   = "Mobiliteitsarmoede bij niet-autobezitters; CO₂-uitstoot",
       opportunity = "OV-verbeterprojecten; fiets- en deelmobiliteitsinfrastructuur"),

  # ── Environment / Energy ──────────────────────────────────────────────────
  list(vars = "gas|stadsverwarming",
       direction = "high",
       trait       = "Hoge aardgas- of warmteafhankelijkheid",
       challenge   = "Grote warmtetransitie-opgave; kwetsbaar voor energieprijzen",
       opportunity = "Warmtenet en all-electric als transitieroute; isolatiesubsidies"),

  list(vars = "electricity use",
       direction = "high",
       trait       = "Hoog elektriciteitsverbruik",
       challenge   = "Netcongestie; verduurzaming woningvoorraad noodzakelijk",
       opportunity = "Zonne-energie en energiecoöperaties; lokale energieopwekking"),

  list(vars = "Water share",
       direction = "high",
       trait       = "Waterrijke gemeente",
       challenge   = "Waterveiligheid, dijkonderhoud en klimaatadaptatie",
       opportunity = "Blauwe economie; recreatie, toerisme en waterstedenbouw"),

  list(vars = "Land area",
       direction = "high",
       trait       = "Grote landoppervlakte",
       challenge   = "Hoge servicekosten per km²; bereikbaarheid van voorzieningen",
       opportunity = "Ruimte voor wind- en zonne-energie; natuur en landbouwtransitie")
)


# ── Helpers ────────────────────────────────────────────────────────────────

# Silhouette-based automatic K selection
auto_k <- function(scaled_mat, k_max = 6) {
  n <- nrow(scaled_mat)
  k_max <- min(k_max, n - 1, 8)
  if (k_max < 2) return(2)

  best   <- 2
  best_s <- -Inf
  for (k in 2:k_max) {
    set.seed(42)
    km <- tryCatch(
      kmeans(scaled_mat, centers = k, nstart = 10, iter.max = 100),
      error = function(e) NULL
    )
    if (is.null(km) || length(unique(km$cluster)) < k) next
    s <- mean(silhouette(km$cluster, dist(scaled_mat))[, 3])
    if (s > best_s) { best_s <- s; best <- k }
  }
  best
}

# Apply trait map: match indicator names to policy labels
interpret_cluster <- function(z_profile, threshold = 1.0) {
  traits <- challenges <- opportunities <- c()
  for (rule in TRAIT_MAP) {
    pat <- rule$vars
    if (rule$direction == "high") {
      matches <- z_profile[grepl(pat, names(z_profile), ignore.case = TRUE) & z_profile >= threshold]
    } else {
      matches <- z_profile[grepl(pat, names(z_profile), ignore.case = TRUE) & z_profile <= -threshold]
    }
    if (length(matches) > 0) {
      traits       <- c(traits,       rule$trait)
      challenges   <- c(challenges,   rule$challenge)
      opportunities <- c(opportunities, rule$opportunity)
    }
  }
  list(
    traits        = unique(head(traits,        4)),
    challenges    = unique(head(challenges,    4)),
    opportunities = unique(head(opportunities, 4))
  )
}

# Short human-readable label from dotted key
short_label <- function(nm) sub("^[^.]+\\.", "", nm)


# ── CORS filter ───────────────────────────────────────────────────────────
#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req$REQUEST_METHOD == "OPTIONS") { res$status <- 200; return(list()) }
  plumber::forward()
}


# ── Endpoints ─────────────────────────────────────────────────────────────

#* Health check — ping this on page load to warm the Space
#* @get /health
function() {
  list(status = "ok", municipalities = length(NL_DATA), indicators = length(ALL_KEYS))
}

#* Typology: cluster selected municipalities and interpret each cluster
#* @param ids Comma-separated GM codes, e.g. GM0363,GM0034,GM0344
#* @param k Number of clusters or "auto" for silhouette selection (default: auto)
#* @get /typology
function(ids = "", k = "auto") {
  if (!nzchar(ids)) return(list(error = "No municipality IDs provided"))

  gmc_list <- unique(trimws(strsplit(ids, ",")[[1]]))
  gmc_list <- gmc_list[gmc_list %in% names(NL_DATA)]

  if (length(gmc_list) < 3)
    return(list(error = "Select at least 3 valid municipalities (GM codes)"))

  # ── Build feature matrix for selected municipalities ─────────────────────
  sel_vecs <- lapply(gmc_list, function(gmc) flatten_vec(NL_DATA[[gmc]]))
  names(sel_vecs) <- gmc_list

  common_keys <- Reduce(intersect, lapply(sel_vecs, names))
  # Drop service-distance metrics with very skewed distributions
  common_keys <- common_keys[!grepl("Degree.of.urban|km to", common_keys, ignore.case = TRUE)]

  mat <- do.call(rbind, lapply(sel_vecs, function(v) v[common_keys]))
  rownames(mat) <- gmc_list

  # Impute column NAs with NL mean
  for (j in seq_len(ncol(mat))) {
    na_idx <- is.na(mat[, j])
    if (any(na_idx)) mat[na_idx, j] <- NL_MEANS[common_keys[j]]
  }

  # Z-score using NL-wide means & SDs (so scores are vs Netherlands, not vs this group)
  scaled_mat <- sweep(mat, 2, NL_MEANS[common_keys], "-")
  scaled_mat <- sweep(scaled_mat, 2, NL_SDS[common_keys], "/")
  # Guard for any remaining NA/Inf
  scaled_mat[!is.finite(scaled_mat)] <- 0

  # ── Select K ────────────────────────────────────────────────────────────
  k_use <- if (k == "auto") {
    auto_k(scaled_mat)
  } else {
    max(2, min(as.integer(k), nrow(scaled_mat) - 1))
  }

  set.seed(42)
  km <- tryCatch(
    kmeans(scaled_mat, centers = k_use, nstart = 20, iter.max = 200),
    error = function(e) return(NULL)
  )
  if (is.null(km)) return(list(error = "Clustering failed — try fewer clusters or more municipalities"))

  # ── Per-cluster summary ──────────────────────────────────────────────────
  summary_list <- list()

  for (ci in seq_len(k_use)) {
    members <- gmc_list[km$cluster == ci]
    if (!length(members)) next

    # Centroid in z-score space = how this cluster sits vs NL average
    z_centroid <- km$centers[ci, ]
    names(z_centroid) <- common_keys

    # Top differentiators: highest absolute z-scores
    top_pos <- sort(z_centroid[z_centroid >  0.7], decreasing = TRUE)[1:8]
    top_neg <- sort(z_centroid[z_centroid < -0.7], decreasing = FALSE)[1:8]
    top_pos <- top_pos[!is.na(top_pos)]
    top_neg <- top_neg[!is.na(top_neg)]

    drivers <- c(
      lapply(names(top_pos), function(nm)
        list(variable = short_label(nm), full_key = nm,
             z = round(top_pos[[nm]], 2), direction = "above")),
      lapply(names(top_neg), function(nm)
        list(variable = short_label(nm), full_key = nm,
             z = round(top_neg[[nm]], 2), direction = "below"))
    )

    interp <- interpret_cluster(z_centroid)

    # Raw cluster mean for each indicator (unscaled, for display)
    cl_raw  <- colMeans(mat[members, , drop = FALSE], na.rm = TRUE)
    nl_raw  <- NL_MEANS[common_keys]

    summary_list[[as.character(ci)]] <- list(
      cluster       = ci,
      count         = length(members),
      zones         = members,
      names         = sapply(members, function(gmc) NL_DATA[[gmc]]$Naam %||% gmc),
      traits        = interp$traits,
      challenges    = interp$challenges,
      opportunities = interp$opportunities,
      drivers       = drivers,
      cluster_means = as.list(round(cl_raw, 2)),
      nl_means      = as.list(round(nl_raw, 2))
    )
  }

  list(
    summary      = summary_list,
    k_selected   = k_use,
    n_indicators = ncol(mat),
    n_zones      = length(gmc_list)
  )
}

