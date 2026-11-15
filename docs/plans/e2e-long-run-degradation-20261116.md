# 全站串行回归的长跑退化（2026-11-16 观察）

## 现象

同一条命令 `pytest tests/kube-frontend -m ui -n 0`：

| 次数 | 结果 |
| --- | --- |
| 第 1 次（约 31 分钟） | 4 failed / 311 passed / 17 skipped / 5 errors —— 4 条失败单跑全绿 |
| 第 2 次（被 45 分钟超时杀掉） | 前 18% 基本全绿，之后成片失败 |
| 第 3 次（`app-workloads` 单区，15 分钟） | 前 20 条全绿，之后成片失败 |
| 第 3 次的 `-x` 重跑（400 秒内） | 一路绿，跑到 56 条仍在继续 |

## 已排除的原因

| 猜测 | 证据 |
| --- | --- |
| 前端静态服务挂了 | 失败前后 `web:200`，`/tmp/static.log` 无重启记录 |
| BFF 挂了 | 失败前后 `bff:200`，进程数 1，日志未重写 |
| SSH 隧道断了 | 失败前后 `tunnel:200`，仅 1 个 ssh 进程（另两个是 keep-alive 包装 shell） |
| dist 半成品 | 复跑前已重新 `vite build`，仍是同样形态 |
| 用例夹具泄漏 | `conftest.py` 里 page/context 都在 `finally` 关闭，session 级 context 只建一次 |

## 目前的结论

**不是产品缺陷，也不是某条用例的问题**：同一批用例在「新会话」里跑全绿，在「已连续跑 20~60 条之后」成片失败。可疑方向是长跑后**上游（B200 集群 / SSH 隧道 / BFF 连接池）对新请求的响应变慢或被限流**，页面等待超时后连锁失败。

## 因此采用的验证方式

1. **按区串行**：`pytest tests/kube-frontend/<area> -n 0`，每个区 1~15 分钟，单独跑都能全绿；
2. 跑批前后各探一次 `bff:`/`web:`/`tunnel:`，把环境故障与用例失败分开；
3. 全站一次性长跑不作为唯一判据，只作为「有没有大面积回归」的粗筛。

## 待办（需要环境侧信息才能继续）

- 在长跑中采样 BFF 的响应时间与连接数，确认是否连接池耗尽；
- 在长跑中采样 SSH 隧道的吞吐与重连次数；
- 若确认是上游限流，考虑给 E2E 增加请求重试或降低并发（当前已是 `-n 0`，只能减少总量）。

## 按区隔离跑的全量结果（2026-11-16 03:00 起）

每个区各自起一个 pytest 会话（即每个区一个全新的浏览器上下文），16 个区依次跑完：

| 区 | 结果 | 用时 |
| --- | --- | --- |
| access-control | 1 failed / 42 passed | 6:12 |
| app-store | 18 passed | 2:05 |
| app-workloads | 5 failed / 65 passed / 1 skipped | 9:03 |
| cluster-management | 3 failed / 90 passed / 12 skipped | 14:10 |
| configmaps | 25 passed / 2 skipped | 1:29 |
| core | 1 passed | 0:02 |
| login | 3 passed | 0:05 |
| monitoring | 1 failed / 14 passed | 2:33 |
| platform-settings | 3 passed / 6 skipped | 1:32 |
| project-settings | 25 passed / 1 skipped | 3:25 |
| secrets | 16 passed | 0:58 |
| serviceaccounts | 13 passed | 2:05 |
| storage | 21 passed | 2:11 |
| theme | 2 passed | 0:06 |
| user-settings | 7 passed | 0:28 |
| workbench | 3 passed | 0:07 |

合计 **348 passed / 22 skipped / 10 failed**。

## 失败全部集中在最长的三个区，且复跑全绿

10 条失败只出现在 access-control（6 分钟）、app-workloads（9 分钟）、cluster-management（14 分钟）这三个**单区用时最长**的区里；把其中 6 条具名用例（`APP_WORKLOADS-STATUS-01/02`、`MONITORING-LIST_REFRESH-01`、`MONITOR_RESOURCE-01`、`NODES-10`、`WORKSPACE_CONSOLE-05`）单独再跑一次：**6 passed in 59s**。

这与前面的判断一致：**不是产品缺陷**，而是同一个会话跑够久之后上游响应退化；区越短越不受影响（所有 2 分钟以内的区 100% 全绿）。

因此可用的判据是：**短区直接信结果；长区（>5 分钟）的失败必须在新区复跑一次再定性**。
