from datetime import datetime
from pydantic import BaseModel


class DocumentCreateRequest(BaseModel):
    title: str
    content: str


class DocumentResponse(BaseModel):
    id: str
    title: str
    status: str
    word_count: int
    created_at: datetime
    updated_at: datetime


class DocumentContentResponse(DocumentResponse):
    content: str
