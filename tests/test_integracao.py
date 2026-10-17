"""Servidor + dist/ real gerado por `npm run build`. Sem dist/, o teste falha (não é ignorado)."""
import re

import pytest
from fastapi.testclient import TestClient

from server.app import DEFAULT_DIST, create_app


@pytest.fixture(scope="module")
def real():
    assert (DEFAULT_DIST / "index.html").is_file(), "dist/ ausente: rode `npm run build` antes dos testes."
    return TestClient(create_app(DEFAULT_DIST))


def test_cada_arquivo_do_dist_e_servido_com_os_mesmos_bytes(real):
    arquivos = [p for p in DEFAULT_DIST.rglob("*") if p.is_file()]
    assert arquivos
    for arquivo in arquivos:
        caminho = "/" + arquivo.relative_to(DEFAULT_DIST).as_posix()
        resposta = real.get(caminho)
        assert resposta.status_code == 200, caminho
        assert resposta.content == arquivo.read_bytes(), caminho


def test_tudo_que_o_html_referencia_existe(real):
    html = (DEFAULT_DIST / "index.html").read_text(encoding="utf-8")
    referencias = set(re.findall(r'(?:href|src)="\./([^"]+)"', html))
    assert {"style.css", "script.js", "manifest.json", "icons/brand.webp"} <= referencias
    for ref in referencias:
        assert real.get("/" + ref).status_code == 200, ref


def test_arquivos_do_precache_do_service_worker_existem(real):
    sw = (DEFAULT_DIST / "service-worker.js").read_text(encoding="utf-8")
    assets = re.search(r"ASSETS=\[(.*?)\]", sw).group(1)
    caminhos = re.findall(r'"\./([^"]*)"', assets)
    assert len(caminhos) >= 7
    for caminho in caminhos:
        assert real.get("/" + caminho).status_code == 200, caminho


def test_service_worker_publicado_tem_versao_de_conteudo(real):
    sw = real.get("/service-worker.js").text
    assert "__CACHE_VERSION__" not in sw
    assert re.search(r"CACHE_NAME=`\$\{CACHE_PREFIX\}[0-9a-f]{12}`", sw)


def test_manifest_e_valido_e_com_tipo_correto(real):
    resposta = real.get("/manifest.json")
    assert "application/manifest+json" in resposta.headers["content-type"]
    assert resposta.json()["start_url"] == "./"
