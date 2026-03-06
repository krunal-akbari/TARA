from app.tasks.celery_app import celery_app


@celery_app.task(name="resume.process")
def process_resume(candidate_resume_id: int) -> dict:
    # Parser integration intentionally deferred; task exists for queue/retry scaffolding.
    return {"candidate_resume_id": candidate_resume_id, "status": "pending"}
