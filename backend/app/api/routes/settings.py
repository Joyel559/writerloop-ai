import ipaddress
import os
import re
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import get_cors_origins, get_settings
from app.schemas.settings import (
    GeminiKeyStatusResponse,
    GeminiKeyUpdateRequest,
    GeminiKeyUpdateResponse,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/gemini-key/status", response_model=GeminiKeyStatusResponse)
def gemini_key_status() -> GeminiKeyStatusResponse:
    settings = get_settings()
    active = (os.environ.get("GEMINI_API_KEY") or settings.gemini_api_key or "").strip()
    if not active:
        return GeminiKeyStatusResponse(configured=False)
    return GeminiKeyStatusResponse(configured=True)


@router.post("/gemini-key", response_model=GeminiKeyUpdateResponse)
def set_gemini_key(
    payload: GeminiKeyUpdateRequest,
    request: Request,
    x_setup_token: str | None = Header(default=None),
) -> GeminiKeyUpdateResponse:
    settings = get_settings()
    _validate_setup_request(request, x_setup_token)

    secret = payload.gemini_api_key.strip()
    _validate_secret(secret)

    os.environ["GEMINI_API_KEY"] = secret
    persisted = _upsert_env_value(settings.runtime_env_file_path, "GEMINI_API_KEY", secret)

    # Ensure all subsequent lookups re-read the latest runtime env state.
    get_settings.cache_clear()

    message = "Gemini key saved and activated."
    if not persisted:
        message = "Gemini key activated for this runtime, but .env persistence failed."

    return GeminiKeyUpdateResponse(
        configured=True,
        persisted_to_env=persisted,
        message=message,
    )


def _validate_setup_request(request: Request, provided_token: str | None) -> None:
    settings = get_settings()

    if settings.app_env not in {"development", "dev", "local", "test"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Gemini key setup endpoint is disabled outside development/test environments.",
        )

    required_token = settings.setup_access_token.strip()
    if required_token and provided_token != required_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid setup token.",
        )

    origin = (request.headers.get("origin") or "").strip()
    if origin:
        allowed_origins = set(get_cors_origins(settings))
        if origin not in allowed_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Origin is not allowed for Gemini key setup.",
            )

    client_host = request.client.host if request.client else ""
    if not _is_private_or_loopback(client_host):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Gemini key setup is allowed only from local/private network clients.",
        )

    # Extra hardening: if request is not true loopback, require an explicit setup token.
    # This prevents accidental LAN exposure when APP_ENV is still development.
    if not _is_loopback_host(client_host) and not required_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SETUP_ACCESS_TOKEN must be configured for non-loopback Gemini key setup requests.",
        )


def _is_private_or_loopback(host: str) -> bool:
    if not host:
        return False
    if host in {"localhost"}:
        return True
    try:
        ip = ipaddress.ip_address(host)
        return bool(ip.is_loopback or ip.is_private)
    except ValueError:
        return False


def _is_loopback_host(host: str) -> bool:
    if not host:
        return False
    if host in {"localhost"}:
        return True
    try:
        ip = ipaddress.ip_address(host)
        return bool(ip.is_loopback)
    except ValueError:
        return False


def _validate_secret(secret: str) -> None:
    if not secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gemini key cannot be empty.")
    if any(char in secret for char in ("\n", "\r", "\x00")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gemini key contains invalid characters.")
    if len(secret) < 20:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gemini key appears too short.")


def _upsert_env_value(env_path: str, key: str, value: str) -> bool:
    path = Path(env_path).expanduser()
    if not path.is_absolute():
        path = Path.cwd() / path

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            existing_lines = path.read_text(encoding="utf-8").splitlines()
        else:
            existing_lines = []

        key_pattern = re.compile(rf"^\s*{re.escape(key)}\s*=")
        updated_lines: list[str] = []
        seen = False

        for line in existing_lines:
            if key_pattern.match(line):
                if not seen:
                    updated_lines.append(f"{key}={value}")
                    seen = True
                continue
            updated_lines.append(line)

        if not seen:
            updated_lines.append(f"{key}={value}")

        rendered = "\n".join(updated_lines).rstrip() + "\n"
        path.write_text(rendered, encoding="utf-8")

        try:
            path.chmod(0o600)
        except OSError:
            # Not every environment supports chmod in the same way.
            pass

        return True
    except OSError:
        return False
