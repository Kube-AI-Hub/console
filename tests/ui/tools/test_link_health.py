"""Self-checks for the link health probe (no browser, no cluster)."""

from __future__ import annotations

import http.server
import json
import socket
import threading

import pytest

from tools import link_health


@pytest.fixture()
def http_stub():
    """A local HTTP server that answers 200 on any path."""

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 - stdlib name
            self.send_response(200)
            self.send_header('content-length', '2')
            self.end_headers()
            self.wfile.write(b'ok')

        def log_message(self, *args):  # silence
            return

    server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_address[1]}'
    finally:
        server.shutdown()


def closed_port_url() -> str:
    """A URL that refuses connections: bind a port, then close it."""

    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    return f'http://127.0.0.1:{port}'


def test_probe_reports_success_with_timing(http_stub):
    result = link_health.probe('app', http_stub + '/', timeout=3)
    assert result.ok is True
    assert result.status == 200
    assert result.elapsed_ms >= 0
    assert result.error is None


def test_probe_classifies_a_refused_connection_as_not_ok():
    result = link_health.probe('tunnel', closed_port_url() + '/', timeout=2)
    assert result.ok is False
    assert result.status is None
    assert result.error, '失败的探测必须说明原因'


def test_classify_separates_app_outage_from_dependency_outage():
    ok = lambda name: link_health.Probe(name, 'u', True, 200, 1)  # noqa: E731
    down = lambda name: link_health.Probe(name, 'u', False, None, 1, 'refused')  # noqa: E731

    assert link_health.classify([ok('tunnel'), ok('bff'), ok('bff-kube'), ok('app')]) == 'ok'
    # The page still renders from the static bundle while the BFF/tunnel is dead: this is the
    # state that makes e2e results misleading, so it gets its own verdict.
    assert link_health.classify([down('tunnel'), down('bff'), down('bff-kube'), ok('app')]) == 'degraded'
    # The session layer answering while the k8s upstream hangs is the exact state that produces
    # "page entered error state" assertions.
    assert link_health.classify([down('tunnel'), ok('bff'), down('bff-kube'), ok('app')]) == 'degraded'
    assert link_health.classify([down('tunnel'), down('bff'), down('bff-kube'), down('app')]) == 'down'
    assert link_health.classify([]) == 'down'


def test_sample_is_json_serialisable_and_carries_every_probe(http_stub):
    row = link_health.sample(http_stub, http_stub, http_stub)
    text = json.dumps(row)
    parsed = json.loads(text)
    assert parsed['verdict'] == 'ok'
    assert [item['name'] for item in parsed['probes']] == ['tunnel', 'bff', 'bff-kube', 'app']
    assert parsed['at']


def test_watch_returns_the_worst_verdict_and_writes_a_timeline(http_stub, tmp_path):
    good = link_health.sample(http_stub, http_stub, http_stub)
    bad = link_health.sample(closed_port_url(), closed_port_url(), closed_port_url())
    assert good['verdict'] == 'ok'
    assert bad['verdict'] == 'down'

    out = tmp_path / 'timeline.jsonl'
    with out.open('w', encoding='utf-8') as sink:
        worst = link_health.watch(http_stub, http_stub, http_stub, 0, 0, sink)
    assert worst == 'ok'
    rows = [json.loads(line) for line in out.read_text(encoding='utf-8').splitlines()]
    assert len(rows) == 1
    assert rows[0]['verdict'] == 'ok'
