import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from services.demand_service import DemandService
from services.price_service import PriceService
from services.analytics_service import AnalyticsService
from services.model_registry import ModelRegistry
from services.scheduler import model_scheduler
from training.retraining_pipeline import RetrainingPipeline
import pandas as pd
from loguru import logger
from datetime import datetime

# Configuration
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_STORAGE = os.path.join(ROOT_DIR, "models")
PRODUCTS_DATA = os.path.join(ROOT_DIR, "data/processed/products.json")

# Initialize core services
registry = ModelRegistry(MODEL_STORAGE)
pipeline = RetrainingPipeline(registry)
demand_service = DemandService(registry)
price_service = PriceService(registry, PRODUCTS_DATA)
analytics_service = AnalyticsService()
scheduler = model_scheduler(pipeline, PRODUCTS_DATA)


# ─── Lifespan (replaces deprecated on_event) ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up...")

    # Auto-retrain comparative model if not present or data changed
    latest = registry.get_latest_version("global_comparative_price")
    if not latest:
        logger.info("No global comparative model found — training on startup...")
        pipeline.train_comparative_price_model(PRODUCTS_DATA)
    else:
        # Check if data is newer than the last trained model
        data_mtime = os.path.getmtime(PRODUCTS_DATA)
        model_date = datetime.fromisoformat(latest['training_date'])
        if datetime.fromtimestamp(data_mtime) > model_date:
            logger.info("Data file updated since last training — retraining...")
            pipeline.train_comparative_price_model(PRODUCTS_DATA)
        else:
            logger.info(f"Global comparative model {latest['version']} is up-to-date.")

    yield  # App is running

    logger.info("Application shutting down...")


app = FastAPI(
    title="SmartAI Models API",
    description="Production-ready API with Unified Product Intelligence",
    lifespan=lifespan
)

# Enable CORS for dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request Models ──────────────────────────────────────────────────
class PredictionRequest(BaseModel):
    product_id: str
    periods: int = 30
    freq: str = 'D'

class PriceRecommendationRequest(BaseModel):
    product_id: str
    date: str
    potential_prices: List[float]

class ComparativePriceRequest(BaseModel):
    mode: str = "item"
    category: str
    location: str
    condition: Optional[str] = "New"
    title: Optional[str] = None
    details: Optional[str] = None
    audience: Optional[str] = None
    shipping: Optional[str] = None
    is_urgent: bool = False
    target_price: Optional[float] = None


# ─── Structured Error Response ───────────────────────────────────────
def raise_smart_error(status_code: int, message: str, detail: str = ""):
    raise HTTPException(
        status_code=status_code,
        detail={
            "message": message,
            "detail": detail,
            "timestamp": datetime.now().isoformat()
        }
    )


# ─── Endpoints ────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {
        "message": "SmartAI Models API is online.",
        "status": "Healthy",
        "data_source": "products.json"
    }

@app.get("/health")
def health_check():
    """System readiness check."""
    comparative_model = registry.get_latest_version("global_comparative_price")
    with open(PRODUCTS_DATA, 'r') as f:
        product_count = len(json.load(f))

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": {
            "comparative_price": {
                "loaded": comparative_model is not None,
                "version": comparative_model['version'] if comparative_model else None
            }
        },
        "data": {
            "products_count": product_count,
            "data_path": PRODUCTS_DATA
        }
    }

@app.get("/products")
def list_products():
    """Returns the basic list of products in the database."""
    with open(PRODUCTS_DATA, 'r') as f:
        data = json.load(f)
    return [{
        "id": p['id'],
        "name": p['name'],
        "category": p['category'],
        "location": p.get('location', 'Global'),
        "condition": p.get('condition', 'New')
    } for p in data]

@app.post("/predict/demand")
def predict_demand(request: PredictionRequest):
    result = demand_service.predict(product_id=request.product_id, periods=request.periods, freq=request.freq)
    if "error" in result:
        raise_smart_error(400, "Demand prediction failed", result["error"])
    return result

@app.post("/predict/price")
def recommend_price(request: PriceRecommendationRequest):
    logger.info(f"Price Recommendation Request: {request.dict()}")
    result = price_service.recommend_price(request.product_id, request.date, request.potential_prices)
    if "error" in result:
        raise_smart_error(400, "Price recommendation failed", result["error"])
    return result

@app.post("/predict/comparative-price")
def predict_comparative_price(request: ComparativePriceRequest):
    logger.info(f"Comparative Price Request: {request.dict()}")
    result = price_service.predict_comparative_price(
        category=request.category,
        location=request.location,
        condition=request.condition,
        mode=request.mode,
        title=request.title,
        details=request.details,
        audience=request.audience,
        shipping=request.shipping,
        is_urgent=request.is_urgent,
        target_price=request.target_price,
    )
    if "error" in result:
        raise_smart_error(400, "Comparative price prediction failed", result["error"])
    return result

@app.get("/models/inventory")
def get_model_inventory():
    """Returns all versions for all products."""
    with open(PRODUCTS_DATA, 'r') as f:
        data = json.load(f)

    inventory = {}
    for product in data:
        p_id = product['id']
        inventory[p_id] = {
            "demand": registry.list_inventory(f"demand_{p_id}"),
            "price": registry.list_inventory(f"price_{p_id}")
        }

    # Add the global comparative model
    inventory["_global"] = {
        "comparative_price": registry.list_inventory("global_comparative_price")
    }
    return inventory

@app.post("/models/trigger-retrain")
async def trigger_retrain(product_id: str, model_type: str, background_tasks: BackgroundTasks):
    """Manually triggers retraining for a specific product and model type."""
    valid_types = ["demand", "price", "comparative"]
    if model_type not in valid_types:
        raise_smart_error(400, f"Invalid model type. Must be one of: {valid_types}")

    if model_type == "demand":
        background_tasks.add_task(pipeline.retrain_demand, PRODUCTS_DATA, product_id)
    elif model_type == "price":
        background_tasks.add_task(pipeline.retrain_price, PRODUCTS_DATA, product_id)
    elif model_type == "comparative":
        background_tasks.add_task(pipeline.train_comparative_price_model, PRODUCTS_DATA)

    return {"message": f"Retraining triggered for {model_type} ({product_id})"}

@app.get("/analytics/summary")
def get_summary():
    """Calculates summary stats across all products."""
    with open(PRODUCTS_DATA, 'r') as f:
        data = json.load(f)

    all_history = []
    for p in data:
        df_p = pd.DataFrame(p['history'])
        df_p['product_id'] = p['id']
        df_p['category'] = p['category']
        df_p['location'] = p.get('location', 'Global')
        all_history.append(df_p)

    full_df = pd.concat(all_history)
    summary = analytics_service.get_summary_stats(full_df)

    # Add enriched stats
    summary['categories'] = list(full_df['category'].unique())
    summary['locations'] = list(full_df['location'].unique()) if 'location' in full_df.columns else []
    summary['product_count'] = len(data)

    return summary


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
