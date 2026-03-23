import json
import os
import re
from typing import Any, Dict, List, Optional, Set

import joblib
import pandas as pd
from loguru import logger

from utils.feature_engineering import create_time_features


class PriceService:
    def __init__(self, registry: Any, products_path: Optional[str] = None):
        self.registry = registry
        self.products_path = products_path
        self._market_cache: Optional[pd.DataFrame] = None
        self._market_cache_mtime: Optional[float] = None

    def _get_model(self, product_id: str):
        """Fetches the latest production model for a specific product."""
        model_name = f"price_{product_id}"
        metadata = self.registry.get_latest_version(model_name)
        if metadata:
            model = joblib.load(metadata['path'])
            return model, metadata['version']
        return None, None

    def _load_market_frame(self) -> pd.DataFrame:
        columns = ['category', 'location', 'condition', 'price', 'category_key', 'location_key', 'condition_key']
        if not self.products_path or not os.path.exists(self.products_path):
            return pd.DataFrame(columns=columns)

        current_mtime = os.path.getmtime(self.products_path)
        if self._market_cache is not None and self._market_cache_mtime == current_mtime:
            return self._market_cache.copy()

        with open(self.products_path, 'r') as f:
            data = json.load(f)

        rows = []
        for product in data:
            category = product.get('category', 'General')
            location = product.get('location', 'Global')
            condition = product.get('condition', 'New')
            for entry in product.get('history', []):
                rows.append({
                    'category': category,
                    'location': location,
                    'condition': condition,
                    'price': float(entry.get('price', 0)),
                })

        df = pd.DataFrame(rows)
        if df.empty:
            df = pd.DataFrame(columns=columns)
        else:
            df['category_key'] = df['category'].astype(str).str.strip().str.lower()
            df['location_key'] = df['location'].astype(str).str.strip().str.lower()
            df['condition_key'] = df['condition'].astype(str).str.strip().str.lower()

        self._market_cache = df
        self._market_cache_mtime = current_mtime
        return df.copy()

    def _get_market_anchor(self, category: str, location: str, condition: Optional[str] = None) -> Dict[str, Any]:
        df = self._load_market_frame()
        if df.empty:
            return {
                'reference_price': 95.0,
                'sample_size': 0,
                'reference_scope': 'default market baseline',
            }

        category_key = (category or '').strip().lower()
        location_key = (location or '').strip().lower()
        condition_key = (condition or '').strip().lower()

        candidate_masks = []
        if category_key and location_key and condition_key:
            candidate_masks.append((
                (df['category_key'] == category_key)
                & (df['location_key'] == location_key)
                & (df['condition_key'] == condition_key),
                'category/location/condition',
            ))
        if category_key and location_key:
            candidate_masks.append((
                (df['category_key'] == category_key) & (df['location_key'] == location_key),
                'category/location',
            ))
        if category_key:
            candidate_masks.append((df['category_key'] == category_key, 'category'))
        if location_key:
            candidate_masks.append((df['location_key'] == location_key, 'location'))
        candidate_masks.append((pd.Series(True, index=df.index), 'global market'))

        for mask, label in candidate_masks:
            subset = df[mask]
            if not subset.empty:
                return {
                    'reference_price': float(subset['price'].median()),
                    'sample_size': int(len(subset)),
                    'reference_scope': label,
                }

        return {
            'reference_price': 95.0,
            'sample_size': 0,
            'reference_scope': 'default market baseline',
        }

    def _get_smoothed_anchor(self, category: str, location: str, condition: Optional[str] = None) -> Dict[str, Any]:
        anchor = self._get_market_anchor(category, location, condition)
        global_anchor = self._get_market_anchor('', '', None)

        if anchor['reference_scope'] == 'category':
            anchor['reference_price'] = (anchor['reference_price'] * 0.7) + (global_anchor['reference_price'] * 0.3)
            anchor['reference_scope'] = 'blended category/global'
        elif anchor['reference_scope'] in {'location', 'global market'}:
            anchor['reference_price'] = (anchor['reference_price'] * 0.2) + (global_anchor['reference_price'] * 0.8)
            anchor['reference_scope'] = 'blended location/global'

        return anchor

    @staticmethod
    def _extract_keywords(*values: Optional[str]) -> Set[str]:
        words: Set[str] = set()
        for value in values:
            if not value:
                continue
            words.update(
                word for word in re.findall(r"[a-z0-9+\-]+", str(value).lower())
                if len(word) >= 3
            )
        return words

    @staticmethod
    def _clamp_price(value: float, minimum: float = 10.0, maximum: float = 5000.0) -> float:
        return float(max(minimum, min(maximum, value)))

    @staticmethod
    def _round_price(value: float, step: float = 5.0) -> float:
        return round(round(value / step) * step, 2)

    def _build_price_window(self, recommended_price: float, spread: float, step: Optional[float] = None):
        lower = self._clamp_price(recommended_price * (1 - spread))
        upper = self._clamp_price(recommended_price * (1 + spread))

        if step:
            return self._round_price(lower, step), self._round_price(upper, step)
        return round(lower, 2), round(upper, 2)

    @staticmethod
    def _confidence_band(sample_size: int) -> float:
        if sample_size >= 20:
            return 0.2
        if sample_size >= 10:
            return 0.16
        if sample_size >= 5:
            return 0.11
        if sample_size >= 3:
            return 0.07
        if sample_size >= 1:
            return 0.03
        return 0.0

    def _build_item_confidence(self, match_level: int, sample_size: int, used_ml: bool) -> float:
        base = 0.34
        base += {0: 0.0, 1: 0.08, 2: 0.18, 3: 0.28}[match_level]
        base += self._confidence_band(sample_size)
        if used_ml:
            base += 0.06
        return round(min(base, 0.92), 2)

    def _build_heuristic_confidence(self, reference_scope: str, sample_size: int) -> float:
        base = 0.4
        if reference_scope == 'category/location/condition':
            base += 0.22
        elif reference_scope == 'category/location':
            base += 0.16
        elif 'category' in reference_scope:
            base += 0.12
        elif 'location' in reference_scope:
            base += 0.08
        else:
            base += 0.04

        base += self._confidence_band(sample_size)
        return round(min(base, 0.84), 2)

    @staticmethod
    def _input_influence_meta(weight: float) -> Dict[str, Any]:
        if weight <= 0:
            label = 'None'
        elif weight <= 0.15:
            label = 'Low'
        elif weight <= 0.3:
            label = 'Moderate'
        else:
            label = 'High'

        return {
            'input_influence_pct': int(round(weight * 100)),
            'input_influence_label': label,
            'confidence_is_input_independent': True,
        }

    def _find_best_market_match(self, category: str, location: str, condition: Optional[str] = None) -> Dict[str, Any]:
        df = self._load_market_frame()
        if df.empty:
            return {
                'subset': df,
                'matched_attributes': [],
                'missing_attributes': ['category', 'location', 'condition'],
                'reference_scope': 'global market',
                'sample_size': 0,
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

            subset = df[mask]
            if not subset.empty:
                return {
                    'subset': subset.copy(),
                    'matched_attributes': list(attrs),
                    'missing_attributes': [attr for attr in ['category', 'location', 'condition'] if attr not in attrs],
                    'reference_scope': '/'.join(attrs) if attrs else 'global market',
                    'sample_size': int(len(subset)),
                }

        return {
            'subset': df.copy(),
            'matched_attributes': [],
            'missing_attributes': ['category', 'location', 'condition'],
            'reference_scope': 'global market',
            'sample_size': int(len(df)),
        }

    def _build_observed_range(self, subset: pd.DataFrame, reference_price: float) -> Dict[str, float]:
        if subset.empty or 'price' not in subset.columns:
            low_price, high_price = self._build_price_window(reference_price, 0.2)
            return {'low': low_price, 'high': high_price}

        sample_size = len(subset)
        if sample_size >= 4:
            low_price = round(self._clamp_price(float(subset['price'].quantile(0.25))), 2)
            high_price = round(self._clamp_price(float(subset['price'].quantile(0.75))), 2)
            if high_price > low_price:
                return {'low': low_price, 'high': high_price}

        spread = 0.12 if sample_size >= 10 else 0.18 if sample_size >= 4 else 0.26
        low_price, high_price = self._build_price_window(reference_price, spread)
        return {'low': low_price, 'high': high_price}

    def recommend_price(self, product_id: str, date: str, potential_prices: List[float]) -> Dict[str, Any]:
        """
        Predicts demand for different price points for a specific product.
        """
        model, version = self._get_model(product_id)

        if model is None:
            return {"error": f"Model for product {product_id} not found."}

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

    def _predict_item_price(self, category: str, location: str, condition: str) -> Dict[str, Any]:
        market_match = self._find_best_market_match(category, location, condition)
        subset = market_match['subset']
        observed_price = float(subset['price'].median()) if not subset.empty else 95.0
        observed_range = self._build_observed_range(subset, observed_price)
        low_price = observed_range['low']
        high_price = observed_range['high']

        matched_attributes = market_match['matched_attributes']
        reference_scope = market_match['reference_scope']
        sample_size = market_match['sample_size']
        match_level = len(matched_attributes)
        missing_attributes = market_match['missing_attributes']

        recommended_price = round(float(min(max(observed_price, low_price), high_price)), 2)
        confidence = self._build_item_confidence(match_level, sample_size, used_ml=False)
        version = "comparative_backoff_range-v1"
        pricing_strategy = "comparative_backoff_range"
        market_signal = "Global market fallback"
        explanation = "Using a broad market range because no direct attribute match was found."
        input_meta = self._input_influence_meta(0.0)

        if match_level == 3:
            metadata = self.registry.get_latest_version("global_comparative_price")
            if metadata:
                try:
                    bundle = joblib.load(metadata['path'])
                    model = bundle['model']
                    encoder = bundle['encoder']

                    input_df = pd.DataFrame([{
                        'category': category,
                        'location': location,
                        'condition': condition
                    }])

                    X_encoded = encoder.transform(input_df)
                    ml_prediction = float(model.predict(X_encoded)[0])
                    blended_price = (observed_price * 0.6) + (ml_prediction * 0.4)
                    recommended_price = round(float(min(max(blended_price, low_price), high_price)), 2)
                    confidence = self._build_item_confidence(match_level, sample_size, used_ml=True)
                    version = metadata['version']
                    pricing_strategy = "comparative_ml_range"
                    market_signal = "Exact 3-attribute market match"
                    explanation = "Exact category, location, and condition match found. Range comes from observed market prices, with the center benchmark blended with the ML model."
                except Exception as e:
                    logger.error(f"Comparative price prediction failed: {str(e)}")
                    market_signal = "Exact 3-attribute market match"
                    explanation = "Exact category, location, and condition match found. Range comes from observed market prices after the ML step was unavailable."
            else:
                market_signal = "Exact 3-attribute market match"
                explanation = "Exact category, location, and condition match found. Range comes from observed market prices because the comparative model is unavailable."
        elif match_level == 2:
            market_signal = "2-attribute market fallback"
            explanation = f"No exact 3-attribute match found, so the range is based on {reference_scope.replace('/', ' + ')} only."
        elif match_level == 1:
            market_signal = "1-attribute market fallback"
            explanation = f"Only {reference_scope.replace('/', ' + ')} matched the market data, so the range is intentionally wider."

        return {
            "mode": "item",
            "category": category,
            "location": location,
            "condition": condition,
            "recommended_price": recommended_price,
            "suggested_min_price": low_price,
            "suggested_max_price": high_price,
            "confidence": confidence,
            "version": version,
            "pricing_strategy": pricing_strategy,
            "price_label": "Suggested listing range",
            "market_signal": market_signal,
            "reference_scope": reference_scope,
            "matched_attributes": matched_attributes,
            "missing_attributes": missing_attributes,
            "sample_size": sample_size,
            "explanation": explanation,
            "confidence_basis": "Confidence is based on attribute match quality, comparable sample size, and ML availability when an exact market match exists.",
            **input_meta,
        }

    def _predict_service_price(
        self,
        category: str,
        location: str,
        title: Optional[str],
        details: Optional[str],
        audience: Optional[str],
        shipping: Optional[str],
        is_urgent: bool,
        target_price: Optional[float],
    ) -> Dict[str, Any]:
        anchor = self._get_smoothed_anchor(category, location)
        keywords = self._extract_keywords(category, title, details, audience, shipping)

        premium_keywords = {'expert', 'professional', 'certified', 'consulting', 'repair', 'installation', 'custom', 'strategy'}
        lighter_keywords = {'basic', 'simple', 'quick', 'small', 'starter', 'minor'}
        urgency_keywords = {'urgent', 'asap', 'today', 'weekend', 'emergency'}

        multiplier = 0.58
        multiplier += 0.05 * len(keywords & premium_keywords)
        multiplier -= 0.03 * len(keywords & lighter_keywords)

        if audience == 'Professional/B2B':
            multiplier += 0.12
        elif audience == 'Collectors':
            multiplier += 0.06

        if shipping == 'I come to you (Service)':
            multiplier += 0.08
        if is_urgent or (keywords & urgency_keywords):
            multiplier += 0.1

        raw_price = anchor['reference_price'] * max(0.35, multiplier)
        input_weight = 0.0
        if target_price and anchor['sample_size'] < 6:
            input_weight = 0.2
            raw_price = (raw_price * (1 - input_weight)) + (target_price * input_weight)

        recommended_price = self._round_price(self._clamp_price(raw_price), 5.0)
        spread = 0.18 if anchor['sample_size'] >= 6 else 0.25
        low_price, high_price = self._build_price_window(recommended_price, spread, step=5.0)

        confidence = self._build_heuristic_confidence(anchor['reference_scope'], anchor['sample_size'])
        market_signal = "High-intent service market" if is_urgent or audience == 'Professional/B2B' else "Service market benchmark"
        input_meta = self._input_influence_meta(input_weight)

        return {
            "mode": "service",
            "category": category,
            "location": location,
            "recommended_price": recommended_price,
            "suggested_min_price": low_price,
            "suggested_max_price": high_price,
            "confidence": confidence,
            "version": "heuristic-service-v1",
            "pricing_strategy": "service_heuristic",
            "price_label": "Suggested service range",
            "market_signal": market_signal,
            "reference_scope": anchor['reference_scope'],
            "explanation": f"Heuristic service rate anchored to {anchor['reference_scope']} pricing, then adjusted for urgency, audience, and delivery context.",
            "sample_size": anchor['sample_size'],
            "confidence_basis": "Confidence is based on the amount and closeness of market comparables used for the estimate, not on your entered rate.",
            **input_meta,
        }

    def _predict_help_budget(
        self,
        category: str,
        location: str,
        title: Optional[str],
        details: Optional[str],
        audience: Optional[str],
        shipping: Optional[str],
        is_urgent: bool,
        target_price: Optional[float],
    ) -> Dict[str, Any]:
        anchor = self._get_smoothed_anchor(category, location)
        keywords = self._extract_keywords(category, title, details, audience, shipping)

        larger_scope_keywords = {'moving', 'painting', 'assembly', 'installation', 'renovation', 'deep', 'full', 'weekend'}
        smaller_scope_keywords = {'quick', 'simple', 'minor', 'small', 'basic'}
        urgency_keywords = {'urgent', 'asap', 'today', 'emergency'}

        multiplier = 0.48
        multiplier += 0.05 * len(keywords & larger_scope_keywords)
        multiplier -= 0.03 * len(keywords & smaller_scope_keywords)

        if audience == 'Professional/B2B':
            multiplier += 0.08
        if shipping == 'I come to you (Service)':
            multiplier += 0.04
        if is_urgent or (keywords & urgency_keywords):
            multiplier += 0.12

        raw_budget = anchor['reference_price'] * max(0.3, multiplier)
        input_weight = 0.0
        if target_price and anchor['sample_size'] < 6:
            input_weight = 0.25
            raw_budget = (raw_budget * (1 - input_weight)) + (target_price * input_weight)

        recommended_budget = self._round_price(self._clamp_price(raw_budget), 5.0)
        spread = 0.22 if anchor['sample_size'] >= 6 else 0.3
        low_price, high_price = self._build_price_window(recommended_budget, spread, step=5.0)

        confidence = self._build_heuristic_confidence(anchor['reference_scope'], anchor['sample_size'])
        market_signal = "Urgent help request window" if is_urgent else "Help-request budget benchmark"
        input_meta = self._input_influence_meta(input_weight)

        return {
            "mode": "help",
            "category": category,
            "location": location,
            "recommended_price": recommended_budget,
            "suggested_min_price": low_price,
            "suggested_max_price": high_price,
            "confidence": confidence,
            "version": "heuristic-help-v1",
            "pricing_strategy": "help_budget_heuristic",
            "price_label": "Suggested request budget range",
            "market_signal": market_signal,
            "reference_scope": anchor['reference_scope'],
            "explanation": f"Heuristic request budget anchored to {anchor['reference_scope']} pricing, then adjusted for scope and urgency.",
            "sample_size": anchor['sample_size'],
            "confidence_basis": "Confidence is based on the amount and closeness of market comparables used for the estimate, not on your entered budget.",
            **input_meta,
        }

    def predict_comparative_price(
        self,
        category: str,
        location: str,
        condition: Optional[str] = 'New',
        mode: str = 'item',
        title: Optional[str] = None,
        details: Optional[str] = None,
        audience: Optional[str] = None,
        shipping: Optional[str] = None,
        is_urgent: bool = False,
        target_price: Optional[float] = None,
    ) -> Dict[str, Any]:
        normalized_mode = (mode or 'item').strip().lower()
        if normalized_mode not in {'item', 'service', 'help'}:
            return {"error": "Invalid mode. Must be one of: item, service, help."}

        if normalized_mode == 'item':
            return self._predict_item_price(category, location, condition or 'New')
        if normalized_mode == 'service':
            return self._predict_service_price(
                category=category,
                location=location,
                title=title,
                details=details,
                audience=audience,
                shipping=shipping,
                is_urgent=is_urgent,
                target_price=target_price,
            )
        return self._predict_help_budget(
            category=category,
            location=location,
            title=title,
            details=details,
            audience=audience,
            shipping=shipping,
            is_urgent=is_urgent,
            target_price=target_price,
        )
