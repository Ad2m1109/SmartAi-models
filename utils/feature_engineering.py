import pandas as pd
import numpy as np
from typing import List, Tuple

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
