from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


for port in range(8100, 8200):
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(root)))
        break
    except OSError:
        continue
else:
    raise SystemExit('No hay un puerto local disponible.')

url = f'http://127.0.0.1:{port}'
print(f'Web: {url}\nEditor: {url}/editor.html\nCerrar con Ctrl+C.', flush=True)
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
