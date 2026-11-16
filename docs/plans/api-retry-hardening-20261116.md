# 共享 API 客户端：截断响应重试（2026-11-16）

> `tests/ui/conftest.py` 的 `ApiClient.request` 原来只对 `TimeoutError` / `OSError` 重试；
> 而这条链路产生的是 `http.client.IncompleteRead`（`HTTPException`，**不是** `OSError`），于是截断直接冒泡成用例失败。

## 1. 现场

`CUSTOM_RESOURCES_01` 连续两次失败在不同的位置：

| 时间 | 现象 |
| --- | --- |
| 15:50 | `IncompleteRead(8416130 bytes read)` |
| 17:00 | `IncompleteRead(454438 bytes read)`，栈在 `http.client._read_next_chunk_size` |

两次都在**读大 JSON 列表**（CRD 列表，数 MB，chunked 传输）时断在 chunk 边界。用例本身没跑到断言。

## 2. 修改

```python
except (TimeoutError, OSError, http.client.HTTPException) as stall:
```

语义不变：只重试**幂等**方法（GET/PUT/PATCH/DELETE/HEAD），POST 仍不重试（重试的创建会留下两个对象）；
「有应答」（包括 4xx）不重试。

## 3. 自检（4 条，全离线）

`tests/ui/tools/test_api_retry.py`：

| 断言 | 内容 |
| --- | --- |
| 截断后重试 | 第一次抛 `IncompleteRead`、第二次成功 → 返回成功且调用 2 次 |
| 用尽次数后抛出 | `attempts=3` 且一直截断 → 抛 `IncompleteRead` 且调用 3 次 |
| POST 不重试 | 抛错即止，调用 1 次 |
| 4xx 不重试 | 返回 403 原文，调用 1 次 |

**实测 4 passed（4.05s）**。

## 4. 仍未解决的

修完立刻重跑 `CUSTOM_RESOURCES_01`：**200s 超时（EXIT=124）**——链路已经完全不通，连第一个请求都出不去。
所以这条用例仍然**未 settled**：重试只能救「响应被截断」，救不了「一个字节都收不到」。
