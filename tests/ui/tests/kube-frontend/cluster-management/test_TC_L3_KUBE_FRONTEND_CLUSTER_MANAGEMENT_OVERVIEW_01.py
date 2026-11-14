from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_01(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01 集群概览：基本信息、用量、控制面与模块。"""

    ui = cluster_overview_page
    assert ui.api is not None

    cluster = ui.cluster_object()
    if not cluster:
        pytest.skip("无法读取集群对象，无法核对基本信息")

    status = (cluster.get("status") or {})
    spec = (cluster.get("spec") or {})
    ready_condition = next(
        (c for c in (status.get("conditions") or []) if c.get("type") == "Ready"),
        None,
    )

    ui.open()
    ui.wait_ready()

    # ---- AC-01: 基本信息与集群对象逐项一致 ----
    #
    # Compared against the API rather than against fixed literals: the versions and
    # node count move with the installation, and a test that hard-codes them fails on
    # the next upgrade while saying nothing about whether the page is right.
    assert ui.field_text("kubernetes-version") == (status.get("kubernetesVersion") or "-")
    assert ui.field_text("product-version") == (status.get("kubeSphereVersion") or "-")
    basic = ui.page.locator('[data-ai-id="overview:basic"]').last.inner_text()
    assert "Kube AI Hub 版本" in basic, basic
    assert "KubeSphere 版本" not in basic, basic
    assert ui.field_text("node-count") == str(status.get("nodeCount") or 0)
    assert ui.field_text("provider") == (spec.get("provider") or "-")

    status_text = ui.status_row
    if ready_condition is not None and ready_condition.get("status") == "True" and spec.get("enable") is not False:
        assert "运行正常" in status_text, status_text
    else:
        # A cluster that is not ready must not claim to be. This is the one assertion
        # that would catch "missing condition read as healthy".
        assert "运行正常" not in status_text, status_text
    if ready_condition and ready_condition.get("message"):
        # The controller's own sentence is what tells an operator what to do about a
        # cluster that is not ready; dropping it leaves "未就绪" with no next step.
        assert str(ready_condition["message"])[:40] in status_text, status_text

    assert ui.workspace_bar_count == 0, "集群作用域页面不应出现项目工作区栏"

    # ---- AC-01: 模块分组与 configz 一致 ----
    enabled_keys = ui.enabled_module_keys()
    assert len(ui.enabled_modules()) == len(enabled_keys), (
        f"已启用模块数与 configz 不一致: rendered={len(ui.enabled_modules())} configz={len(enabled_keys)}"
    )
    # Unknown keys are rendered verbatim rather than dropped: configz is an open set,
    # so filtering it would under-report what is installed.
    assert ui.missing_section().count("未启用") == 1

    # ---- AC-02: 用量与控制面 ----
    metrics = ui.cluster_metrics()
    if metrics is None:
        # The documented degradation: only the usage panel gives up, and it says why.
        assert ui.metrics_unavailable(), "监控不可用时用量面板必须显式说明，而不是显示 0"
        assert ui.field_text("kubernetes-version") != "", "监控缺失不应影响基本信息"
    else:
        for row in ui.USAGE_ROWS:
            text = ui.usage_text(row)
            # used / total, and a percentage that comes from the same two numbers.
            assert "已使用" in text and "总量" in text, f"{row} 用量必须明确已用和总量: {text}"
            assert ui.usage_field(row, "used").inner_text().strip()
            assert ui.usage_field(row, "total").inner_text().strip()
            assert "%" in text, f"{row} 用量必须给出百分比: {text}"

        cpu = ui.usage_text("cpu")
        memory = ui.usage_text("memory")
        assert "已分配" in cpu, f"CPU 行缺少已分配: {cpu}"
        assert "已分配" in memory, f"内存行缺少已分配: {memory}"

        gpu_total = int(float(metrics.get("cluster_gpu_total", "0") or 0))
        gpu_row_count = ui.page.locator('[data-ai-id="overview:usage-gpu"]').count()
        if gpu_total > 0:
            gpu = ui.usage_text("gpu")
            assert "已使用" in gpu and "总量" in gpu, f"GPU 卡必须显示使用量和总数: {gpu}"
            assert "GPU 利用率" not in gpu, f"GPU 卡不应重复显示额外利用率行: {gpu}"
            allocated = int(float(metrics.get("cluster_gpu_allocated", "0") or 0))
            assert str(allocated) in gpu and str(gpu_total) in gpu, f"GPU 数值与接口不一致: {gpu}"
        else:
            # 0 / 0 reads as a broken GPU feature; a CPU-only cluster is a normal shape.
            assert gpu_row_count == 0, "无 GPU 的集群不应渲染 GPU 行"

        fields = ui.kubernetes_status_fields()
        assert len(fields) == 5, fields
        assert all(value.strip() for value in fields), fields
        assert "次/秒" in fields[0], f"请求速率缺少单位: {fields[0]}"
        # Latency is rendered in ms or s depending on magnitude — but never unitless.
        assert " ms" in fields[1] or " s" in fields[1], f"请求延迟缺少单位: {fields[1]}"

    # The page is read-only: no write path exists, so no control that implies one may
    # appear here.
    assert ui.surface.locator('button:has-text("创建")').count() == 0

    screenshot(ui.page, "cluster-overview")
