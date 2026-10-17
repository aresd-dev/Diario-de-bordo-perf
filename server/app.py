"""Servidor de produção do Diário de Bordo: serve a pasta dist/ gerada por `npm run build`."""
import mimetypes
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

mimetypes.add_type("image/webp", ".webp")

DEFAULT_DIST = Path(__file__).resolve().parent.parent / "dist"

# O HTML não tem script nem estilo inline, então não há 'unsafe-inline'.
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; "
    "manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
)
SEGURANCA = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": CSP,
}


class DistNotFound(RuntimeError):
    """A pasta dist/ não existe ou não tem index.html."""


def create_app(dist_dir=DEFAULT_DIST) -> FastAPI:
    dist = Path(dist_dir)
    if not (dist / "index.html").is_file():
        raise DistNotFound(f"Não encontrei {dist / 'index.html'}. Rode `npm run build` antes de iniciar o servidor.")

    app = FastAPI(title="Diário de Bordo", docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    @app.middleware("http")
    async def cabecalhos(request: Request, call_next):
        resposta = await call_next(request)
        if request.url.path == "/manifest.json" and resposta.status_code == 200:
            resposta.headers["content-type"] = "application/manifest+json"
        # Os arquivos não têm hash no nome, então nada de cache longo: o navegador revalida
        # (ETag -> 304) e o service worker é quem entrega o carregamento rápido/offline.
        if resposta.status_code in (200, 304):
            resposta.headers["cache-control"] = "no-cache"
        for nome, valor in SEGURANCA.items():
            resposta.headers[nome] = valor
        return resposta

    app.mount("/", StaticFiles(directory=dist, html=True), name="dist")
    # Adicionado por último = camada mais externa: comprime já com os cabeçalhos finais.
    app.add_middleware(GZipMiddleware, minimum_size=500)
    return app
