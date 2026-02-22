"""Reminder worker — envoi d'emails de rappel pour les activités."""
from __future__ import annotations

import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.activity import Activity
from app.models.user import User

logger = structlog.get_logger(__name__)
settings = get_settings()


def _send_email_sync(to: str, subject: str, body: str) -> None:
    """Envoie un email via SMTP (synchrone, exécuté dans un thread)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.attach(MIMEText(body, "html", "utf-8"))
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_password:
                smtp.login(settings.smtp_from, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, [to], msg.as_string())
        logger.info("email_sent", to=to, subject=subject)
    except Exception as exc:  # noqa: BLE001
        logger.error("email_error", to=to, error=str(exc))


def _build_reminder_html(activity: Activity) -> str:
    type_labels = {"Appel": "Appel", "Email": "Email", "Tâche": "Tâche", "RDV": "Rendez-vous"}
    label = type_labels.get(activity.type, activity.type)
    when_str = activity.when.strftime("%d/%m/%Y à %H:%M") if activity.when else "—"
    notes = activity.notes or ""
    return f"""
    <html><body style="font-family:Arial,sans-serif;padding:20px;">
      <h2 style="color:#1565C0;">⏰ Rappel CRM — {label}</h2>
      <p>Vous avez une activité prévue :</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:8px;font-weight:bold;">Type</td><td style="padding:8px;">{label}</td></tr>
        <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold;">Date / heure</td>
            <td style="padding:8px;">{when_str}</td></tr>
        {'<tr><td style="padding:8px;font-weight:bold;">Notes</td><td style="padding:8px;">' + notes + '</td></tr>' if notes else ''}
      </table>
      <p style="color:#888;font-size:12px;margin-top:24px;">CRM Freelance · rappel automatique</p>
    </body></html>
    """


async def send_pending_reminders() -> None:
    """
    Recherche les activités dont reminder_at <= now ET reminder_sent=False,
    envoie un email à l'utilisateur propriétaire et marque reminder_sent=True.
    Appelée par APScheduler toutes les 5 minutes.
    """
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        db: AsyncSession
        result = await db.execute(
            select(Activity)
            .where(
                Activity.reminder_at <= now,
                Activity.reminder_sent.is_(False),
                Activity.reminder_at.is_not(None),
                Activity.deleted_at.is_(None),
            )
        )
        activities = result.scalars().all()

        if not activities:
            return

        logger.info("reminder_check", pending=len(activities))

        for activity in activities:
            # Récupérer le mail de l'utilisateur
            user_result = await db.execute(
                select(User).where(User.id == activity.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user or not user.email:
                activity.reminder_sent = True
                continue

            subject = f"[CRM] Rappel : {activity.type} — {activity.when.strftime('%d/%m %H:%M') if activity.when else ''}"
            body = _build_reminder_html(activity)
            _send_email_sync(user.email, subject, body)
            activity.reminder_sent = True

        await db.commit()
        logger.info("reminders_sent", count=len(activities))
