import os
import sys

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.model_registry import ModelRegistry
from training.retraining_pipeline import RetrainingPipeline

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_STORAGE = os.path.join(ROOT_DIR, "models")
PRODUCTS_DATA = os.path.join(ROOT_DIR, "data/processed/products.json")


def train_sales_simulator_model():
    registry = ModelRegistry(MODEL_STORAGE)
    pipeline = RetrainingPipeline(registry)
    return pipeline.train_sales_simulator_model(PRODUCTS_DATA)


if __name__ == "__main__":
    print("Starting Global Sales Simulator training...")
    result = train_sales_simulator_model()
    if result:
        print(f"Training complete: {result}")
    else:
        print("No new simulator model was registered.")
