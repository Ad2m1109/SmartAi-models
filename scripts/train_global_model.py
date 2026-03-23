import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from training.retraining_pipeline import RetrainingPipeline
from services.model_registry import ModelRegistry

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_STORAGE = os.path.join(ROOT_DIR, "models")
PRODUCTS_DATA = os.path.join(ROOT_DIR, "data/processed/products.json")

registry = ModelRegistry(MODEL_STORAGE)
pipeline = RetrainingPipeline(registry)

print("Starting Global Comparative Pricing Model training...")
pipeline.train_comparative_price_model(PRODUCTS_DATA)
print("Training complete!")
