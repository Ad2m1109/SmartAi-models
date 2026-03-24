import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel, Field

from services.analytics_service import AnalyticsService
from services.demand_service import DemandService
from services.model_registry import ModelRegistry
from services.price_service import PriceService
from services.scheduler import model_scheduler
from services.simulator_service import SimulatorService
from training.retraining_pipeline import RetrainingPipeline

# Configuration
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_STORAGE = os.path.join(ROOT_DIR, "models")
PRODUCTS_DATA = os.path.join(ROOT_DIR, "data/processed/products.json")

# Initialize core services
registry = ModelRegistry(MODEL_STORAGE)
pipeline = RetrainingPipeline(registry)
demand_service = DemandService(registry)
price_service = PriceService(registry, PRODUCTS_DATA)
simulator_service = SimulatorService(registry, PRODUCTS_DATA, pipeline)
analytics_service = AnalyticsService()
scheduler = model_scheduler(pipeline, PRODUCTS_DATA)


def ensure_global_model(model_name: str, trainer: Any, label: str):
    latest = registry.get_latest_version(model_name)
    if not latest:
        logger.info(f"No {label} model found, training on startup...")
        trainer(PRODUCTS_DATA)
        return

    data_mtime = os.path.getmtime(PRODUCTS_DATA)
    model_date = datetime.fromisoformat(latest['training_date'])
    if datetime.fromtimestamp(data_mtime) > model_date:
        logger.info(f"Data file updated since last {label} training, retraining...")
        trainer(PRODUCTS_DATA)
    else:
        logger.info(f"{label.capitalize()} model {latest['version']} is up-to-date.")


# Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up...")
    ensure_global_model("global_comparative_price", pipeline.train_comparative_price_model, "comparative price")
    ensure_global_model("sales_simulator_global", pipeline.train_sales_simulator_model, "sales simulator")
    yield
    logger.info("Application shutting down...")


app = FastAPI(
    title="SmartAI Models API",
    description="Production-ready API with Unified Product Intelligence",
    lifespan=lifespan,
)

# Enable CORS for dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Models
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


class SimulatorRequest(BaseModel):
    mode: str = "item"
    category: str
    location: str
    condition: Optional[str] = "New"
    price: float = Field(..., gt=0)
    forecast_date: Optional[str] = None


# Structured Error Response
def raise_smart_error(status_code: int, message: str, detail: str = ""):
    raise HTTPException(
        status_code=status_code,
        detail={
            "message": message,
            "detail": detail,
            "timestamp": datetime.now().isoformat(),
        },
    )


# Endpoints
@app.get("/")
def read_root():
    return {
        "message": "SmartAI Models API is online.",
        "status": "Healthy",
        "data_source": "products.json",
    }


@app.get("/health")
def health_check():
    """System readiness check."""
    comparative_model = registry.get_latest_version("global_comparative_price")
    simulator_model = registry.get_latest_version("sales_simulator_global")
    with open(PRODUCTS_DATA, 'r') as f:
        product_count = len(json.load(f))

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": {
            "comparative_price": {
                "loaded": comparative_model is not None,
                "version": comparative_model['version'] if comparative_model else None,
            },
            "sales_simulator": {
                "loaded": simulator_model is not None,
                "version": simulator_model['version'] if simulator_model else None,
            },
        },
        "data": {
            "products_count": product_count,
            "data_path": PRODUCTS_DATA,
        },
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
        "condition": p.get('condition', 'New'),
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


@app.post("/predict/simulator")
def predict_simulator(request: SimulatorRequest):
    logger.info(f"Simulator Request: {request.dict()}")
    if request.mode != "item":
        raise_smart_error(
            400,
            "Boost Simulator is currently available only for item listings.",
            f"Unsupported mode: {request.mode}",
        )

    result = simulator_service.predict_sales_forecast(
        category=request.category,
        location=request.location,
        condition=request.condition,
        price=request.price,
        forecast_date=request.forecast_date,
    )
    if "error" in result:
        raise_smart_error(400, "Simulator prediction failed", result["error"])
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
            "price": registry.list_inventory(f"price_{p_id}"),
        }

    inventory["_global"] = {
        "comparative_price": registry.list_inventory("global_comparative_price"),
        "sales_simulator": registry.list_inventory("sales_simulator_global"),
    }
    return inventory


@app.post("/models/trigger-retrain")
async def trigger_retrain(product_id: str, model_type: str, background_tasks: BackgroundTasks):
    """Manually triggers retraining for a specific product and model type."""
    valid_types = ["demand", "price", "comparative", "simulator"]
    if model_type not in valid_types:
        raise_smart_error(400, f"Invalid model type. Must be one of: {valid_types}")

    if model_type == "demand":
        background_tasks.add_task(pipeline.retrain_demand, PRODUCTS_DATA, product_id)
    elif model_type == "price":
        background_tasks.add_task(pipeline.retrain_price, PRODUCTS_DATA, product_id)
    elif model_type == "comparative":
        background_tasks.add_task(pipeline.train_comparative_price_model, PRODUCTS_DATA)
    elif model_type == "simulator":
        background_tasks.add_task(pipeline.train_sales_simulator_model, PRODUCTS_DATA)

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

    summary['categories'] = list(full_df['category'].unique())
    summary['locations'] = list(full_df['location'].unique()) if 'location' in full_df.columns else []
    summary['product_count'] = len(data)

    return summary


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
