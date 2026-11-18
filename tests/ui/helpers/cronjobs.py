"""定时任务（CronJob）与其运行记录的测试辅助。

放进 `helpers/` 而不是某个用例文件里：两个用例（DETAIL-08 运行记录、DETAIL-09 立即运行一次）
都要建/删同一个夹具，复制两份必然在清理逻辑上分叉——本仓已经因为残留对象吃过一次亏。
"""

from __future__ import annotations

import time
from urllib.parse import quote

JOBS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/jobs"
CRONJOBS = "/apis/batch/v1/namespaces/default/cronjobs"


def create_cronjob(ui, name: str, labels: dict[str, str], suspend: bool) -> str:
    """Create a CronJob that fires every minute, or never when `suspend` is set."""
    body = {
        "apiVersion": "batch/v1",
        "kind": "CronJob",
        "metadata": {"name": name, "namespace": "default", "labels": dict(labels)},
        "spec": {
            "schedule": "0 3 * * *" if suspend else "* * * * *",
            "suspend": suspend,
            "jobTemplate": {
                "metadata": {"labels": dict(labels)},
                "spec": {
                    "backoffLimit": 0,
                    "template": {
                        "spec": {
                            "restartPolicy": "Never",
                            "terminationGracePeriodSeconds": 0,
                            "containers": [{"name": "main", "image": "nginx:1.27"}],
                        }
                    },
                },
            },
        },
    }
    status, payload = ui._request("POST", CRONJOBS, body)
    assert status in (200, 201), f"创建定时任务 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def delete_cronjob(ui, name: str, labels: dict[str, str] | None = None) -> None:
    """Delete the CronJob and every Job carrying its template labels.

    A Job created by 立即运行一次 has **no ownerReferences** (the console creates it, not the
    CronJob controller), so cleanup selects by label — the same relation the page uses.
    """
    for job in jobs_of(ui, labels or {}):
        ui._request("DELETE", f"/apis/batch/v1/namespaces/default/jobs/{quote(job_name(job))}?propagationPolicy=Background")
    ui._request("DELETE", f"{CRONJOBS}/{quote(name)}?propagationPolicy=Background")


def jobs_of(ui, labels: dict[str, str]) -> list[dict]:
    """Jobs carrying these template labels, straight from kapis (raw items, not summaries).

    Label match, not owner match: a Job created by 立即运行一次 has no ownerReferences, and the
    page keeps it for the same reason (see `cronJobRunsApi.list`).
    """
    path = f"{JOBS}?limit=-1"
    status, body = ui._request("GET", path)
    # The URL is part of the message: a 404 here once came from the request missing the
    # /kube-frontend prefix, and the response body alone did not say which URL was asked.
    base = ui._api().base  # the API base, not the page base
    assert status == 200 and isinstance(body, dict), f"读取任务失败：GET {base}{path} → HTTP {status} {repr(body)[:200]}"
    out: list[dict] = []
    for item in body.get("items") or []:
        job_labels = (item.get("metadata") or {}).get("labels") or {}
        if all(job_labels.get(key) == value for key, value in labels.items()):
            out.append(item)
    return out


def wait_job(ui, labels: dict[str, str], timeout: float = 150) -> dict:
    """Wait until the schedule has produced at least one Job."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        jobs = jobs_of(ui, labels)
        if jobs:
            return jobs[0]
        time.sleep(3)
    raise AssertionError(f"带标签 {labels} 的任务在 {timeout:.0f}s 内没有出现")


def job_name(item: dict) -> str:
    return str((item.get("metadata") or {}).get("name") or "")