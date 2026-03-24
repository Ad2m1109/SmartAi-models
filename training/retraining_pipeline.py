import json
import os
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
import xgboost as xgb
from loguru import logger
from prophet import Prophet
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder

from services.model_registry import ModelRegistry
from utils.feature_engineering import (
    build_monthly_simulator_dataset,
    create_time_features,
    get_sliding_window_data,
    prepare_prophet_data,
    preprocess_time_series,
)


class RetrainingPipeline:
    def __init__(self, registry: ModelRegistry):
        self.registry = registry

    def _load_product_df(self, products_path: str, product_id: str) -> pd.DataFrame:
        """Loads a specific product's history as a DataFrame."""
        with open(products_path, 'r') as f:
            data = json.load(f)

        product = next((p for p in data if p['id'] == product_id), None)
        if not product:
            raise ValueError(f"Product {product_id} not found in {products_path}")

        df = pd.DataFrame(product['history'])
        df = preprocess_time_series(df)
        return df

    def _evaluate_demand_model(self, model: Prophet, test_df: pd.DataFrame) -> float:
        """Calculates MAPE for Prophet model."""
        prophet_test = prepare_prophet_data(test_df, 'date', 'sales')
        forecast = model.predict(prophet_test)
        mape = mean_absolute_percentage_error(prophet_test['y'], forecast['yhat'])
        return mape

    def _evaluate_price_model(self, model: Any, test_df: pd.DataFrame) -> float:
        """Calculates MAE for XGBoost price model."""
        df = create_time_features(test_df)
        features = ['price', 'day_of_week', 'month', 'is_weekend', 'month_sin', 'month_cos']
        X = df[features]
        y = df['sales']

        preds = model.predict(X)
        mae = mean_absolute_error(y, preds)
        return mae

    def _prepare_simulator_matrix(
        self,
        df: pd.DataFrame,
        encoder: Optional[OneHotEncoder] = None,
        fit: bool = False,
    ):
        categorical_features = ['category', 'location', 'condition']
        numeric_features = ['avg_price', 'month', 'quarter', 'month_sin', 'month_cos']

        X_categorical_raw = df[categorical_features]
        if fit:
            encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
            X_categorical = encoder.fit_transform(X_categorical_raw)
        else:
            if encoder is None:
                raise ValueError("Encoder is required when fit=False")
            X_categorical = encoder.transform(X_categorical_raw)

        X_numeric = df[numeric_features].to_numpy(dtype=float)
        X = np.hstack([X_categorical, X_numeric])
        return X, encoder, categorical_features, numeric_features

    def retrain_demand(self, products_path: str, product_id: str, window_days: int = 60) -> Optional[str]:
        """Runs the retraining flow for demand model of a specific product."""
        logger.info(f"Retraining demand model for product {product_id}")
        df = self._load_product_df(products_path, product_id)

        train_df = get_sliding_window_data(df, window_days=window_days)
        val_threshold = train_df['date'].max() - pd.Timedelta(days=7)
        val_df = train_df[train_df['date'] > val_threshold]
        train_df = train_df[train_df['date'] <= val_threshold]

        prophet_train = prepare_prophet_data(train_df, 'date', 'sales')
        candidate_model = Prophet(yearly_seasonality=True, weekly_seasonality=True)
        candidate_model.fit(prophet_train)

        candidate_mape = self._evaluate_demand_model(candidate_model, val_df)

        model_name = f"demand_{product_id}"
        latest_meta = self.registry.get_latest_version(model_name)
        if latest_meta:
            current_mape = latest_meta['metrics'].get('mape', float('inf'))
            improvement = (current_mape - candidate_mape) / current_mape if current_mape != 0 else 0
            if improvement < 0.01:
                logger.warning(f"No significant improvement for {model_name}.")
                return None

        version_dir = self.registry.register_model(candidate_model, model_name, {"mape": float(candidate_mape)})
        return version_dir

    def retrain_price(self, products_path: str, product_id: str, window_days: int = 60) -> Optional[str]:
        """Runs the retraining flow for price model of a specific product."""
        logger.info(f"Retraining price model for product {product_id}")
        df = self._load_product_df(products_path, product_id)

        train_df = get_sliding_window_data(df, window_days=window_days)
        val_threshold = train_df['date'].max() - pd.Timedelta(days=7)
        val_df = train_df[train_df['date'] > val_threshold]
        train_df = train_df[train_df['date'] <= val_threshold]

        df_train_feats = create_time_features(train_df)
        features = ['price', 'day_of_week', 'month', 'is_weekend', 'month_sin', 'month_cos']
        X = df_train_feats[features]
        y = df_train_feats['sales']

        candidate_model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100)
        candidate_model.fit(X, y)

        candidate_mae = self._evaluate_price_model(candidate_model, val_df)

        model_name = f"price_{product_id}"
        latest_meta = self.registry.get_latest_version(model_name)
        if latest_meta:
            current_mae = latest_meta['metrics'].get('mae', float('inf'))
            improvement = (current_mae - candidate_mae) / current_mae if current_mae != 0 else 0
            if improvement < 0.01:
                logger.warning(f"No significant improvement for {model_name}.")
                return None

        version_dir = self.registry.register_model(candidate_model, model_name, {"mae": float(candidate_mae)})
        return version_dir

    def train_comparative_price_model(self, products_path: str) -> Optional[str]:
        """Trains a global model to predict price from category, location, and condition.
        Includes train/test split and R²/MAE evaluation metrics."""
        logger.info("Training Global Comparative Price Model...")
        with open(products_path, 'r') as f:
            data = json.load(f)

        all_records = []
        for product in data:
            cat = product['category']
            loc = product.get('location', 'Global')
            cond = product.get('condition', 'New')
            for entry in product['history']:
                all_records.append({
                    'category': cat,
                    'location': loc,
                    'condition': cond,
                    'price': entry['price'],
                    'sales': entry.get('sales', 0)
                })

        if not all_records:
            logger.warning("No records found for comparative training.")
            return None

        df = pd.DataFrame(all_records)

        cat_features = ['category', 'location', 'condition']
        X_raw = df[cat_features]
        y = df['price']

        encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
        X_encoded = encoder.fit_transform(X_raw)

        X_train, X_test, y_train, y_test = train_test_split(
            X_encoded, y, test_size=0.2, random_state=42
        )

        model = RandomForestRegressor(n_estimators=150, max_depth=10, random_state=42)
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)

        logger.info(f"Model Evaluation — MAE: ${mae:.2f}, R²: {r2:.4f}")

        bundle = {
            "model": model,
            "encoder": encoder,
            "features": cat_features
        }

        metrics = {
            "records": len(df),
            "train_size": len(X_train),
            "test_size": len(X_test),
            "mae": round(float(mae), 2),
            "r2_score": round(float(r2), 4),
            "categories": len(df['category'].unique()),
            "locations": len(df['location'].unique()),
        }

        version_dir = self.registry.register_model(bundle, "global_comparative_price", metrics)
        logger.success(f"Global Comparative Price Model registered: {version_dir}")
        return version_dir

    def train_sales_simulator_model(self, products_path: str) -> Optional[str]:
        """Trains a global simulator model to predict monthly sales from price and marketplace context."""
        logger.info("Training Global Sales Simulator Model...")
        monthly_df = build_monthly_simulator_dataset(products_path)

        if monthly_df.empty:
            logger.warning("No monthly records found for simulator training.")
            return None

        if len(monthly_df) < 10:
            logger.warning("Not enough monthly records to train the simulator reliably.")
            return None

        X, encoder, categorical_features, numeric_features = self._prepare_simulator_matrix(monthly_df, fit=True)
        y = monthly_df['monthly_sales'].to_numpy(dtype=float)

        X_train, X_test, y_train, y_test, train_df, test_df = train_test_split(
            X, y, monthly_df, test_size=0.2, random_state=42
        )

        model = xgb.XGBRegressor(
            objective='reg:squarederror',
            n_estimators=200,
            learning_rate=0.05,
            max_depth=4,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
        )
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2 = r2_score(y_test, y_pred)

        model_name = "sales_simulator_global"
        latest_meta = self.registry.get_latest_version(model_name)
        if latest_meta:
            current_mae = latest_meta['metrics'].get('mae', float('inf'))
            improvement = (current_mae - mae) / current_mae if current_mae not in (0, float('inf')) else 0
            if improvement < 0.01 and mae >= current_mae:
                logger.warning("No significant improvement for sales_simulator_global.")
                return None

        logger.info(f"Simulator Evaluation — MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.4f}")

        bundle = {
            "model": model,
            "encoder": encoder,
            "categorical_features": categorical_features,
            "numeric_features": numeric_features,
            "target": "monthly_sales",
        }

        metrics = {
            "records": len(monthly_df),
            "train_size": len(X_train),
            "test_size": len(X_test),
            "mae": round(float(mae), 2),
            "rmse": round(float(rmse), 2),
            "r2_score": round(float(r2), 4),
            "categories": int(monthly_df['category'].nunique()),
            "locations": int(monthly_df['location'].nunique()),
            "conditions": int(monthly_df['condition'].nunique()),
            "months": int(monthly_df['month_key'].nunique()),
        }

        version_dir = self.registry.register_model(bundle, model_name, metrics)
        logger.success(f"Global Sales Simulator Model registered: {version_dir}")
        return version_dir

    def run_full_retraining(self, products_path: str):
        """Retrains all models for all products in the database."""
        with open(products_path, 'r') as f:
            data = json.load(f)

        for product in data:
            p_id = product['id']
            self.retrain_demand(products_path, p_id)
            self.retrain_price(products_path, p_id)

        self.train_comparative_price_model(products_path)
        self.train_sales_simulator_model(products_path)

        logger.success("Full system retraining complete.")
