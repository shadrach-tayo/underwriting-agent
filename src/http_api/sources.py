"""Serve catalogued policy source files for the citation viewer."""

from __future__ import annotations

import mimetypes

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from policy_rag.catalog import resolve_catalog_file

router = APIRouter(tags=["policy-sources"])


@router.get("/policy-sources/{filename}")
def get_policy_source(filename: str) -> FileResponse:
    path = resolve_catalog_file(filename)
    if path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown or missing policy source.",
        )
    media_type, _ = mimetypes.guess_type(path.name)
    if path.suffix.lower() == ".pdf":
        media_type = "application/pdf"
    return FileResponse(
        path,
        media_type=media_type or "application/octet-stream",
        filename=path.name,
        content_disposition_type="inline",
    )
