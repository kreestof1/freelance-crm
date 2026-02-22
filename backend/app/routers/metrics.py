"""Router /metrics — métriques Prometheus (format text/plain).

Exposed at GET /metrics.  Access should be restricted to internal networks or
a dedicated token in production; here we require a valid Bearer token so it's
protected by the same auth as the rest of the API.
"""
from __future__ import annotations

import math
import time
import threading
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()
CurrentUser = Annotated[User, Depends(get_current_user)]

# ── In-memory store (module-level singleton) ──────────────────────────────────

_lock = threading.Lock()

# http_requests_total{method, endpoint, status}
_request_counters: dict[tuple[str, str, str], int] = defaultdict(int)

# http_request_duration_seconds (cumsum + count per endpoint)
_duration_sum: dict[str, float] = defaultdict(float)
_duration_count: dict[str, int] = defaultdict(int)

# Histogram buckets (seconds)
_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, math.inf)
_duration_buckets: dict[str, dict[float, int]] = defaultdict(lambda: defaultdict(int))

_start_time = time.time()


def record_request(method: str, endpoint: str, status: int, duration_s: float) -> None:
    """Called by the request middleware for every HTTP request."""
    key = (method.upper(), endpoint, str(status))
    with _lock:
        _request_counters[key] += 1
        _duration_sum[endpoint] += duration_s
        _duration_count[endpoint] += 1
        for bucket in _BUCKETS:
            if duration_s <= bucket:
                _duration_buckets[endpoint][bucket] += 1


# ── Prometheus text format helpers ────────────────────────────────────────────

def _labels(**kw: str) -> str:
    parts = ",".join(f'{k}="{v}"' for k, v in kw.items())
    return f"{{{parts}}}"


def _build_metrics() -> str:
    lines: list[str] = []

    # ── process uptime ──────────────────────────────────────────────
    lines.append("# HELP process_uptime_seconds Time since process start")
    lines.append("# TYPE process_uptime_seconds gauge")
    lines.append(f"process_uptime_seconds {time.time() - _start_time:.2f}")

    # ── http_requests_total ─────────────────────────────────────────
    lines.append("# HELP http_requests_total Total HTTP requests")
    lines.append("# TYPE http_requests_total counter")
    with _lock:
        counters = dict(_request_counters)
        dur_sum = dict(_duration_sum)
        dur_count = dict(_duration_count)
        dur_buckets = {ep: dict(bk) for ep, bk in _duration_buckets.items()}

    for (method, endpoint, status), count in counters.items():
        lbl = _labels(method=method, endpoint=endpoint, status=status)
        lines.append(f"http_requests_total{lbl} {count}")

    # ── http_request_duration_seconds histogram ─────────────────────
    lines.append("# HELP http_request_duration_seconds Request duration histogram")
    lines.append("# TYPE http_request_duration_seconds histogram")
    for endpoint in dur_sum:
        bk = dur_buckets.get(endpoint, {})
        for bucket in _BUCKETS:
            le = "+Inf" if math.isinf(bucket) else str(bucket)
            val = bk.get(bucket, 0)
            lbl = _labels(endpoint=endpoint, le=le)
            lines.append(f"http_request_duration_seconds_bucket{lbl} {val}")
        lbl_sum = _labels(endpoint=endpoint)
        lines.append(f"http_request_duration_seconds_sum{lbl_sum} {dur_sum[endpoint]:.6f}")
        lines.append(f"http_request_duration_seconds_count{lbl_sum} {dur_count[endpoint]}")

    return "\n".join(lines) + "\n"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/metrics", response_class=PlainTextResponse, include_in_schema=False)
async def metrics_endpoint(current_user: CurrentUser) -> str:
    """Expose les métriques Prometheus. Accessible uniquement aux utilisateurs authentifiés."""
    return _build_metrics()
