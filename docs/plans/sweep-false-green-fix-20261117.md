# 巡检工具的一个「假绿」根因：登录态没生效（2026-11-17）

> 这条缺陷让**过去几轮的多集群基线数字全部作废**。写清楚原因，避免再犯。

## 1. 症状

巡检对某个页面报告 `state=ready, rows=0`；同一 URL、同一构建，用定点探针手动打开却有 7 行数据。

## 2. 根因（调试打印一句话就看清了）

```
DEBUG nodes body= 19 rows= 0 url= /login?redirect=%2Fkube-frontend%2Fclusters%2Fxc%2Fnodes
```

两件事同时发生：

1. **会话没生效**：页面被重定向到 `/login`。工具写的是 `kah_token`，而实测写 `kubesphere-token`
   （应用在读取时会把它迁移成 `kah_token`）才生效。
2. **登录页也有 `:surface`**：巡检用 `[data-ai-id$=":surface"]` 取状态，于是**把登录页的卡片当成页面**，
   读到一个 `ready`、零行——「未登录」被记成「页面健康」。

## 3. 修法

```python
page.evaluate("token => localStorage.setItem('kubesphere-token', token)", token)
page.reload(wait_until='domcontentloaded')   # 让应用启动时读到 token
page.wait_for_selector('[data-ai-id^="shell:"]', timeout=30_000)
```

并在采集后加一条硬判据：

```python
if '/login' in page.url:
    state = 'signed-out'
```

## 4. 修好之后的对比（同一构建 `c41fa2993`，同一集群 `xc`）

| 页面 | 修前 | 修后 |
| --- | --- | --- |
| 配置字典 | `ready` / 0 行 | **`ready` / 20 行** |
| 告警消息 | `ready` / 0 行 | **`error` / 0 行**（成员集群 503，6 条失败请求） |

告警消息页的 `error` 正是上一轮修复的预期结果——**之前那轮「修复没生效」的结论彻底作废**。

## 5. 影响范围（必须诚实记录）

凡是使用该工具的 `--baseline` / `--pages` 得出的 `state`、`rows` 都不可信，包括：

- 「72 visits / 72 ready / 0 failed requests」这类汇总；
- 「交互 6 张列表全绿」中依赖页面句柄的部分；
- 以 `ready` 为依据判断「成员集群页面可用」的所有结论。

**仍然有效**的部分：`--data-identity`（纯 HTTP，不经过浏览器）、写入落点检查（纯 HTTP）、
以及所有定点探针。

## 6. 反思

| # | 规则 |
| --- | --- |
| 1 | **采集前先断言「我在看的是那个页面」**（URL + body 长度），不要只按元素选择器取状态 |
| 2 | **登录页、错误页、空态页都可能命中通用选择器**；通用选择器必须有兜底判据 |
| 3 | **工具第一次给出「全绿」时，必须用定点探针复核一个样本**——否则可能整轮都在测登录页 |
## 7. 修好后的第一次真实基线（HEAD `c41fa2993`，worktree 构建，5180）

```
FAIL cluster  read: 72 visits, 49 ready, 8 empty, 1 error, 6 failed requests
       xc alerting-messages: error [503 …/clusters/xc/alerting.kubesphere.io/v2beta1/clusteralerts]
OK   project  read: 34 visits, 13 ready, 5 empty, 0 error, 0 failed requests
FAIL identity read: 9 collections, 7 distinct, 1 identical, 1 suspect
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   interact read: 6 lists, 6 interacted, 0 skipped, 0 broken
OK   write    host / xc: 均 OK（xc 上 on_host=False）
baseline FAIL in 495s | repo 1ccb36cea (dirty files: 124)
```

关键变化：

- **交互第一次真正跑起来**（6 lists / 6 interacted / 0 skipped）——之前全 SKIP 是因为一直在登录页；
- `xc` 告警消息页如实报 `error`（成员 503），与修复预期一致；
- `identity` 的 `cluster alerts @ xc` 是**同一事实**的另一面（host 200 / 成员 503），不是新缺陷。

**待查**：cluster 72 次里 49 ready + 8 empty + 1 error = 58，还有 14 次落在别的状态（`none`：surface 始终没出现）。
下一轮加 `--out` 导出 JSON 逐条核对，确认这 14 个页面是「确实没有该资源」还是「页面没渲染出来」。
