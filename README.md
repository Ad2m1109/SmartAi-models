# SmartAI Platform: A Marketplace Intelligence System for Demand Forecasting, Mode-Aware Pricing, and Sales Simulation

## Abstract
SmartAI Platform is a marketplace intelligence system designed for listing creation, market-aware pricing, demand forecasting, and pre-publication earnings simulation. The system combines classical forecasting, gradient-boosted regression, tree-based comparative pricing, heuristic decision logic, and an LLM-assisted copywriting layer inside a single FastAPI + React/Vite stack. The current implementation supports three listing modes in the Creator workflow: `item`, `service`, and `help`. For item listings, the platform now also provides a production-oriented Boost Simulator that estimates monthly sales and revenue from user inputs such as price, category, location, and condition. This repository contains the full backend, model registry, training pipeline, and dashboard application used to reproduce the system locally.

## 1. Problem Statement
Peer-to-peer and service marketplaces typically ask users to make several difficult decisions before publishing:

- How much should the listing cost?
- Is demand likely to be strong or weak?
- Is the chosen price competitive for the local market?
- What earnings or sales volume might be expected?
- How should the listing text be improved for trust and discoverability?

SmartAI addresses these questions through a unified decision-support workflow rather than isolated tools. The design goal is to assist users before publication, using the same listing context across copy generation, pricing, market feedback, and forecast simulation.

## 2. System Contributions
The current repository implements the following system-level contributions:

1. A multi-model FastAPI backend for demand prediction, price recommendation, comparative pricing, analytics, and sales simulation.
2. A mode-aware pricing interface for `item`, `service`, and `help`, while keeping a single public pricing endpoint.
3. A fallback-aware item pricing strategy that degrades gracefully from exact `category + location + condition` matches to partial market evidence.
4. A production-style Boost Simulator that predicts `monthly_sales` and derives yearly sales and revenue from user-entered listing parameters.
5. A confidence and explanation layer that is intentionally separated from raw user-entered price values.
6. A Creator page that merges CopyCoach, Smart Price, and Boost Simulator into a single listing authoring workflow.
7. A lightweight model registry with versioning, metadata, and reproducible training snapshots.

## 3. Dataset Snapshot
The current system operates on a synthetic but structured marketplace dataset stored in `data/processed/products.json`.

### 3.1 Current Local Dataset State
Measured from the workspace on March 24, 2026:

| Property | Value |
|---|---:|
| Products | 20 |
| Raw history rows | 200 |
| Categories | 6 |
| Locations | 5 |
| Conditions | 4 |
| Monthly simulator rows | 60 |
| Monthly coverage window | 2024-01 to 2024-03 |

### 3.2 Observed Domain Values

- Categories: `Electronics`, `Fashion`, `Furniture`, `Music`, `Outdoor`, `Tools`
- Locations: `Berlin`, `London`, `Oslo`, `Paris`, `Stockholm`
- Conditions: `New`, `Refurbished`, `Used - Fair`, `Used - Good`

### 3.3 Data Representation
The raw dataset contains listing histories with:

- `price`
- `sales`
- `date`
- `category`
- `location`
- `condition`

For the Boost Simulator, the raw histories are aggregated into monthly rows with:

| category | location | condition | month | avg_price | monthly_sales |
|---|---|---|---|---:|---:|
| Tools | Stockholm | New | 2024-01 | 220 | 52 |
| Furniture | Paris | Used - Good | 2024-02 | 180 | 21 |
| Electronics | Berlin | Refurbished | 2024-03 | 480 | 12 |

## 4. Methodology

### 4.1 Demand Forecasting
Demand forecasting is implemented as a per-product time-series task. The current backend uses Prophet to generate forward demand estimates for individual products. This output is used primarily as a market-intelligence signal inside the dashboard rather than as the primary pricing model.

Target:

- future sales or demand trajectory for a selected product

Model family:

- `Prophet`

Primary API:

- `POST /predict/demand`

### 4.2 Comparative Pricing
Comparative pricing is designed as a global marketplace model rather than a per-category endpoint. The learned task is:

`price = f(category, location, condition)`

for observed marketplace records. The current comparative model uses one-hot encoded categorical variables and a Random Forest regressor.

Important implementation detail:

- This model is used only for `item` listings when an exact three-attribute match exists.
- If the exact market slice is unavailable, the system falls back to observed market subsets such as `category/location`, `category/condition`, or global-market evidence.

This produces a range-first pricing response rather than a single rigid number.

### 4.3 Mode-Aware Pricing for Item, Service, and Help
The pricing API is public-facing as a single endpoint, but internally routes by listing mode.

#### Item mode
- Uses the global comparative ML model when `category + location + condition` are all available in the market evidence.
- Falls back to partial attribute matches when needed.
- Returns a suggested range, center benchmark, market scope, explanation, and confidence.

#### Service mode
- Uses heuristic rate estimation anchored to observed marketplace references.
- Adjusts for urgency, delivery mode, audience, and semantic cues.

#### Help mode
- Uses heuristic client-budget estimation anchored to marketplace references.
- Adjusts for urgency, scope, audience, and request context.

Important limitation:

- `service` and `help` are currently heuristic strategies, not separately trained supervised models.

### 4.4 Boost Simulator
The Boost Simulator implements a different learning problem from Smart Price. Its target is:

`sales = f(price, category, location, condition, time)`

not price prediction.

#### Current simulator design
- One global simulator model
- Categorical features: `category`, `location`, `condition`
- Numeric features: `avg_price`, `month`, `quarter`, `month_sin`, `month_cos`
- Training target: `monthly_sales`
- Inference output: range-based `monthly_sales`, derived `yearly_sales`, `monthly_revenue`, `yearly_revenue`

#### Current simulator serving behavior
- Triggered from the Creator page using the user’s current form inputs
- Public API: `POST /predict/simulator`
- Current public scope: `item` listings only

#### Forecast output style
The simulator does not return a single point estimate alone. It returns:

- conservative forecast (`low`)
- central forecast (`expected`)
- optimistic forecast (`high`)

This range is then transformed into revenue ranges using the user-entered price.

### 4.5 Confidence and Explanation Layer
Confidence is intentionally implemented as a composite estimate rather than a native model probability.

For Boost Simulator, confidence is computed from:

- attribute match quality
- density of comparable data
- same-season coverage
- local demand stability
- a bounded model-quality contribution derived from stored evaluation metrics

Important interpretation:

- the dashboard displays `result.confidence`
- that value is returned by the backend
- it is not a raw XGBoost confidence score

The simulator also returns:

- `confidence_basis`
- `explanation`

The explanation layer combines demand level, price competitiveness, and data coverage quality to improve interpretability.

### 4.6 CopyCoach and Search Tags
The Creator page includes an LLM bridge called CopyCoach. It generates:

- optimized titles
- optimized descriptions
- listing features
- suggested search tags

If the model response omits tags, the frontend now generates fallback search tags from listing context, category, location, and description content.

## 5. System Architecture

### 5.1 Backend
The backend is implemented with FastAPI and organized around service classes plus a model registry.

Core backend modules:

- `api/main.py`
- `services/demand_service.py`
- `services/price_service.py`
- `services/simulator_service.py`
- `services/model_registry.py`
- `training/retraining_pipeline.py`
- `utils/feature_engineering.py`

### 5.2 Frontend
The dashboard is implemented with React and Vite. The most important workflow is the Creator page:

- `dashboard/src/components/ListingAssistant.jsx`

This component now contains:

- multi-mode listing creation
- CopyCoach application
- Smart Price button
- Boost Simulator button
- confidence and explanation rendering

### 5.3 Model Registry
Models are versioned under `models/` with:

- `model.joblib`
- `metadata.json`

Each version stores:

- model type
- version id
- training timestamp
- evaluation metrics
- serialized path

## 6. Experimental Snapshot
The following values reflect the current local workspace state observed on March 24, 2026.

### 6.1 Global Comparative Price Model

| Field | Value |
|---|---:|
| Model name | `global_comparative_price` |
| Latest version | `v4` |
| Training date | 2026-03-23 |
| Records | 200 |
| Train size | 160 |
| Test size | 40 |
| MAE | 7.65 |
| R² | 0.9995 |

### 6.2 Global Sales Simulator Model

| Field | Value |
|---|---:|
| Model name | `sales_simulator_global` |
| Latest version | `v1` |
| Training date | 2026-03-24 |
| Records | 60 |
| Train size | 48 |
| Test size | 12 |
| MAE | 6.31 |
| RMSE | 7.84 |
| R² | 0.7366 |
| Categories seen | 6 |
| Locations seen | 5 |
| Conditions seen | 4 |
| Months seen | 3 |

### 6.3 Interpretation
The pricing model performs extremely well on the current synthetic comparative dataset. The simulator is materially harder because it predicts demand-like behavior from a smaller monthly-aggregated dataset. Its performance is therefore more realistic for a first supervised forecasting baseline, but it is still limited by dataset size and temporal depth.

## 7. Reproducibility and Setup

### 7.1 Requirements

- Python 3.8+
- Node.js 18+

### 7.2 Installation

```bash
pip install -r requirements.txt
cd dashboard
npm install
cd ..
```

### 7.3 Running the Backend

```bash
export PYTHONPATH=$PYTHONPATH:.
python3 api/main.py
```

The API runs at:

- `http://localhost:8000`

Useful readiness check:

- `http://localhost:8000/health`

### 7.4 Running the Dashboard

```bash
cd dashboard
npm run dev
```

The dashboard typically runs at:

- `http://localhost:5173`

### 7.5 Training Behavior on Startup
On application startup, the backend checks the freshness of:

- `global_comparative_price`
- `sales_simulator_global`

If a model is missing or stale relative to `data/processed/products.json`, the backend retrains it automatically.

### 7.6 Manual Training Entry Points

```bash
python3 training/train_simulator.py
python3 scripts/train_global_model.py
```

## 8. API Interface

### 8.1 Core Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | `GET` | System readiness and model availability |
| `/products` | `GET` | Dataset products and metadata |
| `/predict/demand` | `POST` | Product-level demand prediction |
| `/predict/price` | `POST` | Product-specific price elasticity exploration |
| `/predict/comparative-price` | `POST` | Mode-aware pricing |
| `/predict/simulator` | `POST` | Boost Simulator forecast for item listings |
| `/analytics/summary` | `GET` | Marketplace-wide aggregate analytics |
| `/models/inventory` | `GET` | Full model inventory by type |
| `/models/trigger-retrain` | `POST` | Trigger retraining task |

### 8.2 Example: Comparative Price Request

```json
{
  "mode": "item",
  "category": "Tools",
  "location": "Stockholm",
  "condition": "New",
  "title": "Bosch Cordless Drill",
  "details": "Great condition with charger included",
  "audience": "Local Buyers",
  "shipping": "Pick-up only",
  "is_urgent": false,
  "target_price": 220
}
```

### 8.3 Example: Simulator Request

```json
{
  "mode": "item",
  "category": "Tools",
  "location": "Stockholm",
  "condition": "New",
  "price": 220
}
```

### 8.4 Example: Simulator Response

```json
{
  "monthly_sales": {
    "low": 0.0,
    "expected": 13.2,
    "high": 27.0
  },
  "yearly_sales": 158.4,
  "monthly_revenue": 2904.0,
  "yearly_revenue": 34848.0,
  "confidence": 0.59,
  "confidence_basis": "Confidence is based on attribute match quality, comparable-data density, same-season coverage, and forecast stability. It does not depend on your entered price.",
  "explanation": "Demand looks softer than the broader marketplace baseline. Price is competitive compared to similar listings. Only limited comparable coverage was found for category/location/condition (3 records), so results may vary more than usual.",
  "version": "v1"
}
```

### 8.5 Frontend API Configuration
Frontend endpoint routing is centralized in:

- `dashboard/src/config/api.js`

If the backend host or port changes, update it there or via `VITE_API_URL`.

## 9. Creator Workflow
The Creator tab is the main application workflow and currently supports:

### 9.1 Item ads
- category-aware listing authoring
- condition-aware Smart Price
- Boost Simulator with a dedicated run button
- market-driven confidence and explanation

### 9.2 Service offers
- CopyCoach for service-provider copy refinement
- heuristic rate suggestion via Smart Price

### 9.3 Help requests
- CopyCoach for demand-side request writing
- heuristic budget suggestion via Smart Price

### 9.4 Search Tag Recommendation
CopyCoach suggestions can now populate the `Search Tags` field directly. When the external LLM does not provide tags, the UI derives a fallback set locally from the listing context.

## 10. Repository Structure

```text
smartai-models/
├── api/
│   └── main.py
├── dashboard/
│   ├── src/components/
│   ├── src/config/api.js
│   └── package.json
├── data/
│   ├── processed/products.json
│   └── generate_dummy_data.py
├── models/
│   ├── global_comparative_price/
│   └── sales_simulator_global/
├── services/
│   ├── analytics_service.py
│   ├── demand_service.py
│   ├── model_registry.py
│   ├── price_service.py
│   └── simulator_service.py
├── training/
│   ├── retraining_pipeline.py
│   ├── train_demand.py
│   ├── train_price.py
│   └── train_simulator.py
├── utils/
│   └── feature_engineering.py
└── README.md
```

## 11. Current Limitations
The current implementation is production-oriented in structure, but still intentionally conservative in scope.

Key limitations:

- The dataset is synthetic and relatively small.
- The Boost Simulator currently supports `item` mode only.
- `service` and `help` pricing remain heuristic rather than fully supervised.
- The simulator confidence is a composite system score, not a native uncertainty output from the regression model.
- The external CopyCoach bridge depends on a separately hosted LLM endpoint configured in the frontend.

## 12. Roadmap
The most direct next improvements are:

1. Add price-sweep simulation to identify revenue-optimal price zones rather than only evaluating the currently entered price.
2. Replace heuristic `service` and `help` pricing with dedicated supervised models when enough data exists.
3. Expand the simulator dataset beyond three months to improve seasonality learning and uncertainty estimation.
4. Introduce calibration or conformal prediction for more principled forecast intervals.
5. Add stronger evaluation reporting for the per-product demand models.

## 13. Conclusion
SmartAI Platform is best understood as a marketplace decision-support system rather than a collection of isolated widgets. Its current implementation unifies demand estimation, range-based pricing, explanation-aware confidence scoring, and sales simulation around the same listing context. The result is a practical research-to-product prototype: reproducible enough to study, structured enough to extend, and already usable as a local end-to-end application.
