import pytest

COMPRIMIVEIS = ["/", "/style.css", "/script.js", "/service-worker.js"]
GZIP = {"Accept-Encoding": "gzip"}


@pytest.mark.parametrize("caminho", COMPRIMIVEIS)
def test_texto_grande_sai_comprimido_quando_o_cliente_aceita(client, caminho):
    resposta = client.get(caminho, headers=GZIP)
    assert resposta.headers.get("content-encoding") == "gzip"
    assert "accept-encoding" in resposta.headers["vary"].lower()


def test_sem_accept_encoding_nao_comprime(client):
    resposta = client.get("/style.css", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in resposta.headers


@pytest.mark.parametrize("caminho", ["/icons/icon-192.png", "/icons/brand.webp"])
def test_imagens_nao_sao_comprimidas_de_novo(client, caminho):
    assert "content-encoding" not in client.get(caminho, headers=GZIP).headers


def test_conteudo_comprimido_e_igual_ao_original(client, dist):
    esperado = (dist / "style.css").read_text(encoding="utf-8")
    assert client.get("/style.css", headers=GZIP).text == esperado


@pytest.mark.parametrize("caminho", ["/", "/index.html", "/service-worker.js", "/manifest.json", "/style.css", "/script.js", "/icons/icon-192.png"])
def test_tudo_revalida_com_no_cache(client, caminho):
    cabecalhos = client.get(caminho).headers
    assert cabecalhos["cache-control"] == "no-cache"
    assert "immutable" not in cabecalhos["cache-control"]
    assert cabecalhos.get("etag")


@pytest.mark.parametrize("caminho", ["/style.css", "/service-worker.js", "/"])
def test_etag_igual_devolve_304(client, caminho):
    etag = client.get(caminho).headers["etag"]
    resposta = client.get(caminho, headers={"If-None-Match": etag})
    assert resposta.status_code == 304
    assert resposta.content == b""
    assert resposta.headers["cache-control"] == "no-cache"


def test_etag_diferente_devolve_conteudo(client):
    assert client.get("/style.css", headers={"If-None-Match": '"outro"'}).status_code == 200


@pytest.mark.parametrize("caminho", ["/", "/style.css", "/nao-existe", "/healthz"])
def test_cabecalhos_de_seguranca_em_todas_as_respostas(client, caminho):
    cabecalhos = client.get(caminho).headers
    assert cabecalhos["x-content-type-options"] == "nosniff"
    assert cabecalhos["referrer-policy"] == "same-origin"
    csp = cabecalhos["content-security-policy"]
    for diretiva in ("default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "base-uri 'self'", "worker-src 'self'", "manifest-src 'self'"):
        assert diretiva in csp
    assert "unsafe-inline" not in csp and "unsafe-eval" not in csp


def test_manifest_continua_com_tipo_correto_apos_o_gzip(client):
    assert "application/manifest+json" in client.get("/manifest.json", headers=GZIP).headers["content-type"]
