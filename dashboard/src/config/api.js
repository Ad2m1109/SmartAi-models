/**
 * Centralized API configuration for the SmartAI dashboard.
 * All backend URLs are managed here to avoid hardcoded values
 * scattered across components.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API = {
    BASE: API_BASE_URL,
    PREDICT_DEMAND: `${API_BASE_URL}/predict/demand`,
    PREDICT_PRICE: `${API_BASE_URL}/predict/price`,
    PREDICT_COMPARATIVE: `${API_BASE_URL}/predict/comparative-price`,
    PREDICT_SIMULATOR: `${API_BASE_URL}/predict/simulator`,
    PRODUCTS: `${API_BASE_URL}/products`,
    HEALTH: `${API_BASE_URL}/health`,
    ANALYTICS: `${API_BASE_URL}/analytics/summary`,
    MODELS_INVENTORY: `${API_BASE_URL}/models/inventory`,
    TRIGGER_RETRAIN: `${API_BASE_URL}/models/trigger-retrain`,
};

export default API;
