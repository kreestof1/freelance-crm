"""Service Import CSV — contacts en masse avec détection encodage + mapping."""
from __future__ import annotations

import csv
import io
import unicodedata
import uuid

from pydantic import EmailStr, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.schemas.contacts import CSV_FIELD_MAP, CsvColumnMapping, CsvImportError, CsvImportResult
from app.utils.audit import write_audit


def _normalize_header(h: str) -> str:
    """Normalise un en-tête CSV : minuscules, sans accents, sans espaces."""
    h = h.strip().lower()
    h = unicodedata.normalize("NFD", h)
    h = "".join(c for c in h if unicodedata.category(c) != "Mn")
    return h.replace(" ", "_")


def detect_mapping(raw_bytes: bytes) -> tuple[str, dict[str, str], list[dict[str, str]]]:
    """
    Retourne (encoding, mapping_detecté, 3_premières_lignes).
    Essaie utf-8-sig puis latin-1.
    """
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw_bytes.decode("latin-1", errors="replace")
        enc = "latin-1"

    # Détecter le délimiteur
    sample = text[:4096]
    dialect = csv.Sniffer().sniff(sample, delimiters=",;|\t")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    headers = reader.fieldnames or []

    mapping: dict[str, str] = {}
    for h in headers:
        norm = _normalize_header(h)
        if norm in CSV_FIELD_MAP:
            mapping[h] = CSV_FIELD_MAP[norm]

    sample_rows: list[dict[str, str]] = []
    for i, row in enumerate(reader):
        if i >= 3:
            break
        sample_rows.append(dict(row))

    return enc, mapping, sample_rows


async def import_contacts_csv(
    db: AsyncSession,
    raw_bytes: bytes,
    column_mapping: dict[str, str],
    actor_id: uuid.UUID | None = None,
    all_or_nothing: bool = False,
) -> CsvImportResult:
    """
    Importe les contacts depuis un CSV.
    column_mapping : {csv_column → model_field}
    """
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw_bytes.decode("latin-1", errors="replace")

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;|\t")
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    errors: list[CsvImportError] = []
    to_insert: list[Contact] = []

    # Pré-charger les entreprises connues (par nom)
    company_cache: dict[str, uuid.UUID] = {}

    for line_no, row in enumerate(reader, start=2):  # line 1 = header
        mapped: dict[str, str] = {}
        for csv_col, model_field in column_mapping.items():
            if csv_col in row:
                mapped[model_field] = (row[csv_col] or "").strip()

        # Champs obligatoires
        first_name = mapped.get("first_name", "")
        last_name = mapped.get("last_name", "")
        email = mapped.get("email", "")

        if not email:
            errors.append(CsvImportError(line=line_no, message="Email manquant"))
            continue
        if not first_name and not last_name:
            errors.append(CsvImportError(line=line_no, message="Prénom et nom manquants"))
            continue

        # Validation email basique
        try:
            from pydantic import TypeAdapter
            TypeAdapter(EmailStr).validate_python(email)
        except ValidationError:
            errors.append(CsvImportError(line=line_no, message=f"Email invalide : {email!r}"))
            continue

        # Vérifier existence
        existing = await db.execute(
            select(Contact).where(Contact.email == email, Contact.deleted_at.is_(None))
        )
        if existing.scalar_one_or_none():
            errors.append(CsvImportError(line=line_no, message=f"Email déjà existant : {email}"))
            continue

        # Résoudre company_name → company_id
        company_id: uuid.UUID | None = None
        company_name = mapped.get("company_name", "")
        if company_name:
            if company_name in company_cache:
                company_id = company_cache[company_name]
            else:
                comp_row = await db.execute(
                    select(Company).where(Company.name.ilike(company_name), Company.deleted_at.is_(None))
                )
                comp = comp_row.scalar_one_or_none()
                if comp:
                    company_id = comp.id
                    company_cache[company_name] = comp.id

        # Tags
        tags_raw = mapped.get("tags", "")
        tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

        contact = Contact(
            first_name=first_name or "—",
            last_name=last_name or "—",
            email=email,
            phone=mapped.get("phone"),
            role=mapped.get("role"),
            linkedin_url=mapped.get("linkedin_url"),
            notes=mapped.get("notes"),
            tags=tags,
            company_id=company_id,
        )
        to_insert.append(contact)

        if all_or_nothing and errors:
            # On continue à valider mais on ne committera pas
            to_insert.clear()
            break

    if not all_or_nothing or not errors:
        for contact in to_insert:
            db.add(contact)
        await db.flush()
        for contact in to_insert:
            await write_audit(
                db, entity_type="contact", entity_id=contact.id, action="import_csv", actor_id=actor_id
            )

    return CsvImportResult(success=len(to_insert), errors=errors)
