# 把「读取失败」和「本来没有」分开（测试侧）2026-11-16

> 项目规矩里最容易被测试自己破坏的一条：**读取失败不能报成「不存在」**。
> 本轮把 8 个用例里 `if status != 200: return None` + `if value is None: pytest.skip(...)` 的模式改掉。

## 1. 现场证据

`CUSTOM_RESOURCES_01` 在一次链路抖动后输出：

```
SKIPPED ... 集群没有 CRD，无法核对列表
```

而实际上 BFF 当时返回 **502 `upstream_unreachable`**（同时 `curl` 也拿到 502）。
也就是说：**接口挂了 → 用例被跳过了**，报告上看起来「这个集群没数据」，
既没有红也没有任何指向环境的信息。这比红测更危险——它会让人以为覆盖到了。

## 2. 新增 `tests/ui/helpers/reads.py`

```python
read_list(api, path, what) -> list
```

- HTTP 200 且 `items` 是数组 → 返回列表（可能是空列表，那是**真的**没有）；
- 其它任何情况（非 200、响应不是对象、没有 `items`、`items` 不是数组）→ 抛 `ReadError`。

`ReadError` 继承 `AssertionError`：pytest 会把它报成 **failed**（带消息），不是 error，也不是 skip。

## 3. 改了哪些地方

| 文件 | 改法 |
| --- | --- |
| `CUSTOM_RESOURCES_01` | 整个 `_crds` 换成 `read_list(...)`（最彻底） |
| `GPU_01`、`GPU_RESOURCE_01`、`NODE_USAGE_01` | 读取失败处 `raise ReadError(...)`，保留原「没有数据」语义 |
| `CONTAINER_DETAIL_02`、`CONTAINER_DETAIL_03`、`DETAIL_MONITOR_01`、`MONITORING_RULES_01` | 同上 |

保留 `return None` 的情况只用于「200 但结构不是你期待的形状」这类极少数分支，
调用方的 `if x is None: skip(...)` 因此不再会掩盖**接口失败**。

## 4. 自检（6 条，全离线）

`tests/ui/tools/test_reads_helper.py`：正常返回、真空列表、502 失败（消息含状态与响应片段）、
403 失败、`items` 缺失/类型错误都失败、`ReadError` 是 `AssertionError` 子类。
**实测 6 passed**；连同其它离线自检共 **15 passed**。

## 5. 验证边界

本轮链路 `degraded`（tunnel 8s 超时、BFF 502），**无法在浏览器里复核这 7 个用例的行为变化**。
已完成的是：8 个文件全部 `py_compile` 通过、diff 逐条人工检查、离线自检全绿。
E2E 复核待链路恢复后进行——届时若接口失败，这些用例应当 **failed** 而不是 skip。
