import os
import joblib
import pandas as pd
import numpy as np
from loguru import logger
from typing import Dict, Any, List
from utils.feature_engineering import create_time_features

class PriceService:
    def __init__(self, registry: Any):
        self.registry = registry

    def _get_model(self, product_id: str):
        """Fetches the latest production model for a specific product."""
        model_name = f"price_{product_id}"
        metadata = self.registry.get_latest_version(model_name)
        if metadata:
            model = joblib.load(metadata['path'])
            return model, metadata['version']
        return None, None

    def recommend_price(self, product_id: str, date: str, potential_prices: List[float]) -> Dict[str, Any]:
        """
        Predicts demand for different price points for a specific product.
        """
        model, version = self._get_model(product_id)

        if model is None:
            return {"error": f"Model for product {product_id} not found."}

        # Prepare input data for the date
        df_date = pd.DataFrame({'date': [date]})
        df_date = create_time_features(df_date)
        
        results = []
        for price in potential_prices:
            row = df_date.copy()
            row['price'] = price
            
            features = ['price', 'day_of_week', 'month', 'is_weekend', 'month_sin', 'month_cos']
            X = row[features]
            
            predicted_demand = model.predict(X)[0]
            revenue = price * predicted_demand
            
            results.append({
                "price": price,
                "predicted_demand": float(max(0, predicted_demand)),
                "estimated_revenue": float(max(0, revenue))
            })
            
        recommendation = max(results, key=lambda x: x['estimated_revenue'])
        
        return {
            "product_id": product_id,
            "version": version,
            "date": date,
            "all_scenarios": results,
            "recommendation": recommendation
        }

    def predict_comparative_price(self, category: str, location: str, condition: str) -> Dict[str, Any]:
        """Predicts a price based on category, location, and condition using the global model."""
        metadata = self.registry.get_latest_version("global_comparative_price")
        if not metadata:
            return {"error": "Global comparative price model not found. Please run retraining."}
        
        try:
            bundle = joblib.load(metadata['path'])
            model = bundle['model']
            encoder = bundle['encoder']
            features = bundle['features']
            
            # Prepare input
            input_df = pd.DataFrame([{
                'category': category,
                'location': location,
                'condition': condition
            }])
            
            X_encoded = encoder.transform(input_df)
            predicted_price = model.predict(X_encoded)[0]
            
            return {
                "category": category,
                "location": location,
                "condition": condition,
                "recommended_price": round(float(predicted_price), 2),
                "confidence": 0.88, # Baseline confidence for global model
                "version": metadata['version']
            }
        except Exception as e:
            logger.error(f"Comparative price prediction failed: {str(e)}")
            return {"error": f"Prediction failed: {str(e)}"}
