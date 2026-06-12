from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import AnalysisJob, Document
from app.services.analysis import analyze_text
from app.worker.celery_app import celery_app


def process_document_analysis_job(job_id: str) -> dict:
    db = SessionLocal()
    job = None
    try:
        job = db.scalar(select(AnalysisJob).where(AnalysisJob.id == job_id))
        if not job:
            return {"error": "job_not_found"}

        document = db.scalar(select(Document).where(Document.id == job.document_id))
        if not document:
            job.status = "failed"
            job.error_message = "document_not_found"
            db.commit()
            return {"error": "document_not_found"}

        job.status = "running"
        job.progress = 15
        db.commit()

        report = analyze_text(document.content)

        job.status = "completed"
        job.progress = 100
        job.result = report.model_dump()
        db.commit()

        return report.model_dump()
    except Exception as exc:
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            db.commit()
        return {"error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="tasks.run_document_analysis")
def run_document_analysis(job_id: str) -> dict:
    return process_document_analysis_job(job_id)
