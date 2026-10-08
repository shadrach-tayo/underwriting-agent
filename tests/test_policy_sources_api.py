"""Allowlisted policy PDF/DOCX serving for the citation viewer."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from http_api import create_app
from policy_rag.catalog import resolve_catalog_file


def test_resolve_catalog_file_rejects_unknown() -> None:
    assert resolve_catalog_file("not-a-real-policy.pdf") is None
    assert resolve_catalog_file("../etc/passwd") is None


def test_resolve_catalog_file_accion_when_present() -> None:
    path = resolve_catalog_file("policy_accion_sba_7a.pdf")
    if path is None:
        pytest.skip("local Accion policy PDF is not present")
    assert path.name == "policy_accion_sba_7a.pdf"
    assert path.is_file()


def test_policy_source_unknown_is_404() -> None:
    client = TestClient(create_app())
    res = client.get("/policy-sources/not-a-real-policy.pdf")
    assert res.status_code == 404


def test_policy_source_traversal_is_404() -> None:
    client = TestClient(create_app())
    res = client.get("/policy-sources/..%2FREADME.md")
    assert res.status_code == 404


def test_policy_source_serves_catalogued_pdf(tmp_path: Path) -> None:
    pdf = tmp_path / "policy_accion_sba_7a.pdf"
    pdf.write_bytes(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n")
    with patch("http_api.sources.resolve_catalog_file", return_value=pdf):
        client = TestClient(create_app())
        res = client.get("/policy-sources/policy_accion_sba_7a.pdf")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/pdf")
    assert res.content.startswith(b"%PDF")


def test_policy_source_serves_catalogued_docx(tmp_path: Path) -> None:
    docx = tmp_path / "SOP 50 10 8.1 effective 10.1.2026_0.docx"
    docx.write_bytes(b"PK\x03\x04docx")
    with patch("http_api.sources.resolve_catalog_file", return_value=docx):
        client = TestClient(create_app())
        res = client.get(
            "/policy-sources/SOP%2050%2010%208.1%20effective%2010.1.2026_0.docx"
        )
    assert res.status_code == 200
    assert "wordprocessingml" in res.headers["content-type"]
    assert res.headers["content-disposition"].startswith("inline")
    assert res.content.startswith(b"PK")
