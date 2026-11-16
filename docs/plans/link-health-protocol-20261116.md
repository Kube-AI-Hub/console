# 长跑判据：链路健康探测协议

> 目的：让「全站串行 E2E 失败」这件事**可判定**——是产品/用例的问题，还是 B200 链路断了。
> 日期 2026-11-16。工具：`console/tests/ui/tools/link_health.py`。

## 1. 为什么需要它

本项目的 E2E 依赖三跳：`静态站 5178` → `BFF 8092` → `SSH 隧道 18088` → `B200 K8s API`。
链路上游抖动时，失败信息长这样（本轮实测都出现过）：

| 现象 | 真实原因 |
| --- | --- |
| `could not sign in … timed out` | 隧道/上游超时，请求没到 BFF |
| `(502, {'code': 'upstream_unreachable'})` | BFF 连不上 k8s API |
| `http.client.IncompleteRead(8416130 bytes read)` | 大响应传输中途断链 |
| `自定义监控页进入了 error 状态` | 页面的数据请求全失败——**不是列显隐问题** |

只看 pytest 的总结，这四种都会被误读成「页面坏了」。

## 2. 探测什么

| 探针 | URL | 说明 |
| --- | --- | --- |
| `tunnel` | `http://127.0.0.1:18088/` | 隧道存活 |
| `bff` | `/api/session/me` | 会话层存活（无 cookie 时 401 也算「答了」） |
| `bff-kube` | `/api/v1/namespaces?limit=1` | **BFF 能否触达 k8s API**（关键的一跳） |
| `app` | `http://localhost:5178/kube-frontend/` | 静态站能否出页面 |

判决三档：

- `ok`：四跳都答了；
- `degraded`：**页面能打开但依赖死了**——这正是产生误导性失败的状态；
- `down`：页面都打不开。

## 3. 用法

```bash
# 跑测试前先探一次（非 0 退出即说明现在不该跑）
python3 tools/link_health.py

# 测试期间持续采样（每 15s，写 JSONL 时间线）
python3 tools/link_health.py --duration 3600 --interval 15 --out .artifacts/link.jsonl &
```

跑完把时间线与 pytest 失败时间点对齐：失败时刻若 `degraded`/`down`，判为**基础设施**，否则才查产品/用例。

## 4. 自检（不依赖浏览器与集群）

`tests/ui/tools/test_link_health.py` 五条：探测成功带耗时；拒绝连接被分类为失败并带原因；
三档判决（含「会话活着但 kube 上游死」→ `degraded`）；样本可 JSON 序列化且四个探针齐全；
`watch` 返回最差判决并落盘时间线。**实测 5 passed（1.56s）**。

## 5. 本轮实测证据

```json
{"verdict": "degraded", "probes": [
  {"name": "tunnel", "ok": false, "elapsed_ms": 8013, "error": "TimeoutError: timed out"},
  {"name": "bff", "ok": true, "status": 401, "elapsed_ms": 2},
  {"name": "bff-kube", "ok": false, "elapsed_ms": 8002, "error": "TimeoutError: timed out"},
  {"name": "app", "ok": true, "status": 200, "elapsed_ms": 12}]}
```

即：页面能打开、会话层活着、**kube 上游死了**——与上面四条失败现象完全吻合，把「产品坏了」的怀疑排除掉。
