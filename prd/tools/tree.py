"""智算平台功能树的源。

新增模块 / 子模块 / 功能点只改这里，然后跑 `python3 prd/tools/build_prd.py`：
它会同步 `prd/catalog.yaml`，并只为缺失的条目补需求稿、技术方案稿与 L1/L2 用例桩。
已有 Markdown 一律不动。

字段约定
--------
- `id`：路径段，用小写与连字符；会进用例 ID，所以不要用下划线（下划线留给功能名）。
- `tests.L1/L2`：该层的用例 ID，`build_prd.py` 会为缺失的生成桩。
- 功能点不需要写 `tests`：L3 用例 ID 由 `tc_id()` 按 `TC-L3-<模块>-<子>-<功能>-01` 推导。
"""

from __future__ import annotations

MODULES = [
    {
        "id": "console-core",
        "title": "控制台基础",
        "goal": "让控制台在资源不存在、无权限、加载失败时给出可读的中文反馈，并把用户送回能继续操作的上一级页面，而不是停在空转的详情页上。",
        "tests": {"L1": ["TC-CORE-CONSOLE_CORE-01"]},
        "submodules": [
            {
                "id": "resource-detail",
                "title": "资源详情页",
                "goal": "详情页的公共骨架：加载、不存在、无权限三种结果都收敛到确定的页面状态，提示走 i18n，回退目标取该页自己的列表入口。",
                "tests": {"L2": [
                    "TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01",
                    "TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02",
                ]},
                "features": [
                    {
                        "id": "not-found",
                        "title": "资源不存在",
                        "tests": {"L3": [
                            "TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01",
                            "TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02",
                        ]},
                    },
                ],
            }
        ],
    },
    {
        "id": "cluster-gpu",
        "title": "集群算力",
        "goal": "让运维看清每张 GPU 卡的真实健康状态，故障卡一眼可辨，不被健康卡掩盖。",
        "tests": {"L1": ["TC-CORE-CLUSTER_GPU-01"]},
        "submodules": [
            {
                "id": "gpu-card",
                "title": "显卡列表",
                "goal": "节点页与集群页的显卡列表显示每张卡的健康状态；被 device plugin 摘除的故障卡仍显示且标为亚健康。",
                "tests": {"L2": ["TC-FULL-CLUSTER_GPU-GPU_CARD-01"]},
                "features": [
                    {
                        "id": "health",
                        "title": "健康状态",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01",
                            "TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02",
                        ]},
                    },
                ],
            },
            {
                "id": "vgpu-mode",
                "title": "vGPU 模式",
                "goal": "节点维度的 GPU 虚拟化方式可切换、可观察：选哪种模式、切完什么时候生效、切完资源名与容量对不对。",
                "tests": {"L2": ["TC-FULL-CLUSTER-GPU-VGPU_MODE-01"]},
                "features": [
                    {
                        "id": "switch",
                        "title": "设置 vGPU 模式",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01",
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02",
                        ]},
                    },
                    {
                        "id": "capacity",
                        "title": "vGPU 资源就绪",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01",
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02",
                        ]},
                    },
                ],
            },
            {
                "id": "gpu-monitor",
                "title": "GPU 监控",
                "goal": "节点、卡、容器/POD 三个维度的 GPU 指标口径一致；不同厂商、不同虚拟化方式用同一套指标名展示。",
                "tests": {"L2": ["TC-FULL-CLUSTER-GPU-GPU_MONITOR-01"]},
                "features": [
                    {
                        "id": "node-metrics",
                        "title": "节点维度指标",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01",
                        ]},
                    },
                    {
                        "id": "card-metrics",
                        "title": "卡维度指标",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01",
                        ]},
                    },
                    {
                        "id": "pod-metrics",
                        "title": "容器/POD 维度指标",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01",
                        ]},
                    },
                    {
                        "id": "vendor-dispatch",
                        "title": "厂商与虚拟化方式分派",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01",
                        ]},
                    },
                ],
            },
        ],
    },
    {
        "id": "cluster-storage",
        "title": "集群存储",
        "goal": "让运维看清集群共享存储的容量、配额与性能，并能安全地调整配额。",
        "tests": {"L1": ["TC-CORE-CLUSTER_STORAGE-01"]},
        "submodules": [
            {
                "id": "shared-storage",
                "title": "共享存储（JuiceFS）",
                "goal": "一页看清共享卷的配额、用量与性能；配额改动即时生效且不会被下一次挂载改回。",
                "tests": {"L2": ["TC-FULL-CLUSTER_STORAGE-SHARED_STORAGE-01"]},
                "features": [
                    {
                        "id": "overview",
                        "title": "概览",
                        # 一个功能点可以有多条 L3 用例（数值、可读性、提示各一条）。
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02",
                        ]},
                    },
                    {
                        "id": "quota",
                        "title": "卷与配额",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02",
                        ]},
                    },
                    {
                        "id": "performance",
                        "title": "性能",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03",
                        ]},
                    },
                ],
            }
        ],
    },
    {
        "id": "kube-frontend",
        "title": "新前端",
        "goal": "用 Apache 2.0 的 kube-frontend 替代 AGPL 的 console 页面：同一批资源用 schema 驱动重建，界面可被智能体操作，移动端可用。",
        "tests": {"L1": ["TC-CORE-KUBE_FRONTEND-01"]},
        "submodules": [
            {
                "id": "configmaps",
                "title": "配置字典",
                "goal": "项目内的 ConfigMap 列表能列出真实数据、按名称搜索、按名称与创建时间排序、分页，并能删除单条或所选多条。",
                "tests": {"L2": ["TC-FULL-KUBE_FRONTEND-CONFIGMAPS-01"]},
                "features": [
                    {
                        "id": "list",
                        "title": "配置字典列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04",
                        ]},
                    },
                    {
                        "id": "search",
                        "title": "按名称搜索",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02",
                        ]},
                    },
                    {
                        "id": "delete",
                        "title": "删除配置字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02",
                        ]},
                    },
                    {
                        "id": "detail",
                        "title": "配置字典详情",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02",
                        ]},
                    },
                    {
                        "id": "create",
                        "title": "创建配置字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03",
                        ]},
                    },
                    {
                        "id": "edit",
                        "title": "编辑配置字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03",
                        ]},
                    },
                    {
                        "id": "ai-surface",
                        "title": "智能体可操作性",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02",
                        ]},
                    },
                    {
                        "id": "mobile",
                        "title": "移动端适配",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02",
                        ]},
                    },
                ],
            },
        ],
    },
]


def tc_id(module: str, sub: str, feature: str, index: int = 1) -> str:
    """L3 用例 ID：`TC-L3-<模块>-<子模块>-<功能>-<NN>`。

    模块段保留连字符（`CLUSTER-STORAGE`），子模块与功能段内的连字符换成下划线
    （`SHARED_STORAGE`、`API_KEYS`），与 csghub-server 的命名习惯一致。
    """
    seg = lambda value: value.upper().replace("-", "_")
    return f"TC-L3-{module.upper()}-{seg(sub)}-{seg(feature)}-{index:02d}"


def iter_nodes():
    """(level, module, sub, feature, title) 的扁平序列，供生成器使用。"""
    for mod in MODULES:
        yield 1, mod["id"], "", "", mod["title"]
        for sub in mod.get("submodules") or []:
            yield 2, mod["id"], sub["id"], "", sub["title"]
            for feat in sub.get("features") or []:
                yield 3, mod["id"], sub["id"], feat["id"], feat["title"]
