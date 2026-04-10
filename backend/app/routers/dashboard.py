"""Router /dashboard — agrégats pipeline et forecast."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.dashboard import ForecastDashboard, MissionsActivePerMonthDashboard, MissionsPerMonthDashboard, PipelineDashboard
from app.services.dashboard import get_forecast_dashboard, get_missions_active_per_month, get_missions_per_month, get_pipeline_dashboard

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/pipeline", response_model=PipelineDashboard)
async def pipeline_dashboard(db: DB, current_user: CurrentUser) -> PipelineDashboard:
    """Agrégats par stage : nombre, montant total, montant pondéré."""
    return await get_pipeline_dashboard(db)


@router.get("/forecast", response_model=ForecastDashboard)
async def forecast_dashboard(db: DB, current_user: CurrentUser) -> ForecastDashboard:
    """Forecast : mois courant + 3 mois glissants (deals non-Perdus avec expected_close)."""
    return await get_forecast_dashboard(db)


@router.get("/missions-per-month", response_model=MissionsPerMonthDashboard)
async def missions_per_month(db: DB, current_user: CurrentUser) -> MissionsPerMonthDashboard:
    """Nombre de missions clôturées par mois sur les 12 derniers mois."""
    return await get_missions_per_month(db)


@router.get("/missions-active-per-month", response_model=MissionsActivePerMonthDashboard)
async def missions_active_per_month(db: DB, current_user: CurrentUser) -> MissionsActivePerMonthDashboard:
    """Nombre de missions actives (chevauchant) par mois sur les 12 derniers mois."""
    return await get_missions_active_per_month(db)
