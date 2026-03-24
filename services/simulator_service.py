import os
from typing import Any, Dict, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from loguru import logger

from utils.feature_engineering import build_monthly_simulator_dataset, create_time_features


class SimulatorService:
    def __init__(self, registry: Any, products_path: Optional[str] = None, pipeline: Optional[Any] = None):
        self.registry = registry
        self.products_path = products_path
        self.pipeline = pipeline
        self._monthly_cache: Optional[pd.DataFrame] = None
        self._monthly_cache_mtime: Optional[float] = None

    def _load_monthly_market_frame(self) -> pd.DataFrame:
        columns = [
            'product_id', 'category', 'location', 'condition', 'month_start', 'month_key',
            'avg_price', 'monthly_sales', 'observations', 'month', 'quarter',
            'month_sin', 'month_cos', 'category_key', 'location_key', 'condition_key'
        ]
        if not self.products_path or not os.path.exists(self.products_path):
            return pd.DataFrame(columns=columns)

        current_mtime = os.path.getmtime(self.products_path)
        if self._monthly_cache is not None and self._monthly_cache_mtime == current_mtime:
            return self._monthly_cache.copy()

        df = build_monthly_simulator_dataset(self.products_path)
        if df.empty:
            df = pd.DataFrame(columns=columns)
        else:
            df = df.copy()
            df['category_key'] = df['category'].astype(str).str.strip().str.lower()
            df['location_key'] = df['location'].astype(str).str.strip().str.lower()
            df['condition_key'] = df['condition'].astype(str).str.strip().str.lower()

        self._monthly_cache = df
        self._monthly_cache_mtime = current_mtime
        return df.copy()

    def _get_model_bundle(self) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        model_name = 'sales_simulator_global'
        metadata = self.registry.get_latest_version(model_name)

        if metadata and os.path.exists(metadata.get('path', '')):
            try:
                return joblib.load(metadata['path']), metadata
            except Exception as exc:
                logger.error(f"Failed to load simulator model {metadata['version']}: {exc}")

        if self.pipeline and self.products_path and os.path.exists(self.products_path):
            logger.info('No valid sales simulator model found. Training one on demand...')
            try:
                self.pipeline.train_sales_simulator_model(self.products_path)
                metadata = self.registry.get_latest_version(model_name)
                if metadata and os.path.exists(metadata.get('path', '')):
                    return joblib.load(metadata['path']), metadata
            except Exception as exc:
                logger.error(f"On-demand simulator training failed: {exc}")

        return None, None

    @staticmethod
    def _build_inference_frame(
        category: str,
        location: str,
        condition: Optional[str],
        price: float,
        forecast_date: Optional[str] = None,
    ) -> pd.DataFrame:
        if forecast_date:
            forecast_ts = pd.to_datetime(forecast_date)
        else:
            forecast_ts = pd.Timestamp.now()

        month_start = forecast_ts.to_period('M').to_timestamp()
        df = pd.DataFrame([{
            'category': category or 'General',
            'location': location or 'Global',
            'condition': condition or 'New',
            'avg_price': float(price),
            'month_start': month_start,
        }])
        df = create_time_features(df, date_col='month_start')
        df['month_key'] = df['month_start'].dt.strftime('%Y-%m')
        return df

    @staticmethod
    def _prepare_model_matrix(bundle: Dict[str, Any], feature_df: pd.DataFrame) -> np.ndarray:
        categorical_features = bundle.get('categorical_features', ['category', 'location', 'condition'])
        numeric_features = bundle.get('numeric_features', ['avg_price', 'month', 'quarter', 'month_sin', 'month_cos'])
        encoder = bundle['encoder']

        X_categorical = encoder.transform(feature_df[categorical_features])
        X_numeric = feature_df[numeric_features].to_numpy(dtype=float)
        return np.hstack([X_categorical, X_numeric])

    def _find_reference_subset(
        self,
        category: str,
        location: str,
        condition: Optional[str],
        forecast_month: int,
    ) -> Dict[str, Any]:
        df = self._load_monthly_market_frame()
        if df.empty:
            return {
                'subset': df,
                'coverage_subset': df,
                'matched_attributes': [],
                'match_level': 0,
                'reference_scope': 'global market',
                'sample_size': 0,
                'coverage_size': 0,
                'same_month_sample_size': 0,
                'fallback_used': True,
            }

        values = {
            'category': (category or '').strip().lower(),
            'location': (location or '').strip().lower(),
            'condition': (condition or '').strip().lower(),
        }
        columns = {
            'category': 'category_key',
            'location': 'location_key',
            'condition': 'condition_key',
        }

        match_orders = [
            ('category', 'location', 'condition'),
            ('category', 'location'),
            ('category', 'condition'),
            ('location', 'condition'),
            ('category',),
            ('location',),
            ('condition',),
            tuple(),
        ]

        for attrs in match_orders:
            if any(not values[attr] for attr in attrs):
                continue

            mask = pd.Series(True, index=df.index)
            for attr in attrs:
                mask &= df[columns[attr]] == values[attr]

            coverage_subset = df[mask]
            if coverage_subset.empty:
                continue

            same_month_subset = coverage_subset[coverage_subset['month'] == forecast_month]
            use_same_month = len(same_month_subset) >= 2
            reference_subset = same_month_subset if use_same_month else coverage_subset

            reference_scope = '/'.join(attrs) if attrs else 'global market'
            if use_same_month:
                reference_scope = f"{reference_scope} + same-month"

            return {
                'subset': reference_subset.copy(),
                'coverage_subset': coverage_subset.copy(),
                'matched_attributes': list(attrs),
                'match_level': len(attrs),
                'reference_scope': reference_scope,
                'sample_size': int(len(reference_subset)),
                'coverage_size': int(len(coverage_subset)),
                'same_month_sample_size': int(len(same_month_subset)),
                'fallback_used': len(attrs) < 3,
            }

        return {
            'subset': df.copy(),
            'coverage_subset': df.copy(),
            'matched_attributes': [],
            'match_level': 0,
            'reference_scope': 'global market',
            'sample_size': int(len(df)),
            'coverage_size': int(len(df)),
            'same_month_sample_size': int(len(df[df['month'] == forecast_month])),
            'fallback_used': True,
        }

    @staticmethod
    def _build_price_position(reference_subset: pd.DataFrame, price: float) -> Dict[str, Any]:
        if reference_subset.empty or 'avg_price' not in reference_subset.columns:
            return {
                'price_position': 'unknown',
                'benchmark_price': None,
                'pricing_signal': 'Limited comparable pricing data for this forecast.',
            }

        benchmark_series = reference_subset['avg_price'].astype(float)
        q25 = float(benchmark_series.quantile(0.25))
        q50 = float(benchmark_series.quantile(0.50))
        q75 = float(benchmark_series.quantile(0.75))

        if price <= q25:
            price_position = 'competitive'
            pricing_signal = 'Price is competitive compared to similar listings.'
        elif price >= q75:
            price_position = 'premium'
            pricing_signal = 'Price is above many similar listings, so demand may be softer.'
        else:
            price_position = 'market-aligned'
            pricing_signal = 'Price sits near the middle of similar listings.'

        return {
            'price_position': price_position,
            'benchmark_price': round(q50, 2),
            'benchmark_price_low': round(q25, 2),
            'benchmark_price_high': round(q75, 2),
            'pricing_signal': pricing_signal,
        }

    @staticmethod
    def _build_confidence(
        match_level: int,
        coverage_size: int,
        same_month_sample_size: int,
        reference_subset: pd.DataFrame,
        metadata: Optional[Dict[str, Any]],
    ) -> Tuple[float, str]:
        metrics = metadata.get('metrics', {}) if metadata else {}
        r2_score = float(metrics.get('r2_score', 0.5)) if metrics else 0.5

        if not reference_subset.empty and len(reference_subset) >= 2 and float(reference_subset['monthly_sales'].mean()) > 0:
            variation = float(reference_subset['monthly_sales'].std(ddof=0) / max(reference_subset['monthly_sales'].mean(), 1e-6))
        else:
            variation = 1.0

        match_score = {0: 0.08, 1: 0.17, 2: 0.27, 3: 0.36}[match_level]
        density_score = min(coverage_size / 12.0, 1.0) * 0.22
        seasonality_score = min(same_month_sample_size / 4.0, 1.0) * 0.08

        if variation <= 0.25:
            stability_score = 0.16
        elif variation <= 0.45:
            stability_score = 0.12
        elif variation <= 0.75:
            stability_score = 0.08
        else:
            stability_score = 0.04

        model_score = max(0.04, min(0.10, r2_score * 0.10))
        confidence = round(min(0.95, match_score + density_score + seasonality_score + stability_score + model_score), 2)
        confidence_basis = (
            'Confidence is based on attribute match quality, comparable-data density, '
            'same-season coverage, and forecast stability. It does not depend on your entered price.'
        )
        return confidence, confidence_basis

    @staticmethod
    def _build_sales_range(
        expected_sales: float,
        reference_subset: pd.DataFrame,
        coverage_size: int,
        match_level: int,
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, float]:
        metrics = metadata.get('metrics', {}) if metadata else {}
        base_rmse = float(metrics.get('rmse', max(2.0, expected_sales * 0.35))) if metrics else max(2.0, expected_sales * 0.35)

        if not reference_subset.empty and len(reference_subset) >= 2:
            local_std = float(reference_subset['monthly_sales'].std(ddof=0))
        else:
            local_std = base_rmse

        if not reference_subset.empty and len(reference_subset) >= 4:
            q25 = float(reference_subset['monthly_sales'].quantile(0.25))
            q75 = float(reference_subset['monthly_sales'].quantile(0.75))
            iqr = max(0.0, q75 - q25)
        else:
            q25 = None
            q75 = None
            iqr = 0.0

        uncertainty = max(base_rmse * 0.55, local_std * 0.70, iqr * 0.60, expected_sales * 0.12)
        uncertainty *= {0: 1.32, 1: 1.18, 2: 1.0, 3: 0.85}[match_level]
        if coverage_size < 4:
            uncertainty *= 1.15

        low = max(0.0, expected_sales - uncertainty)
        high = max(low, expected_sales + uncertainty)

        if q25 is not None and q75 is not None:
            low = max(0.0, min(low, q25))
            high = max(high, q75)

        return {
            'low': round(low, 1),
            'expected': round(max(0.0, expected_sales), 1),
            'high': round(high, 1),
        }

    @staticmethod
    def _annualize_range(range_payload: Dict[str, float]) -> Dict[str, float]:
        return {key: round(value * 12, 1) for key, value in range_payload.items()}

    @staticmethod
    def _revenue_range(range_payload: Dict[str, float], price: float) -> Dict[str, float]:
        return {key: round(value * price, 2) for key, value in range_payload.items()}

    @staticmethod
    def _build_market_signal(match_level: int, sample_size: int) -> str:
        if match_level == 3:
            return 'Exact market match'
        if match_level == 2:
            return '2-attribute market fallback'
        if match_level == 1:
            return '1-attribute market fallback'
        return 'Global market fallback'

    @staticmethod
    def _build_explanation(
        expected_sales: float,
        global_median_sales: float,
        pricing_signal: str,
        confidence: float,
        reference_scope: str,
        coverage_size: int,
    ) -> str:
        if global_median_sales <= 0:
            demand_signal = 'Demand forecast is based on the available marketplace history.'
        elif expected_sales >= global_median_sales * 1.25:
            demand_signal = 'High demand signal for this listing setup.'
        elif expected_sales >= global_median_sales * 0.9:
            demand_signal = 'Healthy demand signal for this market.'
        else:
            demand_signal = 'Demand looks softer than the broader marketplace baseline.'

        if confidence >= 0.80:
            coverage_signal = f'Strong comparable coverage from {reference_scope} supports this forecast.'
        elif confidence >= 0.60:
            coverage_signal = f'Comparable coverage from {reference_scope} is usable, but still somewhat limited.'
        else:
            coverage_signal = (
                f'Only limited comparable coverage was found for {reference_scope} '
                f'({coverage_size} records), so results may vary more than usual.'
            )

        return ' '.join([demand_signal, pricing_signal, coverage_signal])

    def predict_sales_forecast(
        self,
        category: str,
        location: str,
        condition: Optional[str],
        price: float,
        forecast_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        if price <= 0:
            return {'error': 'Price must be greater than 0.'}

        try:
            feature_df = self._build_inference_frame(category, location, condition, price, forecast_date)
        except Exception as exc:
            return {'error': f'Invalid forecast date: {exc}'}

        market_df = self._load_monthly_market_frame()
        forecast_month = int(feature_df.iloc[0]['month'])
        reference = self._find_reference_subset(category, location, condition, forecast_month)
        reference_subset = reference['subset']
        coverage_subset = reference['coverage_subset']

        bundle, metadata = self._get_model_bundle()
        expected_sales: Optional[float] = None
        version = 'fallback-market-v1'
        model_status = 'fallback'

        if bundle is not None and metadata is not None:
            try:
                X = self._prepare_model_matrix(bundle, feature_df)
                expected_sales = float(bundle['model'].predict(X)[0])
                version = metadata['version']
                model_status = 'ml_model'
            except Exception as exc:
                logger.error(f'Failed simulator inference with registered model: {exc}')

        if expected_sales is None:
            fallback_subset = reference_subset if not reference_subset.empty else market_df
            if fallback_subset.empty:
                expected_sales = 0.0
            else:
                expected_sales = float(fallback_subset['monthly_sales'].median())

        expected_sales = max(0.0, expected_sales)
        sales_range = self._build_sales_range(
            expected_sales=expected_sales,
            reference_subset=reference_subset,
            coverage_size=reference['coverage_size'],
            match_level=reference['match_level'],
            metadata=metadata,
        )
        yearly_sales_range = self._annualize_range(sales_range)
        monthly_revenue_range = self._revenue_range(sales_range, price)
        yearly_revenue_range = self._annualize_range(monthly_revenue_range)

        pricing_reference = reference_subset if not reference_subset.empty else coverage_subset
        price_meta = self._build_price_position(pricing_reference, price)
        confidence, confidence_basis = self._build_confidence(
            match_level=reference['match_level'],
            coverage_size=reference['coverage_size'],
            same_month_sample_size=reference['same_month_sample_size'],
            reference_subset=reference_subset,
            metadata=metadata,
        )

        global_median_sales = float(market_df['monthly_sales'].median()) if not market_df.empty else sales_range['expected']
        explanation = self._build_explanation(
            expected_sales=sales_range['expected'],
            global_median_sales=global_median_sales,
            pricing_signal=price_meta['pricing_signal'],
            confidence=confidence,
            reference_scope=reference['reference_scope'],
            coverage_size=reference['coverage_size'],
        )

        return {
            'mode': 'item',
            'category': category,
            'location': location,
            'condition': condition or 'New',
            'price': round(float(price), 2),
            'forecast_month': feature_df.iloc[0]['month_key'],
            'monthly_sales': sales_range,
            'yearly_sales': yearly_sales_range['expected'],
            'monthly_revenue': monthly_revenue_range['expected'],
            'yearly_revenue': yearly_revenue_range['expected'],
            'yearly_sales_range': yearly_sales_range,
            'monthly_revenue_range': monthly_revenue_range,
            'yearly_revenue_range': yearly_revenue_range,
            'confidence': confidence,
            'confidence_basis': confidence_basis,
            'explanation': explanation,
            'version': version,
            'model_status': model_status,
            'market_signal': self._build_market_signal(reference['match_level'], reference['sample_size']),
            'reference_scope': reference['reference_scope'],
            'matched_attributes': reference['matched_attributes'],
            'sample_size': reference['sample_size'],
            'coverage_size': reference['coverage_size'],
            'same_month_sample_size': reference['same_month_sample_size'],
            'price_position': price_meta['price_position'],
            'benchmark_price': price_meta['benchmark_price'],
            'benchmark_price_low': price_meta.get('benchmark_price_low'),
            'benchmark_price_high': price_meta.get('benchmark_price_high'),
            'fallback_used': bool(reference['fallback_used'] or model_status != 'ml_model'),
        }
