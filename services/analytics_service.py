import pandas as pd
from loguru import logger
from typing import Dict, Any

class AnalyticsService:
    @staticmethod
    def get_summary_stats(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generates basic summary statistics from the data.
        """
        if df.empty:
            return {"message": "Empty dataset provided."}
            
        summary = {
            "total_sales": float(df['sales'].sum()),
            "avg_price": float(df['price'].mean()),
            "min_price": float(df['price'].min()),
            "max_price": float(df['price'].max()),
            "total_records": len(df),
            "date_range": {
                "start": str(df['date'].min()),
                "end": str(df['date'].max())
            }
        }
        
        return summary

    @staticmethod
    def calculate_elasticity(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Roughly calculates price elasticity (percentage change in demand / percentage change in price).
        """
        # This is a simplified version for demonstration
        # In a real scenario, this would involve a log-log regression
        if len(df) < 2:
            return {"error": "Not enough data to calculate elasticity."}
            
        # Group by price and get mean sales
        price_grouped = df.groupby('price')['sales'].mean().reset_index()
        
        if len(price_grouped) < 2:
            return {"error": "Only one price point found."}
            
        # Simple elasticity between min and max price
        p1, p2 = price_grouped['price'].iloc[0], price_grouped['price'].iloc[-1]
        q1, q2 = price_grouped['sales'].iloc[0], price_grouped['sales'].iloc[-1]
        
        if p1 == 0 or q1 == 0:
            return {"error": "Zero price or quantity encountered."}
            
        elasticity = ((q2 - q1) / q1) / ((p2 - p1) / p1)
        
        return {
            "price_points": len(price_grouped),
            "estimated_elasticity": float(elasticity),
            "note": "Negative elasticity means demand decreases as price increases (normal)."
        }
