"""
NLStat CBS Data Pipeline
========================
Fetches gemeente-level socioeconomic indicators from CBS StatLine OData3,
computes derived percentages, and saves to ../data/nl_data.json.

CBS OData4 (opendata.cbs.nl/OData4) was decommissioned and now redirects to HTML.
This script uses the still-working OData3 API instead.

Usage:
    pip install requests
    python build/fetch_nl_data.py
"""

import json
import math
import os
import sys
import time
import requests

CBS_BASE   = "https://opendata.cbs.nl/ODataFeed/odata"
DATASET_ID = "85039NED"
_HERE      = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(_HERE, "..", "data")
GEOJSON    = os.path.join(DATA_DIR, "gemeenten.geojson")
OUT_FILE   = os.path.join(DATA_DIR, "nl_data.json")

# OData3 columns — all "aantal" unless noted with a unit
# Education columns are absolute counts; we derive percentages below.
CBS_VARS = [
    # ── Demographics
    "AantalInwoners_5",               # population (absolute)
    "Mannen_6",                       # men (absolute)
    "Vrouwen_7",                      # women (absolute)
    "k_0Tot15Jaar_8",                 # under 15 (absolute)
    "k_15Tot25Jaar_9",                # 15-24 (absolute)
    "k_25Tot45Jaar_10",               # 25-44 (absolute)
    "k_45Tot65Jaar_11",               # 45-64 (absolute)
    "k_65JaarOfOuder_12",             # 65+ (absolute)
    "Omgevingsadressendichtheid_117",  # addr density (per km²) - direct
    "NietWestersTotaal_18",           # non-western background (absolute)
    "WestersTotaal_17",               # western background (absolute)
    "GeboorteRelatief_25",            # birth rate (per 1000) - direct
    "SterfteRelatief_27",             # mortality rate (per 1000) - direct
    "Ongehuwd_13",                    # unmarried (absolute)
    "Gehuwd_14",                      # married (absolute)
    "Gescheiden_15",                  # divorced (absolute)
    "Verweduwd_16",                   # widowed (absolute)
    "GemiddeldeHuishoudensgrootte_32",# avg household size - direct
    "Eenpersoonshuishoudens_29",      # single-person households (absolute)
    "HuishoudensTotaal_28",           # total households (absolute)
    # ── Inequality / Social
    "HuishoudensMetEenLaagInkomen_78",    # low income households (%) - direct
    "HuishOnderOfRondSociaalMinimum_79",  # at-or-below social minimum (%) - direct
    "HuishoudensTot110VanSociaalMinimum_80", # up to 110% social minimum (%) - direct
    "HuishoudensTot120VanSociaalMinimum_81", # up to 120% social minimum (%) - direct
    "PersonenPerSoortUitkeringBijstand_83",  # bijstand (absolute)
    "PersonenPerSoortUitkeringWW_85",        # WW unemployment benefit (absolute)
    "PercentageJongerenMetJeugdzorg_88",     # youth welfare (%) - direct
    "k_40PersonenMetLaagsteInkomen_73",      # bottom-40% income share (%) - direct
    "k_20PersonenMetHoogsteInkomen_74",      # top-20% income share (%) - direct
    # ── Human Capital
    "OpleidingsniveauLaag_64",        # low education (absolute)
    "OpleidingsniveauMiddelbaar_65",  # medium education (absolute)
    "OpleidingsniveauHoog_66",        # high education (absolute)
    "Nettoarbeidsparticipatie_67",    # net labour participation (%) - direct
    "PercentageWerknemers_68",        # employees % of labour force - direct
    "PercentageZelfstandigen_69",     # self-employed % of labour force - direct
    # ── Housing
    "GemiddeldeWOZWaardeVanWoningen_35",  # avg WOZ property value (x1000 EUR) - direct
    "Koopwoningen_40",                    # owner-occupied homes (%) - direct
    "HuurwoningenTotaal_41",              # rental homes (%) - direct
    "InBezitWoningcorporatie_42",         # social housing / corp. (%) - direct
    "BouwjaarVoor2000_45",               # pre-2000 building stock (%) - direct
    "BouwjaarVanaf2000_46",              # post-2000 building stock (%) - direct
    "PercentageEengezinswoning_36",      # single-family homes (%) - direct
    "PercentageMeergezinswoning_37",     # multi-family homes (%) - direct
    "PercentageOnbewoond_39",            # vacancy rate (%) - direct
    "Woningvoorraad_34",                 # total housing stock (absolute)
    # ── Income & Wealth
    "GemiddeldInkomenPerInwoner_72",           # avg income per inhabitant (x1000 EUR) - direct
    "GemiddeldInkomenPerInkomensontvanger_71", # avg income per earner (x1000 EUR) - direct
    "MediaanVermogenVanParticuliereHuish_82",  # median household wealth (x1000 EUR) - direct
    "GemGestandaardiseerdInkomenVanHuish_75",  # avg standardised household income (x1000 EUR) - direct
    # ── Services Accessibility
    "AfstandTotHuisartsenpraktijk_106", # distance to GP (km) - direct
    "AfstandTotGroteSupermarkt_107",    # distance to supermarket (km) - direct
    "AfstandTotKinderdagverblijf_108",  # distance to daycare (km) - direct
    "AfstandTotSchool_109",             # distance to school (km) - direct
    "ScholenBinnen3Km_110",             # schools within 3km (count) - direct
    "MateVanStedelijkheid_116",         # degree of urbanisation (1-5) - direct
    # ── Welfare & Care (new)
    "PersonenPerSoortUitkeringAO_84",   # disability/AO benefit recipients (absolute)
    "PersonenPerSoortUitkeringAOW_86",  # AOW pension recipients (absolute)
    "WmoClienten_89",                   # Wmo care clients (absolute)
    "WmoClientenRelatief_90",           # Wmo care clients per 1000 - direct
    # ── Economy & Business (new)
    "BedrijfsvestigingenTotaal_91",     # total businesses (absolute)
    "ALandbouwBosbouwEnVisserij_92",    # agriculture (absolute)
    "BFNijverheidEnEnergie_93",         # industry/energy (absolute)
    "GIHandelEnHoreca_94",              # trade/hospitality (absolute)
    "HJVervoerInformatieEnCommunicatie_95", # transport/ICT (absolute)
    "KLFinancieleDienstenOnroerendGoed_96", # finance/real estate (absolute)
    "MNZakelijkeDienstverlening_97",    # business services (absolute)
    "OQOverheidOnderwijsEnZorg_98",     # gov/edu/health (absolute)
    "RUCultuurRecreatieOverigeDiensten_99", # culture/recreation (absolute)
    "PersonenautoSTotaal_100",          # total personal cars (absolute)
    "PersonenautoSBrandstofBenzine_101",# petrol cars (absolute)
    "PersonenautoSOverigeBrandstof_102",# other fuel cars inc. EV (absolute)
    "PersonenautoSPerHuishouden_103",   # cars per household - direct
    # ── Energy & Environment (new)
    "GemiddeldeElektriciteitsleveringTotaal_47", # avg electricity consumption (kWh) - direct
    "GemiddeldAardgasverbruikTotaal_55",          # avg gas consumption (m³) - direct
    "PercentageWoningenMetStadsverwarming_63",    # district heating (%) - direct
    "OppervlakteLand_112",              # land area (km²) - direct
    "OppervlakteWater_113",             # water area (km²) - direct
    "OppervlakteTotaal_111",            # total area (km²) - direct
]


def fetch_all_observations():
    select = ",".join(["WijkenEnBuurten", "SoortRegio_2"] + CBS_VARS)
    url = (
        f"{CBS_BASE}/{DATASET_ID}/TypedDataSet"
        f"?$filter=startswith(WijkenEnBuurten,'GM')"
        f"&$select={select}&$top=500&$format=json"
    )
    all_rows = []
    page = 0
    while url:
        page += 1
        print(f"  Fetching page {page} …")
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        rows = data.get("value", [])
        # Keep only gemeente rows (SoortRegio_2 == 'Gemeente  ')
        for r in rows:
            if str(r.get("SoortRegio_2", "")).strip() == "Gemeente":
                all_rows.append(r)
        url = data.get("odata.nextLink") or data.get("@odata.nextLink")
        if url:
            time.sleep(0.2)
    print(f"  Total gemeente rows: {len(all_rows)}")
    return all_rows


def safe_float(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (ValueError, TypeError):
        return None


def derive_pct(num, denom):
    """Return num/denom*100 rounded to 2dp, or None if invalid."""
    n, d = safe_float(num), safe_float(denom)
    if n is None or not d:
        return None
    return round(n / d * 100, 2)


def reshape_rows(rows):
    gemeenten = {}
    for row in rows:
        gmc = row.get("WijkenEnBuurten", "").strip()
        if not gmc.startswith("GM"):
            continue

        pop       = safe_float(row.get("AantalInwoners_5"))
        men       = safe_float(row.get("Mannen_6"))
        women     = safe_float(row.get("Vrouwen_7"))
        u15       = safe_float(row.get("k_0Tot15Jaar_8"))
        a15_24    = safe_float(row.get("k_15Tot25Jaar_9"))
        a25_44    = safe_float(row.get("k_25Tot45Jaar_10"))
        a45_64    = safe_float(row.get("k_45Tot65Jaar_11"))
        o65       = safe_float(row.get("k_65JaarOfOuder_12"))
        density   = safe_float(row.get("Omgevingsadressendichtheid_117"))
        non_west  = safe_float(row.get("NietWestersTotaal_18"))
        west_bg   = safe_float(row.get("WestersTotaal_17"))
        birth_rt  = safe_float(row.get("GeboorteRelatief_25"))
        death_rt  = safe_float(row.get("SterfteRelatief_27"))
        unmarried = safe_float(row.get("Ongehuwd_13"))
        married   = safe_float(row.get("Gehuwd_14"))
        divorced  = safe_float(row.get("Gescheiden_15"))
        widowed   = safe_float(row.get("Verweduwd_16"))
        hh_size   = safe_float(row.get("GemiddeldeHuishoudensgrootte_32"))
        single_hh = safe_float(row.get("Eenpersoonshuishoudens_29"))
        hh_total  = safe_float(row.get("HuishoudensTotaal_28"))
        poverty   = safe_float(row.get("HuishoudensMetEenLaagInkomen_78"))
        soc_min   = safe_float(row.get("HuishOnderOfRondSociaalMinimum_79"))
        near_pov110 = safe_float(row.get("HuishoudensTot110VanSociaalMinimum_80"))
        near_pov120 = safe_float(row.get("HuishoudensTot120VanSociaalMinimum_81"))
        bijstand  = safe_float(row.get("PersonenPerSoortUitkeringBijstand_83"))
        ww        = safe_float(row.get("PersonenPerSoortUitkeringWW_85"))
        youth_wlf = safe_float(row.get("PercentageJongerenMetJeugdzorg_88"))
        inc_bot40 = safe_float(row.get("k_40PersonenMetLaagsteInkomen_73"))
        inc_top20 = safe_float(row.get("k_20PersonenMetHoogsteInkomen_74"))
        edu_low   = safe_float(row.get("OpleidingsniveauLaag_64"))
        edu_mid   = safe_float(row.get("OpleidingsniveauMiddelbaar_65"))
        edu_high  = safe_float(row.get("OpleidingsniveauHoog_66"))
        labour    = safe_float(row.get("Nettoarbeidsparticipatie_67"))
        emp_pct   = safe_float(row.get("PercentageWerknemers_68"))
        self_emp  = safe_float(row.get("PercentageZelfstandigen_69"))
        woz       = safe_float(row.get("GemiddeldeWOZWaardeVanWoningen_35"))
        owner_occ = safe_float(row.get("Koopwoningen_40"))
        rental    = safe_float(row.get("HuurwoningenTotaal_41"))
        social_hh = safe_float(row.get("InBezitWoningcorporatie_42"))
        pre2000   = safe_float(row.get("BouwjaarVoor2000_45"))
        post2000  = safe_float(row.get("BouwjaarVanaf2000_46"))
        sing_fam  = safe_float(row.get("PercentageEengezinswoning_36"))
        mult_fam  = safe_float(row.get("PercentageMeergezinswoning_37"))
        vacancy   = safe_float(row.get("PercentageOnbewoond_39"))
        housing_stock = safe_float(row.get("Woningvoorraad_34"))
        inc_inhab = safe_float(row.get("GemiddeldInkomenPerInwoner_72"))
        inc_earn  = safe_float(row.get("GemiddeldInkomenPerInkomensontvanger_71"))
        wealth    = safe_float(row.get("MediaanVermogenVanParticuliereHuish_82"))
        inc_hh    = safe_float(row.get("GemGestandaardiseerdInkomenVanHuish_75"))
        d_gp      = safe_float(row.get("AfstandTotHuisartsenpraktijk_106"))
        d_super   = safe_float(row.get("AfstandTotGroteSupermarkt_107"))
        d_day     = safe_float(row.get("AfstandTotKinderdagverblijf_108"))
        d_school  = safe_float(row.get("AfstandTotSchool_109"))
        schools3  = safe_float(row.get("ScholenBinnen3Km_110"))
        urban     = safe_float(row.get("MateVanStedelijkheid_116"))
        # Welfare & Care
        ao_ben    = safe_float(row.get("PersonenPerSoortUitkeringAO_84"))
        aow_pen   = safe_float(row.get("PersonenPerSoortUitkeringAOW_86"))
        wmo_abs   = safe_float(row.get("WmoClienten_89"))
        wmo_rel   = safe_float(row.get("WmoClientenRelatief_90"))
        # Economy & Business
        biz_total = safe_float(row.get("BedrijfsvestigingenTotaal_91"))
        biz_agri  = safe_float(row.get("ALandbouwBosbouwEnVisserij_92"))
        biz_ind   = safe_float(row.get("BFNijverheidEnEnergie_93"))
        biz_trade = safe_float(row.get("GIHandelEnHoreca_94"))
        biz_trans = safe_float(row.get("HJVervoerInformatieEnCommunicatie_95"))
        biz_fin   = safe_float(row.get("KLFinancieleDienstenOnroerendGoed_96"))
        biz_bsvc  = safe_float(row.get("MNZakelijkeDienstverlening_97"))
        biz_pub   = safe_float(row.get("OQOverheidOnderwijsEnZorg_98"))
        biz_cult  = safe_float(row.get("RUCultuurRecreatieOverigeDiensten_99"))
        cars_tot  = safe_float(row.get("PersonenautoSTotaal_100"))
        cars_benz = safe_float(row.get("PersonenautoSBrandstofBenzine_101"))
        cars_alt  = safe_float(row.get("PersonenautoSOverigeBrandstof_102"))
        cars_phh  = safe_float(row.get("PersonenautoSPerHuishouden_103"))
        # Energy & Environment
        elec_cons = safe_float(row.get("GemiddeldeElektriciteitsleveringTotaal_47"))
        gas_cons  = safe_float(row.get("GemiddeldAardgasverbruikTotaal_55"))
        dist_heat = safe_float(row.get("PercentageWoningenMetStadsverwarming_63"))
        area_land_ha = safe_float(row.get("OppervlakteLand_112"))
        area_water_ha= safe_float(row.get("OppervlakteWater_113"))
        area_tot_ha  = safe_float(row.get("OppervlakteTotaal_111"))
        # CBS reports area in whole hectares; convert to km² (1 km² = 100 ha)
        area_land = round(area_land_ha / 100, 2) if area_land_ha else None
        area_water= round(area_water_ha / 100, 2) if area_water_ha else None
        area_tot  = area_tot_ha  # used only for ratio

        edu_total = (edu_low or 0) + (edu_mid or 0) + (edu_high or 0)

        # Derived percentages
        u15_pct         = derive_pct(u15, pop)
        a15_24_pct      = derive_pct(a15_24, pop)
        a25_44_pct      = derive_pct(a25_44, pop)
        a45_64_pct      = derive_pct(a45_64, pop)
        o65_pct         = derive_pct(o65, pop)
        male_pct        = derive_pct(men, pop)
        female_pct      = derive_pct(women, pop)
        non_west_pct    = derive_pct(non_west, pop)
        west_bg_pct     = derive_pct(west_bg, pop)
        unmarried_pct   = derive_pct(unmarried, pop)
        married_pct     = derive_pct(married, pop)
        divorced_pct    = derive_pct(divorced, pop)
        widowed_pct     = derive_pct(widowed, pop)
        single_hh_pct   = derive_pct(single_hh, hh_total)
        edu_high_pct    = round(edu_high / edu_total * 100, 2) if edu_high and edu_total else None
        edu_low_pct     = round(edu_low  / edu_total * 100, 2) if edu_low  and edu_total else None
        edu_mid_pct     = round(edu_mid  / edu_total * 100, 2) if edu_mid  and edu_total else None
        bijstand_per1k  = round(bijstand / pop * 1000, 2) if bijstand and pop else None
        unemp_pct       = derive_pct(ww, pop)
        # Welfare derived
        ao_per1k        = round(ao_ben / pop * 1000, 2) if ao_ben and pop else None
        aow_per1k       = round(aow_pen / pop * 1000, 2) if aow_pen and pop else None
        # Economy derived
        biz_density     = round(biz_total / pop * 1000, 2) if biz_total and pop else None
        biz_agri_pct    = round(biz_agri  / biz_total * 100, 2) if biz_agri  and biz_total else None
        biz_ind_pct     = round(biz_ind   / biz_total * 100, 2) if biz_ind   and biz_total else None
        biz_trade_pct   = round(biz_trade / biz_total * 100, 2) if biz_trade and biz_total else None
        biz_trans_pct   = round(biz_trans / biz_total * 100, 2) if biz_trans and biz_total else None
        biz_fin_pct     = round(biz_fin   / biz_total * 100, 2) if biz_fin   and biz_total else None
        biz_bsvc_pct    = round(biz_bsvc  / biz_total * 100, 2) if biz_bsvc  and biz_total else None
        biz_pub_pct     = round(biz_pub   / biz_total * 100, 2) if biz_pub   and biz_total else None
        biz_cult_pct    = round(biz_cult  / biz_total * 100, 2) if biz_cult  and biz_total else None
        ev_pct          = round(cars_alt  / cars_tot * 100, 2) if cars_alt and cars_tot else None
        # Environment derived
        water_pct       = round(area_water_ha / area_tot_ha * 100, 2) if area_water_ha and area_tot_ha else None

        gemeenten[gmc] = {
            "Naam":      "",
            "Provincie": "",
            "Population": int(pop) if pop else 0,
            # choropleth map keys
            "_poverty_pct":  poverty,
            "_unemp_pct":    unemp_pct,
            "_edu_high_pct": edu_high_pct,
            "_bijstand":     bijstand_per1k,
            "_avg_income":   inc_inhab,
            "_woz_value":    woz,
            "_social_hh":    social_hh,
            "_wmo_per1k":    wmo_rel,
            "_biz_density":  biz_density,
            "_ao_per1k":     ao_per1k,
            "Demographics": {k: v for k, v in [
                ("Under 15 years (%)",           u15_pct),
                ("15-24 years (%)",              a15_24_pct),
                ("25-44 years (%)",              a25_44_pct),
                ("45-64 years (%)",              a45_64_pct),
                ("65+ years (%)",                o65_pct),
                ("Male (%)",                     male_pct),
                ("Female (%)",                   female_pct),
                ("Non-Western background (%)",   non_west_pct),
                ("Western background (%)",       west_bg_pct),
                ("Population density (per km²)", density),
                ("Birth rate (per 1000)",         birth_rt),
                ("Mortality rate (per 1000)",     death_rt),
                ("Unmarried (%)",                unmarried_pct),
                ("Married (%)",                  married_pct),
                ("Divorced (%)",                 divorced_pct),
                ("Widowed (%)",                  widowed_pct),
                ("Avg household size",           hh_size),
                ("Single-person households (%)", single_hh_pct),
            ] if v is not None},
            "Inequality": {k: v for k, v in [
                ("Low income threshold (%)",        poverty),
                ("At-or-below social minimum (%)",  soc_min),
                ("Near-poverty 110% (%)",           near_pov110),
                ("Near-poverty 120% (%)",           near_pov120),
                ("Bijstand recipients (per 1k)",    bijstand_per1k),
                ("Youth welfare (%)",               youth_wlf),
                ("Bottom-40% income share (%)",     inc_bot40),
                ("Top-20% income share (%)",        inc_top20),
            ] if v is not None},
            "HumanCapital": {k: v for k, v in [
                ("High education (%)",             edu_high_pct),
                ("Medium education (%)",           edu_mid_pct),
                ("Low education (%)",              edu_low_pct),
                ("Labour participation (%)",       labour),
                ("Employees (% of workforce)",     emp_pct),
                ("Self-employed (% of workforce)", self_emp),
                ("Unemployment proxy (%)",         unemp_pct),
            ] if v is not None},
            "Housing": {k: v for k, v in [
                ("Avg WOZ value (x€1k)",           woz),
                ("Owner-occupied (%)",             owner_occ),
                ("Rental homes (%)",               rental),
                ("Social housing (%)",             social_hh),
                ("Single-family homes (%)",        sing_fam),
                ("Multi-family homes (%)",         mult_fam),
                ("Vacancy rate (%)",               vacancy),
                ("Pre-2000 stock (%)",             pre2000),
                ("Post-2000 stock (%)",            post2000),
                ("Avg household size",             hh_size),
            ] if v is not None},
            "IncomeWealth": {k: v for k, v in [
                ("Avg income per inhabitant (x€1k)", inc_inhab),
                ("Avg income per earner (x€1k)",     inc_earn),
                ("Avg household income (x€1k)",      inc_hh),
                ("Median household wealth (x€1k)",   wealth),
                ("Bottom-40% income share (%)",      inc_bot40),
                ("Top-20% income share (%)",         inc_top20),
            ] if v is not None},
            "Services": {k: v for k, v in [
                ("Distance to GP (km)",            d_gp),
                ("Distance to supermarket (km)",   d_super),
                ("Distance to school (km)",        d_school),
                ("Distance to daycare (km)",       d_day),
                ("Schools within 3km",             schools3),
                ("Degree of urbanisation (1–5)",   urban),
            ] if v is not None},
            "WelfareCare": {k: v for k, v in [
                ("Wmo care clients (per 1k)",      wmo_rel),
                ("Disability benefit (per 1k)",    ao_per1k),
                ("AOW pension recipients (per 1k)", aow_per1k),
                ("Bijstand recipients (per 1k)",   bijstand_per1k),
                ("Youth welfare (%)",              youth_wlf),
                ("Near-poverty 110% (%)",          near_pov110),
                ("Near-poverty 120% (%)",          near_pov120),
            ] if v is not None},
            "Economy": {k: v for k, v in [
                ("Business density (per 1k pop)",  biz_density),
                ("Agriculture sector (%)",         biz_agri_pct),
                ("Industry & energy sector (%)",   biz_ind_pct),
                ("Trade & hospitality sector (%)", biz_trade_pct),
                ("Transport & ICT sector (%)",     biz_trans_pct),
                ("Finance & real estate sector (%)", biz_fin_pct),
                ("Business services sector (%)",   biz_bsvc_pct),
                ("Public/edu/health sector (%)",   biz_pub_pct),
                ("Culture & recreation sector (%)", biz_cult_pct),
                ("Cars per household",             cars_phh),
                ("EV & alternative fuel cars (%)", ev_pct),
            ] if v is not None},
            "Environment": {k: v for k, v in [
                ("Avg electricity use (kWh/yr)",   elec_cons),
                ("Avg gas use (m³/yr)",            gas_cons),
                ("District heating (%)",           dist_heat),
                ("Land area (km²)",                area_land),
                ("Water area (km²)",               area_water),
                ("Water share (%)",                water_pct),
            ] if v is not None},
        }
    return gemeenten


# Province code → name normalised to match NL_PROVINCES in shared.js
PROV_NORM = {
    "PV20": "Groningen",
    "PV21": "Friesland",    # CBS uses "Fryslân"; normalise to Dutch
    "PV22": "Drenthe",
    "PV23": "Overijssel",
    "PV24": "Flevoland",
    "PV25": "Gelderland",
    "PV26": "Utrecht",
    "PV27": "Noord-Holland",
    "PV28": "Zuid-Holland",
    "PV29": "Zeeland",
    "PV30": "Noord-Brabant",
    "PV31": "Limburg",
}


def inject_names_from_geojson(gemeenten):
    try:
        with open(GEOJSON, encoding="utf-8") as f:
            features = json.load(f).get("features", [])
        for feat in features:
            p   = feat.get("properties", {})
            gmc = (p.get("statcode") or "").strip()
            if gmc and gmc in gemeenten:
                gemeenten[gmc]["Naam"] = p.get("statnaam") or ""
        print(f"  Names injected from local {GEOJSON}")
    except Exception as e:
        print(f"  Warning: could not load local GeoJSON for names: {e}")


def inject_provinces_from_cbs(gemeenten):
    """Fetch gemeente→province mapping from CBS 84721NED reference table."""
    all_rows = []
    url = (
        "https://opendata.cbs.nl/ODataFeed/odata/84721NED/TypedDataSet"
        "?$format=json&$filter=startswith(Code_1,'GM')"
        "&$select=Code_1,Naam_2,Code_26,Naam_27&$top=1000"
    )
    while url:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        all_rows.extend(data.get("value", []))
        url = data.get("odata.nextLink") or data.get("@odata.nextLink")

    for row in all_rows:
        gmc      = row.get("Code_1", "").strip()
        pv_code  = row.get("Code_26", "").strip()
        if gmc and gmc in gemeenten:
            gemeenten[gmc]["Provincie"] = PROV_NORM.get(pv_code, row.get("Naam_27", "").strip())
    print(f"  Provinces injected for {sum(1 for g in gemeenten.values() if g['Provincie'])} gemeenten")


DOMAINS = ["Demographics", "Inequality", "HumanCapital", "Housing", "IncomeWealth", "Services", "WelfareCare", "Economy", "Environment"]

def compute_nl_totals(gemeenten):
    sums  = {d: {} for d in DOMAINS}
    cnts  = {d: {} for d in DOMAINS}
    total_pop = 0
    for gm in gemeenten.values():
        total_pop += gm.get("Population") or 0
        for domain in DOMAINS:
            for ind, val in (gm.get(domain) or {}).items():
                if not isinstance(val, (int, float)):
                    continue
                sums[domain][ind] = sums[domain].get(ind, 0) + val
                cnts[domain][ind] = cnts[domain].get(ind, 0) + 1
    totals = {"Population": total_pop}
    for domain in DOMAINS:
        totals[domain] = {
            ind: round(sums[domain][ind] / cnts[domain][ind], 2)
            for ind in sums[domain] if cnts[domain][ind]
        }
    return totals


def main():
    print(f"NLStat CBS pipeline — OData3 dataset {DATASET_ID}")
    print("-" * 60)

    print("1. Fetching observations from CBS OData3…")
    rows = fetch_all_observations()

    print("2. Reshaping…")
    gemeenten = reshape_rows(rows)
    print(f"   {len(gemeenten)} gemeenten parsed")

    print("3. Injecting names from local GeoJSON…")
    inject_names_from_geojson(gemeenten)

    print("3b. Injecting province names from CBS 84721NED…")
    inject_provinces_from_cbs(gemeenten)

    print("4. Computing NL totals…")
    nl_totals = compute_nl_totals(gemeenten)

    print("5. Writing output…")
    output = {"Gemeente": gemeenten, "Netherlands Total": nl_totals}
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = len(json.dumps(output, ensure_ascii=False)) / 1024
    print(f"   Written to {OUT_FILE} ({size_kb:.0f} KB, {len(gemeenten)} gemeenten)")
    print("Done.")


if __name__ == "__main__":
    main()
