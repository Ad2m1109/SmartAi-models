import pandas as pd
import numpy as np
import os
import json
from datetime import datetime, timedelta

def generate_product_data(product_id, name, category, n_days=365):
    """Generates synthetic historical data for a single product."""
    dates = [datetime(2023, 1, 1) + timedelta(days=i) for i in range(n_days)]
    
    # 1. Generate Demand/Sales
    base_demand = 100 + 50 * np.sin(np.linspace(0, 4 * np.pi, n_days))
    weekly_seasonality = 20 * np.array([1.2 if d.weekday() >= 5 else 0.8 for d in dates])
    noise = np.random.normal(0, 10, n_days)
    
    # 2. Price Elasticity Effect
    # Higher price -> Lower sales
    base_price = np.random.uniform(50, 200)
    prices = base_price + np.random.normal(0, base_price * 0.05, n_days)
    prices = np.round(prices, 2)
    
    elasticity = -2.5
    price_impact = (prices - base_price) * elasticity
    
    sales = base_demand + weekly_seasonality + price_impact + noise
    sales = np.maximum(0, sales).astype(int)
    
    history = []
    for i in range(n_days):
        history.append({
            "date": dates[i].strftime("%Y-%m-%d"),
            "sales": int(sales[i]),
            "price": float(prices[i])
        })
        
    return {
        "id": product_id,
        "name": name,
        "category": category,
        "current_price": float(prices[-1]),
        "history": history
    }

if __name__ == "__main__":
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    PROCESSED_DATA_DIR = os.path.join(ROOT_DIR, "data/processed")
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    
    products = [
        ("prod_001", "Professional Power Drill", "Tools"),
        ("prod_002", "Ergonomic Office Chair", "Furniture"),
        ("prod_003", "4K HDR Video Drone", "Electronics"),
        ("prod_004", "Smart Garden Irrigation", "Outdoor")
    ]
    
    inventory = []
    for p_id, name, cat in products:
        print(f"Generating data for {name}...")
        product_data = generate_product_data(p_id, name, cat)
        inventory.append(product_data)
        
    output_path = os.path.join(PROCESSED_DATA_DIR, "products.json")
    with open(output_path, 'w') as f:
        json.dump(inventory, f, indent=4)
        
    print(f"\nUnified product data generated at: {output_path}")
