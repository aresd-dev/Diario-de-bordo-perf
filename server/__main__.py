"""Uso: py -m server  (variáveis opcionais: HOST, PORT, DIST_DIR)."""
import os
import sys

import uvicorn

from server.app import DEFAULT_DIST, DistNotFound, create_app


def main() -> int:
    host = os.environ.get("HOST", "127.0.0.1")
    try:
        port = int(os.environ.get("PORT", "8000"))
    except ValueError:
        print(f"PORT inválida: {os.environ['PORT']!r}. Use um número, por exemplo 8000.", file=sys.stderr)
        return 1
    try:
        app = create_app(os.environ.get("DIST_DIR", DEFAULT_DIST))
    except DistNotFound as erro:
        print(erro, file=sys.stderr)
        return 1
    uvicorn.run(app, host=host, port=port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
