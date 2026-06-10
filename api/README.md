---
title: NLStat Typology API
emoji: 📊
colorFrom: indigo
colorTo: blue
sdk: docker
pinned: false
---

# NLStat Typology API

R Plumber API for k-means clustering of Dutch municipalities (gemeenten) across
~70 socioeconomic indicators from CBS 85039NED (Kerncijfers wijken en buurten 2022).

## Endpoints

- `GET /health` — warm-up ping, returns indicator count
- `GET /typology?ids=GM0363,GM0034,...&k=auto` — cluster selected municipalities

## Deployment

Copy `nl_data.json` (from the main nlstat repo `data/` folder) alongside this
Dockerfile before pushing to HuggingFace Spaces.
