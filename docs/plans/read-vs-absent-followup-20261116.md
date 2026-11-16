# 读取失败 vs 不存在：收尾与实测（2026-11-16 二）

> 接 `read-vs-absent-20261116.md`。本轮把剩下 3 处 `pytest.skip(f"无法读取…")` 一并收掉，并在真实环境里**双向验证**。

## 1. 剩余三处转换

| 文件 | 改法 |
| --- | --- |
| `CLUSTER_CONFIG_01` | 401/403 → skip（无权限，是「此处不可验证」）；其它非 200 → `ReadError` |
| `PERSISTENT_VOLUMES_01` | 同上 |
| `STORAGE_MOUNT_01` | 同上 |

原则统一为：**「没权限」可以 skip（并写明状态码），「读失败」必须 failed**。

## 2. 实测（这次真的跑通了）

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| `PERSISTENT_VOLUMES_01` | **passed（60.80s）** | 窗口健康时，转换后的代码行为与原来一致 |
| `CLUSTER_CONFIG_01` | **failed**，消息 `跨项目 secrets 读取失败：HTTP 502 — {'code': 'upstream_unreachable', 'message': 'connect ECONNREFUSED 127.0.0.1:18088'}` | 改造前这里是 `SKIPPED: 无法读取跨项目 secrets` |
| `CUSTOM_RESOURCES_01` | **failed**，消息 `CRD 列表 读取失败：HTTP 502 — …ECONNREFUSED…` | 改造前这里是 `SKIPPED: 集群没有 CRD，无法核对列表` |

同一台机器、同一条链路，一小时内两种情况都出现了——正好证明「skip vs fail」的差别不是文字游戏：
**前者会让人以为覆盖到了，后者直接指出 502 与隧道地址。**

## 3. 顺带修掉一个真实的超时缺陷

`read_list` 原来用 `request` 的默认 `timeout=30s`。但这个集群的列表接口耗时随**对象数量**增长：
注释里记录着「kapis 代理读同一个列表需要 63s」。于是 CRD 列表（数 MB）永远先撞超时，看起来像接口坏。

现在 `read_list(..., timeout=..., attempts=...)` 可传，`CUSTOM_RESOURCES_01` 用 `timeout=240`。

## 4. 自检

`tools/test_reads_helper.py` 6 条仍全绿（`FakeApi.request` 改为接受 `**kwargs` 并记录，便于断言调用参数）。
