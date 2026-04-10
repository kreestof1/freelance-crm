"""Schémas Pydantic — Dashboard pipeline & forecast."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class StageAggregate(BaseModel):
    """Agrégat par étape du pipeline."""
    stage: str
    count: int
    total_amount: Decimal
    weighted_amount: Decimal
    color: str | None = None


class PipelineDashboard(BaseModel):
    """Vue d'ensemble du pipeline par étape."""
    stages: list[StageAggregate]
    total_count: int
    total_amount: Decimal
    total_weighted: Decimal


class ForecastPeriod(BaseModel):
    """Prévision sur une période donnée."""
    label: str
    period_start: date
    period_end: date
    count: int
    total_amount: Decimal
    weighted_amount: Decimal


class ForecastDashboard(BaseModel):
    """Forecast : mois courant + 3 mois glissants."""
    current_month: ForecastPeriod
    next_3_months: list[ForecastPeriod]


class MissionMonthPoint(BaseModel):
    """Nombre de missions clôturées pour un mois donné."""
    label: str
    month: str  # format YYYY-MM
    count: int


class MissionsPerMonthDashboard(BaseModel):
    """Missions clôturées par mois (12 derniers mois)."""
    points: list[MissionMonthPoint]
