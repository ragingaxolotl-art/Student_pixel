#!/usr/bin/env python3
"""Open the built editor locally without requiring Node.js or npm."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
import webbrowser


def main():
    root = Path(__file__).resolve().parents[1] / "dest" / "prod"
    if not (root / "index.html").is_file():
        sys.exit("Piskel has not been built yet. Run npm ci and npm run build first.")

    # Keep one address so browser saves and backups survive app restarts.
    address = ("127.0.0.1", 8771)
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer(address, handler)
    except OSError as error:
        sys.exit(f"Could not start Piskel at http://127.0.0.1:8771/: {error}")

    url = "http://127.0.0.1:8771/"
    print(f"Piskel with 45° rotation: {url}", flush=True)
    print("Keep this window open while editing. Press Control-C to stop.", flush=True)
    if sys.platform == "darwin" and Path("/Applications/Google Chrome.app").is_dir():
        result = subprocess.run(["open", "-a", "Google Chrome", url], check=False)
        if result.returncode:
            webbrowser.open(url)
    else:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
