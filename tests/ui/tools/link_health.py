"""Link health probe for the UI e2e runs.

The B200 cluster is reached through an SSH tunnel (18088) and a BFF (8092); the static site on
5178 proxies the BFF. Long runs fail in ways that look like product bugs but are link outages:
pytest reports login timeouts, 502 `upstream_unreachable`, or a truncated response
(`http.client.IncompleteRead`).

This module makes the distinction explicit and records a timeline, so a failed run can be
classified as "infrastructure" or "the product/spec is wrong" instead of guessed at.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, asdict
from typing import Iterable


@dataclass
class Probe:
    """One endpoint observation."""

    name: str
    url: str
    ok: bool
    status: int | None
    elapsed_ms: int
    error: str | None = None


def probe(name: str, url: str, timeout: float = 8.0) -> Probe:
    """GET `url` and classify the answer without raising."""

    started = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            status = response.status
            response.read(1)
        elapsed = int((time.monotonic() - started) * 1000)
        return Probe(name, url, True, status, elapsed)
    except urllib.error.HTTPError as error:
        elapsed = int((time.monotonic() - started) * 1000)
        # An HTTP error still proves the service answered: only a non-answer is an outage.
        return Probe(name, url, True, error.code, elapsed)
    except Exception as error:  # noqa: BLE001 - the point is to classify every failure
        elapsed = int((time.monotonic() - started) * 1000)
        return Probe(name, url, False, None, elapsed, f'{type(error).__name__}: {error}')


def check_stack(app: str, bff: str, tunnel: str) -> list[Probe]:
    """Probe the three links a UI run depends on, in dependency order."""

    return [
        probe('tunnel', tunnel.rstrip('/') + '/'),
        # The BFF has no health route. `/api/session/me` without a cookie answers 401 immediately,
        # which at least proves the session layer is alive; `/api/v1/namespaces` is proxied to the
        # k8s API, so it proves the upstream is reachable too.
        probe('bff', bff.rstrip('/') + '/api/session/me'),
        probe('bff-kube', bff.rstrip('/') + '/api/v1/namespaces?limit=1'),
        probe('app', app.rstrip('/') + '/kube-frontend/'),
    ]


def classify(probes: Iterable[Probe]) -> str:
    """Return ``ok``, ``degraded`` or ``down`` for one sample.

    ``degraded`` is the interesting middle: the app answers but a dependency behind it does not,
    which is exactly the state that produces misleading e2e failures.
    """

    probes = list(probes)
    if not probes:
        return 'down'
    app_ok = next((item.ok for item in probes if item.name == 'app'), False)
    dependencies_ok = all(item.ok for item in probes if item.name != 'app')
    if app_ok and dependencies_ok:
        return 'ok'
    if app_ok:
        return 'degraded'
    return 'down'


def sample(app: str, bff: str, tunnel: str) -> dict:
    """One JSON-serialisable observation, ready to append to a timeline."""

    probes = check_stack(app, bff, tunnel)
    return {
        'at': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'verdict': classify(probes),
        'probes': [asdict(item) for item in probes],
    }


def watch(app: str, bff: str, tunnel: str, interval: float, duration: float, sink) -> str:
    """Sample until `duration` elapses; returns the worst verdict seen."""

    worst = 'ok'
    order = {'ok': 0, 'degraded': 1, 'down': 2}
    deadline = time.monotonic() + duration
    while True:
        row = sample(app, bff, tunnel)
        sink.write(json.dumps(row, ensure_ascii=False) + '\n')
        sink.flush()
        if order[row['verdict']] > order[worst]:
            worst = row['verdict']
        if time.monotonic() >= deadline:
            return worst
        time.sleep(interval)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', default='http://localhost:5178')
    parser.add_argument('--bff', default='http://127.0.0.1:8092')
    parser.add_argument('--tunnel', default='http://127.0.0.1:18088')
    parser.add_argument('--interval', type=float, default=15.0)
    parser.add_argument('--duration', type=float, default=0.0, help='0 = single sample')
    parser.add_argument('--out', default='')
    args = parser.parse_args(argv)

    if args.duration <= 0:
        row = sample(args.app, args.bff, args.tunnel)
        print(json.dumps(row, ensure_ascii=False))
        return 0 if row['verdict'] == 'ok' else 1

    sink = open(args.out, 'w', encoding='utf-8') if args.out else open('/dev/stdout', 'w', encoding='utf-8')
    try:
        worst = watch(args.app, args.bff, args.tunnel, args.interval, args.duration, sink)
    finally:
        if args.out:
            sink.close()
    return 0 if worst == 'ok' else 1


if __name__ == '__main__':
    raise SystemExit(main())
