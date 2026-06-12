from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import UUIDPrimaryKeyMixin, TimestampMixin


class Setting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "settings"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict)
    editor_mode: Mapped[str] = mapped_column(String(40), default="focus")
