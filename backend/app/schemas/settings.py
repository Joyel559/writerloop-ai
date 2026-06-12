from pydantic import BaseModel, Field


class GeminiKeyUpdateRequest(BaseModel):
    gemini_api_key: str = Field(min_length=20, max_length=256)


class GeminiKeyUpdateResponse(BaseModel):
    configured: bool
    persisted_to_env: bool
    message: str


class GeminiKeyStatusResponse(BaseModel):
    configured: bool
