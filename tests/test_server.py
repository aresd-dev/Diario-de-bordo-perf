import pytest

from server.app import DistNotFound, create_app
from tests.conftest import SECRET


def test_raiz_e_index_servem_o_html(client):
    for url in ("/", "/index.html"):
        resposta = client.get(url)
        assert resposta.status_code == 200
        assert resposta.headers["content-type"].startswith("text/html")
        assert "Diário" in resposta.text


def test_arquivo_inexistente_retorna_404(client):
    assert client.get("/nao-existe.js").status_code == 404


@pytest.mark.parametrize("caminho", ["/../segredo.txt", "/%2e%2e/segredo.txt", "/..%2fsegredo.txt", "/icons/../../segredo.txt"])
def test_nao_sai_da_pasta_dist(client, caminho):
    resposta = client.get(caminho)
    assert resposta.status_code != 200
    assert SECRET not in resposta.text


@pytest.mark.parametrize("caminho,tipo", [
    ("/style.css", "text/css"),
    ("/script.js", "javascript"),
    ("/manifest.json", "application/manifest+json"),
    ("/icons/brand.webp", "image/webp"),
    ("/icons/icon-192.png", "image/png"),
])
def test_content_types(client, caminho, tipo):
    assert tipo in client.get(caminho).headers["content-type"]


def test_healthz(client):
    resposta = client.get("/healthz")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_sem_dist_o_erro_manda_rodar_o_build(tmp_path):
    with pytest.raises(DistNotFound, match="npm run build"):
        create_app(tmp_path / "nao-existe")


def test_dist_sem_index_tambem_e_erro(tmp_path):
    (tmp_path / "style.css").write_text("x", encoding="utf-8")
    with pytest.raises(DistNotFound, match="npm run build"):
        create_app(tmp_path)
