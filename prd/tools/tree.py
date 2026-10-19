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
