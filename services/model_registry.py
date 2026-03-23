import os
import json
import joblib
import shutil
from datetime import datetime
from typing import Dict, Any, Optional, List
from loguru import logger

class ModelRegistry:
    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)

    def _get_model_dir(self, model_type: str) -> str:
        path = os.path.join(self.base_path, model_type)
        os.makedirs(path, exist_ok=True)
        return path

    def register_model(self, model: Any, model_type: str, metrics: Dict[str, float]) -> str:
        """
        Saves a new model version with metadata.
        """
        model_dir = self._get_model_dir(model_type)
        
        # Determine next version
        existing_versions = [d for d in os.listdir(model_dir) if d.startswith('v') and os.path.isdir(os.path.join(model_dir, d))]
        version_nums = [int(v[1:]) for v in existing_versions if v[1:].isdigit()]
        next_version = f"v{max(version_nums or [0]) + 1}"
        
        version_dir = os.path.join(model_dir, next_version)
        os.makedirs(version_dir, exist_ok=True)
        
        # Save model
        model_path = os.path.join(version_dir, "model.joblib")
        joblib.dump(model, model_path)
        
        # Save metadata
        metadata = {
            "version": next_version,
            "type": model_type,
            "training_date": datetime.now().isoformat(),
            "metrics": metrics,
            "path": model_path
        }
        with open(os.path.join(version_dir, "metadata.json"), 'w') as f:
            json.dump(metadata, f, indent=4)
            
        logger.info(f"Registered new {model_type} model version: {next_version}")
        return version_dir

    def get_latest_version(self, model_type: str) -> Optional[Dict[str, Any]]:
        """Returns metadata of the latest version."""
        model_dir = os.path.join(self.base_path, model_type)
        if not os.path.exists(model_dir):
            return None
            
        versions = [d for d in os.listdir(model_dir) if d.startswith('v')]
        if not versions:
            return None
            
        latest_v = sorted(versions, key=lambda v: int(v[1:]))[-1]
        metadata_path = os.path.join(model_dir, latest_v, "metadata.json")
        
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                return json.load(f)
        return None

    def get_production_model(self, model_type: str) -> Optional[Any]:
        """Loads and returns the latest validated model."""
        metadata = self.get_latest_version(model_type)
        if metadata and os.path.exists(metadata['path']):
            return joblib.load(metadata['path'])
        return None

    def list_inventory(self, model_type: str) -> List[Dict[str, Any]]:
        """Lists all versions and their metrics."""
        model_dir = os.path.join(self.base_path, model_type)
        inventory = []
        if not os.path.exists(model_dir):
            return inventory
            
        versions = sorted([d for d in os.listdir(model_dir) if d.startswith('v')], key=lambda v: int(v[1:]))
        for v in versions:
            meta_path = os.path.join(model_dir, v, "metadata.json")
            if os.path.exists(meta_path):
                with open(meta_path, 'r') as f:
                    inventory.append(json.load(f))
        return inventory
