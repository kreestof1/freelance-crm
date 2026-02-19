"""Router /auth — login, refresh."""
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse, UserOut
from app.services.auth import authenticate_user, create_tokens, rotate_refresh_token

router = APIRouter()
logger = structlog.get_logger(__name__)
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=None)
@limiter.limit(f"{settings.rate_limit_auth}/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Authentification par email + mot de passe. Retourne access + refresh tokens."""
    user = await authenticate_user(db, body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Email ou mot de passe incorrect"},
        )
    tokens = await create_tokens(db, user)
    logger.info("auth.login_success", user_id=str(user.id))
    return tokens


@router.post("/refresh", response_model=None)
@limiter.limit(f"{settings.rate_limit_auth}/minute")
async def refresh(
    request: Request,
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Rotation du refresh token. Retourne un nouveau couple access + refresh."""
    tokens = await rotate_refresh_token(db, body.refresh_token)
    if tokens is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_REFRESH_TOKEN", "message": "Refresh token invalide ou expiré"},
        )
    return tokens


@router.get("/me", response_model=UserOut)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Retourne les informations de l'utilisateur courant."""
    return current_user
