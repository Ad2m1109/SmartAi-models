import os
from apscheduler.schedulers.background import BackgroundScheduler
from loguru import logger
from training.retraining_pipeline import RetrainingPipeline

class model_scheduler:
    def __init__(self, pipeline: RetrainingPipeline, products_path: str):
        self.pipeline = pipeline
        self.products_path = products_path
        self.scheduler = BackgroundScheduler()

    def start(self):
        """Starts the background scheduler with defined jobs."""
        
        # Job: Full System Retraining (Daily at midnight)
        # This will iterate through all products in products.json
        self.scheduler.add_job(
            self.pipeline.run_full_retraining,
            'cron',
            hour=0,
            minute=0,
            args=[self.products_path],
            id='full_system_retrain_daily'
        )
        
        self.scheduler.start()
        logger.info("Retraining scheduler started with full system sync.")
        for job in self.scheduler.get_jobs():
            logger.info(f"Scheduled job: {job.id} - Next run: {job.next_run_time}")

    def shutdown(self):
        self.scheduler.shutdown()
        logger.info("Retraining scheduler stopped.")
