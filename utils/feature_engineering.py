import json
from typing import List, Tuple

import numpy as np
import pandas as pd


def preprocess_time_series(df: pd.DataFrame, date_col: str = 'date') -> pd.DataFrame:
    """
    Standardizes the time series data by converting the date column to datetime
    and sorting the dataframe.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(by=date_col)
    return df


def create_time_features(df: pd.DataFrame, date_col: str = 'date') -> pd.DataFrame:
    """
    Extracts cyclical and categorical time features from a datetime column.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])

    # Standard time features
    df['day_of_week'] = df[date_col].dt.dayofweek
    df['month'] = df[date_col].dt.month
    df['quarter'] = df[date_col].dt.quarter
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

    # Cyclical encoding for month (to capture seasonality)
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)

    return df


def prepare_prophet_data(df: pd.DataFrame, date_col: str, target_col: str) -> pd.DataFrame:
    """
    Formats data for Facebook Prophet (ds, y columns).
    """
    return df.reset_index()[[date_col, target_col]].rename(columns={date_col: 'ds', target_col: 'y'})


def scale_features(df: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
    """
    Basic min-max scaling for non-categorical features.
    """
    df = df.copy()
    for col in columns:
        if col in df.columns:
            min_val = df[col].min()
            max_val = df[col].max()
            if max_val > min_val:
                df[col] = (df[col] - min_val) / (max_val - min_val)
    return df


def get_sliding_window_data(df: pd.DataFrame, window_days: int = 30, date_col: str = 'date') -> pd.DataFrame:
    """
    Returns data within the last N days relative to the latest date in the dataframe.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    latest_date = df[date_col].max()
    threshold_date = latest_date - pd.Timedelta(days=window_days)

    return df[df[date_col] > threshold_date].copy()


def build_monthly_simulator_dataset(products_path: str) -> pd.DataFrame:
    """
    Aggregates products.json into a monthly dataset for simulator training.
    Each row represents one product-month with average price and total monthly sales.
    """
    with open(products_path, 'r') as f:
        data = json.load(f)

    records = []
    for product in data:
        category = product.get('category', 'General')
        location = product.get('location', 'Global')
        condition = product.get('condition', 'New')
        product_id = product.get('id')

        for entry in product.get('history', []):
            records.append({
                'product_id': product_id,
                'category': category,
                'location': location,
                'condition': condition,
                'date': entry.get('date'),
                'price': float(entry.get('price', 0)),
                'sales': float(entry.get('sales', 0)),
            })

    if not records:
        return pd.DataFrame(columns=[
            'product_id', 'category', 'location', 'condition', 'month_start', 'month_key',
            'avg_price', 'monthly_sales', 'observations', 'month', 'quarter',
            'month_sin', 'month_cos', 'is_weekend', 'day_of_week'
        ])

    df = pd.DataFrame(records)
    df = preprocess_time_series(df)
    df['month_start'] = df['date'].dt.to_period('M').dt.to_timestamp()

    monthly = (
        df.groupby(['product_id', 'category', 'location', 'condition', 'month_start'], as_index=False)
        .agg(
            avg_price=('price', 'mean'),
            monthly_sales=('sales', 'sum'),
            observations=('sales', 'count'),
        )
    )

    monthly['month_key'] = monthly['month_start'].dt.strftime('%Y-%m')
    monthly = create_time_features(monthly, date_col='month_start')
    return monthly
