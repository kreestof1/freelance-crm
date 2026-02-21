"""Service Dashboard — agrégats pipeline + forecast deals."""
from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal
from app.models.pipeline_stage import PipelineStage
from app.schemas.dashboard import ForecastDashboard, ForecastPeriod, PipelineDashboard, StageAggregate


def _add_months(d: date, months: int) -> date:
    """Ajoute N mois à une date (premier jour du mois résultant)."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def _month_end(d: date) -> date:
    """Retourne le dernier jour du mois de la date donnée."""
    last_day = calendar.monthrange(d.year, d.month)[1]
    return date(d.year, d.month, last_day)


MONTHS_FR = ["", "Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin",
             "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."]


def _period_label(start: date) -> str:
    return f"{MONTHS_FR[start.month]} {start.year}"


async def get_pipeline_dashboard(db: AsyncSession) -> PipelineDashboard:
    """
    Agrégats par stage (nb deals actifs, montant total, montant pondéré).
    Exclut les deals soft-deleted.
    """
    # Récupérer les stages configurés pour avoir l'ordre et les couleurs
    stage_rows = await db.execute(select(PipelineStage).order_by(PipelineStage.order))
    stage_configs = {s.name: s for s in stage_rows.scalars()}

    # Agrégat SQL par stage
    q = (
        select(
            Deal.stage,
            func.count(Deal.id).label("cnt"),
            func.sum(Deal.amount).label("total"),
            func.sum(Deal.amount * Deal.probability / 100).label("weighted"),
        )
        .where(Deal.deleted_at.is_(None))
        .group_by(Deal.stage)
    )
    rows = await db.execute(q)

    agg_map: dict[str, StageAggregate] = {}
    for row in rows:
        cfg = stage_configs.get(row.stage)
        agg_map[row.stage] = StageAggregate(
            stage=row.stage,
            count=row.cnt,
            total_amount=Decimal(str(row.total or 0)),
            weighted_amount=Decimal(str(row.weighted or 0)),
            color=cfg.color if cfg else None,
        )

    # Ordonner par l'ordre des stages configurés, puis les orphelins
    ordered_stages: list[str] = [s.name for s in stage_configs.values()]
    # ajouter les stages présents en DB mais pas dans la config
    for s in agg_map:
        if s not in ordered_stages:
            ordered_stages.append(s)

    aggregates = [agg_map[s] for s in ordered_stages if s in agg_map]

    total_count = sum(a.count for a in aggregates)
    total_amount = sum(a.total_amount for a in aggregates)
    total_weighted = sum(a.weighted_amount for a in aggregates)

    return PipelineDashboard(
        stages=aggregates,
        total_count=total_count,
        total_amount=total_amount,
        total_weighted=total_weighted,
    )


async def get_forecast_dashboard(db: AsyncSession) -> ForecastDashboard:
    """
    Forecast : deals dont expected_close est dans la période, stage != 'Perdu'.
    - Mois courant
    - 3 prochains mois glissants
    """
    today = date.today()

    async def _compute_period(start: date, end: date, label: str) -> ForecastPeriod:
        q = (
            select(
                func.count(Deal.id).label("cnt"),
                func.sum(Deal.amount).label("total"),
                func.sum(Deal.amount * Deal.probability / 100).label("weighted"),
            )
            .where(
                Deal.deleted_at.is_(None),
                Deal.stage != "Perdu",
                Deal.expected_close >= start,
                Deal.expected_close <= end,
            )
        )
        row = (await db.execute(q)).one()
        return ForecastPeriod(
            label=label,
            period_start=start,
            period_end=end,
            count=row.cnt or 0,
            total_amount=Decimal(str(row.total or 0)),
            weighted_amount=Decimal(str(row.weighted or 0)),
        )

    # Mois courant
    month_start = today.replace(day=1)
    month_end = _month_end(month_start)
    current = await _compute_period(month_start, month_end, _period_label(month_start))

    # 3 prochains mois
    next_months: list[ForecastPeriod] = []
    for i in range(1, 4):
        s = _add_months(month_start, i)
        e = _month_end(s)
        next_months.append(await _compute_period(s, e, _period_label(s)))

    return ForecastDashboard(current_month=current, next_3_months=next_months)
