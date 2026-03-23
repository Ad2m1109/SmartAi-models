import os
import joblib
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
from loguru import logger
from utils.feature_engineering import preprocess_time_series, create_time_features

def train_price_model(data_path: str, model_save_path: str):
    """
    Trains an XGBoost model to predict demand based on price and time features.
    This model can be used to analyze price elasticity.
    """
    logger.info(f"Loading data from {data_path}")
    df = pd.read_csv(data_path)
    
    # Preprocessing and feature engineering
    df = preprocess_time_series(df)
    df = create_time_features(df)
    
    # Define features and target
    features = ['price', 'day_of_week', 'month', 'is_weekend', 'month_sin', 'month_cos']
    target = 'sales'
    
    X = df[features]
    y = df[target]
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    logger.info("Initializing and training XGBoost model...")
    model = xgb.XGBRegressor(
        objective='reg:squarederror',
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    logger.info(f"Price model MSE on test set: {mse:.4f}")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
    
    logger.info(f"Saving price model to {model_save_path}")
    joblib.dump(model, model_save_path)
    logger.success("Price model training complete!")

if __name__ == "__main__":
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_PATH = os.path.join(ROOT_DIR, "data/processed/dummy_price_data.csv")
    MODEL_PATH = os.path.join(ROOT_DIR, "models/price/xgboost_price_model.joblib")
    
    if os.path.exists(DATA_PATH):
        train_price_model(DATA_PATH, MODEL_PATH)
    else:
        logger.warning(f"No data found at {DATA_PATH}. Please run synthetic data generation first.")
