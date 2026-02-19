"""Configuration OpenTelemetry — traces, métriques, logs."""
from __future__ import annotations

import structlog
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.config import get_settings

logger = structlog.get_logger(__name__)


def configure_telemetry() -> None:
    """Initialise OpenTelemetry selon l'environnement."""
    settings = get_settings()

    provider = TracerProvider()

    if settings.applicationinsights_connection_string:
        try:
            from azure.monitor.opentelemetry.exporter import AzureMonitorTraceExporter

            exporter = AzureMonitorTraceExporter.from_connection_string(
                settings.applicationinsights_connection_string
            )
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("telemetry.azure_monitor_enabled")
        except Exception as exc:
            logger.warning("telemetry.azure_monitor_init_failed", error=str(exc))

    elif settings.otlp_exporter_endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

            exporter = OTLPSpanExporter(endpoint=settings.otlp_exporter_endpoint)
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("telemetry.otlp_enabled", endpoint=settings.otlp_exporter_endpoint)
        except Exception as exc:
            logger.warning("telemetry.otlp_init_failed", error=str(exc))

    trace.set_tracer_provider(provider)

    # Instrumentation FastAPI + SQLAlchemy
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        FastAPIInstrumentor().instrument()
        SQLAlchemyInstrumentor().instrument()
    except Exception as exc:
        logger.warning("telemetry.instrumentation_failed", error=str(exc))
