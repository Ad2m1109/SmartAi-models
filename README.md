# SmartAI Platform - Allt i Allo Intelligence Suite 🚀

Welcome to the **SmartAI Platform**, a high-end, production-ready intelligence suite designed for modern, high-conversion marketplaces. This platform leverages local AI models (XGBoost, RandomForest, Facebook Prophet) and LLMs to provide real-time insights, demand forecasting, and dynamic listing optimization.

---

## 🌟 Core AI Features (The 8 Dimensions)

1. **AI Autofill**: Automatically detects and categorizes products, assigning optimal tags and structured metadata.
2. **Market Intelligence (Demand Forecasting)**: Uses Facebook Prophet to generate 30-day predictive demand trends (High, Steady, Moderate).
3. **Smart Price (Comparative ML Pricing)**: A global `RandomForestRegressor` model evaluates category, location, condition, and market data to suggest the optimal selling price.
4. **Publish Optimizer (Timing Strategy)**: Analyzes historical engagement to suggest the best hour and day to list for maximum visibility.
5. **Listing Comparison Insights**: Real-time evaluation of your listing length and tag count against top-performing market peers.
6. **SmartAI CopyCoach (LLM Bridge)**: Transforms simple bullet points into premium, trust-focused, or friendly peer-to-peer listing descriptions.
7. **Boost Simulator**: An interactive earnings projection tool to simulate ROI based on pricing, rental frequency, and ad boost efficiency.
8. **Seller Confidence Score**: A dynamic quality score out of 100 assessing the strength and completeness of your listing draft.

---

## 🏗️ Architecture & Stack

- **Backend / ML API**: Built with Python and **FastAPI**.
  - **Machine Learning**: `scikit-learn` (RandomForest), `xgboost` (Time-series pricing), `prophet` (Demand forecasting).
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
- **Contextual Form**: Fill in Category, Location, Delivery method, etc.
- **Inline CopyCoach**: Type a rough description, hit `✨ CopyCoach`, and watch the AI inject a professional refined description directly below the textarea. Click `✅ Use This` to apply it.
- **Inline Smart Pricing**: Type an expected price and hit `✨ Smart Price`. A 3-card strategy block will spawn inline, giving you the ML-calculated optimal price, publishing time, and confidence interval.
- **Review & Publish**: An elegant footer that reacts to your completion rate.

### The Boost Simulator Tab
- Toggle prices, boost efficiency, and rental frequency to forecast monthly and yearly earnings using interactive, animated KPI cards.

---

## 🔌 Core API Endpoints

Once the backend is running, you can interact directly with the intelligence layer:

- `GET /health` : System readiness, loaded models, and DB status.
- `GET /products` : List of available test products in the dataset.
- `POST /predict/demand` : Post a `product_id` and `periods` to get future daily demand.
- `POST /predict/comparative-price` : Post `category`, `location`, and `condition` to get the ML-backed optimal list price.
- `GET /analytics/summary` : Aggregate global marketplace analytics.
- `POST /models/trigger-retrain` : Queue a background task to retrain a specific model.

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
