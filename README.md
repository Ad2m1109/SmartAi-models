# SmartAI Platform - Allt i Allo Intelligence Suite 🚀

Welcome to the **SmartAI Platform**, a high-end, production-ready intelligence suite designed for modern, high-conversion marketplaces. This platform leverages local AI models (XGBoost, RandomForest, Facebook Prophet) and LLMs to provide real-time insights, demand forecasting, and dynamic listing optimization.

---

## 🌟 Core AI Features (The 8 Dimensions)

1. **AI Autofill**: Automatically detects and categorizes products, assigning optimal tags and structured metadata.
2. **Market Intelligence (Demand Forecasting)**: Uses Facebook Prophet to generate 30-day predictive demand trends (High, Steady, Moderate).
3. **Smart Price (Mode-Aware Range Pricing)**: Pricing now returns a suggested range instead of a single hard number. `item` listings use the comparative ML model when an exact category/location/condition match exists, then fall back to 2-attribute or 1-attribute market matches when needed. `service` and `help` use dedicated heuristic strategies tuned for rates and request budgets.
4. **Publish Optimizer (Timing Strategy)**: Analyzes historical engagement to suggest the best hour and day to list for maximum visibility.
5. **Listing Comparison Insights**: Real-time evaluation of your listing length and tag count against top-performing market peers.
6. **SmartAI CopyCoach (LLM Bridge)**: Transforms simple bullet points into premium, trust-focused, or friendly peer-to-peer listing descriptions and recommends searchable tags for the `Search Tags` field.
7. **Boost Simulator**: An interactive earnings projection tool to simulate ROI based on pricing, rental frequency, and ad boost efficiency.
8. **Seller Confidence Score**: A dynamic quality score out of 100 assessing the strength and completeness of your listing draft.

---

## 🏗️ Architecture & Stack

- **Backend / ML API**: Built with Python and **FastAPI**.
  - **Machine Learning**: `scikit-learn` (RandomForest comparative pricing), `xgboost` (time-series pricing), `prophet` (demand forecasting).
  - **Pricing Logic**: One mode-aware pricing endpoint for `item`, `service`, and `help`, with exact-match ML pricing for items and backoff/range heuristics when attributes are missing or unknown.
  - **Data Management**: In-memory caching and JSON-based robust state management mimicking a production DB.
  - **Custom Model Registry**: Automated versioning, metrics tracking, and logging out-of-the-box.
- **Frontend / Dashboard**: Built with **React** & **Vite**.
  - **Styling**: Tailwind CSS with custom glassmorphism and modern "SmartAI" branding.
  - **Icons & Animation**: `lucide-react` and `framer-motion` for buttery smooth interactions.
  - **State**: Centralized React state tailored for rapid UX.

---

## 🛠️ Setup & Installation

### 1. Requirements
Ensure you have **Python 3.8+** and **Node.js 18+** installed.

```bash
# Clone the repository and navigate to it
cd smartai-models

# Install Python dependencies for the backend
pip install -r requirements.txt

# Install Node dependencies for the dashboard
cd dashboard
npm install
cd ..
```

### 2. Data & Model Initialization
The system ships with a synthetic marketplace state (`data/processed/products.json`). 

Upon first boot, the FastAPI server will automatically detect the dataset and train the **Global Comparative Price Model** (v1) instantly. No manual initialization scripts required!

---

## 🚀 Running the Application

You need to run two terminal sessions to start the platform.

### Terminal 1: Start the AI Backend
```bash
# From the root directory
export PYTHONPATH=$PYTHONPATH:.
python3 api/main.py
```
*The API will start on `http://localhost:8000`.*
*You can verify readiness by hitting `http://localhost:8000/health`*

### Terminal 2: Start the Dashboard
```bash
# From the dashboard directory
cd dashboard
npm run dev
```
*The dashboard will start on `http://localhost:5173` (or the port shown in your terminal).*

---

## 🧑‍💻 Using the Platform

### The Admin Overview Tab
- **Data-Driven KPIs**: View total active listings, average market prices, total categories, and data points.
- **Demand Trends**: Select a product from the top-right dropdown to see its specific 30-day demand forecast (Prophet model).
- **Price Elasticity**: Analyze historical sales volume vs. price points for the selected product.

### The SmartAI Listing Hub (Creator Tab)
- This is the interactive AI workflow for creating new marketplace listings.
- **Three Modes**: Create `Item Ads`, `Offer Service`, or `Request Help` from the same workflow.
- **Contextual Form**: Fill in Category, Location, Delivery method, audience, urgency, and other listing context.
- **Inline CopyCoach**: Type a rough description, hit `✨ CopyCoach`, and the AI will generate refined copy plus suggested search tags. Click `✅ Use This` to apply the generated description and tags to the form.
- **Inline Smart Pricing**: Type your expected price/rate/budget and hit `✨ Smart Price`. The strategy block now returns a suggested range, a center benchmark, the market basis used (`3-attribute`, `2-attribute`, `1-attribute`, or global fallback), and a confidence score based on market evidence rather than your entered value.
- **Review & Publish**: An elegant footer that reacts to your completion rate.

### The Boost Simulator Tab
- Toggle prices, boost efficiency, and rental frequency to forecast monthly and yearly earnings using interactive, animated KPI cards.

---

## 🔌 Core API Endpoints

Once the backend is running, you can interact directly with the intelligence layer:

- `GET /health` : System readiness, loaded models, and DB status.
- `GET /products` : List of available test products in the dataset.
- `POST /predict/demand` : Post a `product_id` and `periods` to get future daily demand.
- `POST /predict/comparative-price` : Post `mode`, `category`, `location`, and optional listing context to get a suggested pricing range.
- `GET /analytics/summary` : Aggregate global marketplace analytics.
- `POST /models/trigger-retrain` : Queue a background task to retrain a specific model.

### Pricing Endpoint Notes

`POST /predict/comparative-price` supports three pricing modes:

- `item`: Returns a suggested listing range. Uses the comparative ML model when an exact `category + location + condition` match exists, otherwise falls back to the best available market subset.
- `service`: Returns a suggested service-rate range using market anchors plus service-specific heuristics.
- `help`: Returns a suggested request-budget range using market anchors plus help-request heuristics.

Important response fields:

- `recommended_price`: Center benchmark inside the suggested range.
- `suggested_min_price` / `suggested_max_price`: The main range to show in the UI.
- `reference_scope`: Which attributes matched, for example `category/location/condition` or `category/location`.
- `confidence`: Confidence in the estimate based on comparable-data quality and match strength.
- `confidence_is_input_independent`: Explicit flag showing that confidence does not depend on the user-entered target value.
- `input_influence_pct`: How much the user's entered value influenced the returned estimate, if any.

Example request:

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

*Note: Frontend API routing is centralized in `dashboard/src/config/api.js`. If you change the FastAPI port, simply update it there.*

---

## 📁 Project Structure

```text
smartai-models/
├── api/
│   └── main.py                  # FastAPI Application Entrypoint
├── dashboard/                   # React + Vite Frontend
│   ├── src/components/          # ListingAssistant, Header, Simulator, etc.
│   └── src/config/api.js        # Centralized endpoint configuration
├── data/
│   └── processed/               # Data store (products.json)
├── models/                      # Automated Model Versioning Registry
├── services/                    # Business Logic (Pricing, Demand, Analytics)
├── scripts/                     # Utility scripts (train_global_model.py)
├── training/                    # ML Training Pipelines (RandomForest, Prophet)
└── utils/                       # Feature Engineering heuristics
```
