# 第 50 轮：四条挂起用例的结果与剩余限制（2026-11-16）

## 1. 结果：2 通过 / 2 失败

| 用例 | 结果 |
| --- | --- |
| `NODE_USAGE_01` | **passed** |
| `CUSTOM_MONITORING_01` | **passed** |
| `CLUSTER_CONFIG_01` | failed：页面进入 `error` 状态 |
| `CUSTOM_RESOURCES_01` | failed：`CRD 列表 读取失败：HTTP 502 — socket hang up` |

这是这两条用例第一次在「代理 + 看门狗」的链路下跑出**通过**结果。

## 2. 失败原因：集群侧间歇性变慢，不是代码

同一批端点在半小时内被测量了三次：

| 时刻 | 端点 | 结果 |
| --- | --- | --- |
| 18:08 | `customresourcedefinitions?limit=1` | **200，1.2s** |
| 19:18 | `customresourcedefinitions?limit=1` | **502，93.8s** |
| 19:20 | `customresourcedefinitions?limit=1` | **200，1.5s** |

同一端点、同一链路，1.2s → 93s+502 → 1.5s。**这是 K8s API 侧的抖动**，不是隧道、不是代理、不是页面代码。

另测（19:20，健康时）：

| 端点 | 大小 | 耗时 |
| --- | --- | --- |
| `namespaces?limit=1` | 3.4KB | 1.6s |
| `nodes?limit=1` | 38KB | 1.5s |
| `secrets?limit=1` | **191KB** | **13.0s** |
| `secrets?limit=20` | **1.34MB** | **120s** |

`secrets` 走 kapis 代理且返回完整对象（含 base64 数据），是本环境最重的列表。

## 3. 本轮修掉的测试侧开销

`CLUSTER_CONFIG_01` 原来用 `?limit=20` 读一遍只为拿 `totalItems`——**1.34MB / 120s**。
改成 `?limit=1`（带 `timeout=120`）：断言「页面显示 min(20, total) 行」的含义完全不变，读取降到约 190KB。

改完后失败点**前移**到「页面进入 error 状态」——也就是问题确实不在用例的读取，而在**页面自己的集群级 secrets 读取**
（页面按 `pageSize` 取集群全量 Secret，同样是数百 KB 到 1MB 级）。

## 4. 结论

这两条用例的**用例侧问题已解决**（读取开销降一个数量级），剩余失败是环境限制：
本集群的 kapis 代理返回完整 Secret/CRD 对象，单次列表数百 KB 到数 MB，在 API 抖动时会超时或断开。

**不宣称这两条通过**；判据是：等集群侧恢复（或 CRD/Secret 数量下降）后单条复跑。
