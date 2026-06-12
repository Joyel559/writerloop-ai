from fastapi import BackgroundTasks

from app.core.config import get_settings
from app.tasks.analysis_tasks import process_document_analysis_job


def normalize_task_mode(raw_mode: str) -> str:
    mode = (raw_mode or "").strip().lower()
    if mode in {"inline", "background", "celery"}:
        return mode
    return "background"


def enqueue_document_analysis(job_id: str, background_tasks: BackgroundTasks | None = None) -> tuple[str, str]:
    """
    Returns:
        execution_mode: inline | background | celery
        message: human-readable dispatch result
    """
    settings = get_settings()
    mode = normalize_task_mode(settings.task_execution_mode)

    if mode == "celery":
        try:
            from app.tasks.analysis_tasks import run_document_analysis

            run_document_analysis.delay(job_id)
            return "celery", "Queued via Celery worker."
        except Exception:
            # Safe fallback when Redis/Celery are unavailable in lightweight setups.
            mode = "background"

    if mode == "background" and background_tasks is not None:
        background_tasks.add_task(process_document_analysis_job, job_id)
        return "background", "Queued via FastAPI BackgroundTasks."

    process_document_analysis_job(job_id)
    return "inline", "Executed inline on API process."
