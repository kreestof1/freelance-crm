"""Router /health — healthcheck avec trace_id."""
import structlog
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get("/health", response_model=None)
async def health(request: Request) -> JSONResponse:
    """Healthcheck endpoint."""
    ctx = structlog.contextvars.get_contextvars()
    trace_id = ctx.get("request_id", "")
    logger.info("health_check", trace_id=trace_id)
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "trace_id": trace_id},
    )
