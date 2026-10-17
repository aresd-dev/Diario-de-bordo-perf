import pytest
from fastapi.testclient import TestClient

from server.app import create_app

SECRET = "segredo-fora-do-dist"


@pytest.fixture
def dist(tmp_path):
    """dist/ falso dentro de uma pasta que também tem um arquivo secreto fora dele."""
    (tmp_path / "segredo.txt").write_text(SECRET, encoding="utf-8")
    root = tmp_path / "dist"
    (root / "icons").mkdir(parents=True)
    (root / "index.html").write_text("<!doctype html><title>Diário</title>" + "<p>x</p>" * 200, encoding="utf-8")
    (root / "style.css").write_text("body{margin:0}" * 200, encoding="utf-8")
    (root / "script.js").write_text("console.log('ok');" * 100, encoding="utf-8")
    (root / "service-worker.js").write_text("self.addEventListener('fetch',()=>{});" * 50, encoding="utf-8")
    (root / "manifest.json").write_text('{"name":"Diário de Bordo","icons":[]}', encoding="utf-8")
    (root / "icons" / "brand.webp").write_bytes(b"RIFF0000WEBPVP8L" + bytes(range(256)) * 4)
    (root / "icons" / "icon-192.png").write_bytes(b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * 4)
    return root


@pytest.fixture
def client(dist):
    return TestClient(create_app(dist))
