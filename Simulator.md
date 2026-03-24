# Boost Simulator: Production-Ready ML Upgrade Plan

## Objective

Upgrade Boost Simulator from a front-end calculator into a production-ready forecasting feature that predicts:

- `monthly_sales`
- `yearly_sales`
- `monthly_revenue`
- `yearly_revenue`

from user inputs:

- `price`
- `category`
- `location`
- `condition`

The simulator should live inside the Creator page and help users understand expected demand and earnings before publishing.

## Core Modeling Rule

The simulator must learn:

- `sales = f(price, category, location, condition, time)`

Not:

- `price = f(...)`

This distinction is critical.

For this feature:

- price is an input
- sales is the prediction target
- revenue is derived after prediction

## Product Recommendation

The idea is strong and worth building.

Why it fits the product well:

- It complements Smart Price directly.
- Smart Price tells the user what price range is reasonable.
- Boost Simulator tells the user what sales and revenue they can expect at a chosen price.
- Together they create a real decision-support workflow on the Creator page.

## Key Scope Decision

For v1, do not build separate per-category models.

Recommended approach:

- build one global simulator model
- include `category` as a feature
- include `location`, `condition`, `price`, and time features
- predict `monthly_sales`

Reason:

- current dataset is still relatively small
- per-category models would fragment the data too early
- one global model is simpler, more stable, and easier to serve
- this matches the current repo maturity better

Future direction:

- move to category-specific models only after data volume grows significantly

## Current Codebase Reality

Current state of the repo:

- `dashboard/src/components/EarningsSimulator.jsx` is still a front-end calculator.
- It does not use a backend prediction endpoint.
- It does not use a trained simulator model.
- `data/processed/products.json` already contains the raw ingredients needed for a first simulator model:
  - `price`
  - `sales`
  - `category`
  - `location`
  - `condition`
  - dated history rows

This means the simulator can be built from the existing data foundation.

## Data Design

### Target

Use:

- `monthly_sales`

Then derive:

- `yearly_sales = monthly_sales * 12`
- `monthly_revenue = monthly_sales * price`
- `yearly_revenue = yearly_sales * price`

### Training Dataset

Build a monthly aggregated table like this:

| category | location | condition | month | avg_price | monthly_sales |
|----------|----------|-----------|-------|-----------|---------------|
| Tools | Stockholm | New | 2024-01 | 220 | 52 |
| Tools | Stockholm | Used - Good | 2024-01 | 130 | 34 |
| Electronics | Paris | New | 2024-01 | 980 | 18 |

### Required Features

Use these features for v1:

- `price` or `avg_price`
- `category`
- `location`
- `condition`
- `month`

Recommended time encoding:

- numeric month
- cyclical month encoding if useful

### Data Engineering Notes

We need a deterministic feature-engineering layer that is shared by both:

- training
- inference

This layer should:

- aggregate raw history into monthly rows
- normalize category/location/condition values
- encode the same features at train and predict time

## Model Design

Recommended models:

- `XGBoostRegressor`
- or `RandomForestRegressor`

Preferred choice for v1:

- start with `XGBoostRegressor`
- benchmark it against `RandomForestRegressor`
- keep the simpler one if the results are close

Reason:

- good fit for small-to-medium tabular data
- fast inference for inline UI use
- robust with mixed numeric and categorical-style encoded features
- stable enough for real-time Creator-page predictions

## Output Design

Do not return a single forecast number only.

Return a structured forecast range:

```json
{
  "monthly_sales": {
    "low": 3.2,
    "expected": 5.4,
    "high": 7.1
  },
  "yearly_sales": 64.8,
  "monthly_revenue": 1188,
  "yearly_revenue": 14256,
  "confidence": 0.78,
  "explanation": "High demand in your area and competitive pricing compared to similar listings.",
  "version": "v1"
}
```

Interpretation:

- `low`: conservative estimate
- `expected`: central estimate
- `high`: optimistic estimate

This is more realistic and much more useful than a single rigid value.

## Confidence System

Confidence must be independent from the user-entered price itself.

Confidence should be based on:

- similarity of the input to training data
- density of historical data for the requested category/location/condition
- model prediction variance or uncertainty proxy

Rules:

- confidence range must be `0..1`
- confidence must be returned by the API
- confidence must influence UI messaging

Suggested interpretation:

- `0.80 - 1.00`: strong forecast
- `0.60 - 0.79`: usable forecast
- `0.40 - 0.59`: weak forecast, show caution
- `< 0.40`: low-confidence fallback

## Explanation Layer

Every prediction must include a short explanation string.

Examples:

- `High demand in your area`
- `Price is competitive compared to similar listings`
- `Limited data for this category, results may vary`

Purpose:

- improve trust
- make the AI understandable
- explain weak-confidence cases clearly

The explanation layer should combine:

- demand signal
- price competitiveness
- data coverage quality

## Simulation Logic

The simulator should not be limited to predicting one user-entered price only.

Recommended v1 logic:

- predict sales for the current entered price
- derive low / expected / high sales from model and fallback uncertainty
- derive revenues from those sales values

Recommended v2 logic:

- run the model over a range of candidate prices
- estimate sales for each price
- compute revenue for each price
- surface an optimal price zone or revenue-efficient range

This would make the simulator a true optimization tool, not just a forecast widget.

## API Design

### Endpoint

- `POST /predict/simulator`

### Request

```json
{
  "category": "Tools",
  "location": "Stockholm",
  "condition": "New",
  "price": 220
}
```

### Response

Must include:

- `monthly_sales.low`
- `monthly_sales.expected`
- `monthly_sales.high`
- `yearly_sales`
- `monthly_revenue`
- `yearly_revenue`
- `confidence`
- `explanation`
- `version`

Suggested response shape:

```json
{
  "monthly_sales": {
    "low": 3.2,
    "expected": 5.4,
    "high": 7.1
  },
  "yearly_sales": 64.8,
  "monthly_revenue": 1188,
  "yearly_revenue": 14256,
  "confidence": 0.78,
  "explanation": "High demand in your area and competitive pricing compared to similar listings.",
  "version": "v1"
}
```

## Fallback Strategy

If input data is weak or missing, the system must not fail silently.

Fallback behavior should be:

- fallback to category averages
- fallback to location averages
- fallback to broader market averages
- widen forecast range
- reduce confidence
- return an explanation that signals uncertainty

Example explanation:

- `Limited data for this exact combination, forecast is based on broader market patterns.`

## Backend Implementation Plan

### Phase 1: Dataset Builder

Create a monthly dataset builder.

Suggested file:

- `training/train_simulator.py`

Responsibilities:

- load `data/processed/products.json`
- aggregate sales history to monthly rows
- compute monthly average price
- produce simulator training features
- split train/validation data

### Phase 2: Model Training

Train a global simulator model.

Responsibilities:

- encode `category`, `location`, `condition`
- include time feature `month`
- train regressor for `monthly_sales`
- evaluate with MAE and RMSE
- save versioned model in registry

Suggested registry name:

- `sales_simulator_global`

### Phase 3: Inference Service

Add a new backend service.

Suggested file:

- `services/simulator_service.py`

Responsibilities:

- load latest simulator model
- build inference features from request
- predict expected monthly sales
- compute low/high forecast band
- compute yearly sales and revenues
- compute confidence
- generate explanation

### Phase 4: API Layer

Add:

- `POST /predict/simulator`

Suggested location:

- `api/main.py`

### Phase 5: Fallback Logic

Add deterministic fallback behavior when:

- no exact data exists
- category is sparse
- location is sparse
- model confidence is low

## Frontend Integration Plan

### Creator Page Integration

Integrate the simulator directly into `dashboard/src/components/ListingAssistant.jsx`.

Placement recommendation:

- directly below the Smart Price section
- or as an adjacent strategy block under the pricing result

Use existing form inputs directly:

- `targetPrice`
- `category`
- `location`
- `condition`

No extra form should be required.

### Display Requirements

Show:

- expected monthly sales
- expected yearly sales
- expected monthly revenue
- expected yearly revenue
- confidence indicator
- explanation text

Optional UI additions:

- conservative / expected / optimistic cards
- small bar chart or sparkline
- confidence badge color states

### Update Behavior

The simulator should:

- update in near real-time
- refresh when price/category/location/condition changes
- debounce requests to avoid noisy API traffic

## Recommended UX Messaging

High confidence:

- `Strong forecast based on similar listings in your market.`

Medium confidence:

- `Forecast based on similar listings, but market variation is moderate.`

Low confidence:

- `Limited comparable data. Use this forecast as a directional estimate.`

## Implementation Phases

### Phase 1

- build monthly dataset
- train global simulator model
- evaluate with MAE/RMSE

### Phase 2

- build simulator service
- add `POST /predict/simulator`
- return structured forecast response

### Phase 3

- add confidence system
- add explanation layer
- add fallback strategy

### Phase 4

- integrate into Creator page
- add cards and optional chart
- add loading and empty states

## Constraints

Must follow these constraints:

- do not build per-category models yet
- use one global model with category as a feature
- keep v1 simple and stable
- avoid overfitting
- keep inference fast enough for UI use

## Final Recommendation

This feature should be built.

The strongest v1 version is:

- one global simulator model
- target = `monthly_sales`
- inputs = `price`, `category`, `location`, `condition`, `month`
- output = forecast range, revenue, confidence, explanation
- integrated directly into the Creator page

This will transform Boost Simulator from a visual calculator into a real decision-making engine that helps users:

- choose better prices
- understand expected demand
- estimate real earnings
- trust the platform more
