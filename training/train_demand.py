import os
import joblib
import pandas as pd
from prophet import Prophet
from loguru import logger
from utils.feature_engineering import preprocess_time_series, prepare_prophet_data

def train_demand_model(data_path: str, model_save_path: str):
    """
    Trains a Prophet model for demand forecasting.
    """
    logger.info(f"Loading data from {data_path}")
    df = pd.read_csv(data_path)
    
    # Basic preprocessing
    df = preprocess_time_series(df)
    
    # Prepare data for Prophet
    prophet_df = prepare_prophet_data(df, date_col='date', target_col='sales')
    
    logger.info("Initializing Prophet model...")
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        interval_width=0.95
    )
    
    logger.info("Fitting model...")
    model.fit(prophet_df)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
    
    logger.info(f"Saving model to {model_save_path}")
    joblib.dump(model, model_save_path)
    logger.success("Model training complete!")

if __name__ == "__main__":
    # Example usage (will be used during verification)
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_PATH = os.path.join(ROOT_DIR, "data/processed/dummy_demand.csv")
    MODEL_PATH = os.path.join(ROOT_DIR, "models/demand/prophet_model.joblib")
    
    if os.path.exists(DATA_PATH):
        train_demand_model(DATA_PATH, MODEL_PATH)
    else:
        logger.warning(f"No data found at {DATA_PATH}. Please run synthetic data generation first.")
