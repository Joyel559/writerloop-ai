from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import UUIDPrimaryKeyMixin, TimestampMixin


class FeedbackReport(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "feedback_reports"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)

    grammar_score: Mapped[int] = mapped_column(Integer, default=0)
    clarity_score: Mapped[int] = mapped_column(Integer, default=0)
    logic_score: Mapped[int] = mapped_column(Integer, default=0)
    structure_score: Mapped[int] = mapped_column(Integer, default=0)
    tone_score: Mapped[int] = mapped_column(Integer, default=0)
    overall_score: Mapped[int] = mapped_column(Integer, default=0)
    readability_score: Mapped[float] = mapped_column(Float, default=0)

    issues: Mapped[list] = mapped_column(JSONB, default=list)
    recommendations: Mapped[list] = mapped_column(JSONB, default=list)


class AIConversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_conversations"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    extra_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
