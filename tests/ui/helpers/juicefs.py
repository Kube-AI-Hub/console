"""Shared-storage test helpers.

The quota tests are the only ones that write. They grow the first row by 1 TiB and
restore the old value in a `finally`, so a failed assertion does not leave the
cluster with a different capacity than the one it started with.
"""

from __future__ import annotations

import re

TIB = 1024 ** 4

_UNIT_POWER = {"B": 0, "KiB": 1, "MiB": 2, "GiB": 3, "TiB": 4, "PiB": 5}


def bytes_of(text: str) -> float:
    """Parse `5.0 TiB` / `1012.7 GiB` into bytes (display text is rounded)."""
    match = re.match(r"([\d.]+)\s*(B|KiB|MiB|GiB|TiB|PiB)", text.strip())
    if not match:
        return 0.0
    return float(match.group(1)) * 1024 ** _UNIT_POWER[match.group(2)]


def first_number(text: str) -> float:
    match = re.search(r"[\d.]+", text.replace(",", ""))
    return float(match.group(0)) if match else 0.0


def change_quota(storage_page, delta_tib: int = 1) -> tuple[str, int, int]:
    """Grow the first row's quota by `delta_tib` through the dialog.

    Returns (volume name, old bytes, new bytes). The caller is responsible for
    restoring the old value.
    """
    storage_page.open("volumes")
    name = storage_page.volume_name(0)
    old = storage_page.row_bytes(0)["capacity"]
    target = old + delta_tib * TIB

    storage_page.open_quota(0)
    storage_page.quota_input.fill(str(target // TIB))
    storage_page.quota_unit.select_option("Ti")
    storage_page.submit_quota()

    got = storage_page.wait_row_capacity(target)
    return name, old, got


def restore_quota(storage_page, name: str, old_bytes: int) -> None:
    if not name or not old_bytes:
        return
    # The API takes ~10s; the page does not need to be open for it.
    storage_page.set_quota_api(name, f"{old_bytes // TIB}Ti")
    storage_page.page.wait_for_timeout(500)
