import os
import joblib
import pandas as pd
from loguru import logger
from typing import Dict, Any, Optional

class DemandService:
    def __init__(self, registry: Any):
        self.registry = registry

    def _get_model(self, product_id: str):
        """Fetches the latest production model for a specific product."""
        model_name = f"demand_{product_id}"
        metadata = self.registry.get_latest_version(model_name)
        if metadata:
            model = joblib.load(metadata['path'])
            return model, metadata['version']
        return None, None

    def predict(self, product_id: str, periods: int = 30, freq: str = 'D') -> Dict[str, Any]:
        """
        Generates demand forecasts for a given product.
        """
        model, version = self._get_model(product_id)
        
        if model is None:
            return {"error": f"Model for product {product_id} not found. Please train it first."}

        # Create future dataframe
        future = model.make_future_dataframe(periods=periods, freq=freq)
        forecast = model.predict(future)
        
        # Extract relevant results
        results = forecast.tail(periods)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
        results['ds'] = results['ds'].dt.strftime('%Y-%m-%d')
        
        return {
            "product_id": product_id,
            "version": version,
            "forecast": results.to_dict(orient='records'),
            "summary": {
                "avg_demand": float(results['yhat'].mean()),
                "max_demand": float(results['yhat'].max()),
                "min_demand": float(results['yhat'].min())
            }
        }
