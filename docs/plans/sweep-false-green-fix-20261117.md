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
## 8. 会话中途掉线，以及「已知不可用」白名单

修好登录态后仍有 20 个页面报 `signed-out`：一次 401 就让应用登出，之后每次导航都落在登录页。
修法：**每 15 个页面重新注入一次会话**，并在发现 `/login` 时就地重试一次。修后 72 次访问只剩 1 次掉线。

另外引入 `--allow cluster:page`：某些页面在某个集群上**本来就不该能用**（如 `xc` 没有告警组件，
`alerting-messages` 必然 503）。这类页面的 `error` 与身份检查的 `SUSPECT` 是**同一事实的两面**，
不应各记一次失败。白名单让它只报一次、且不计失败。

## 9. 第一条可信的基线（`dirty files: 0`）

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env \
  --app http://localhost:5180 --bff http://127.0.0.1:8093 \
  --baseline --clusters host,xc --namespace spaces --project spaces \
  --allow xc:alerting-messages
```

```
OK   cluster  read: 72 visits, 59 ready, 12 empty, 1 error(allowlisted), 0 failed requests
OK   project  read: 34 visits, 20 ready, 13 empty, 0 error, 0 failed requests
OK   identity read: 9 collections, 8 distinct, 1 identical, 0 suspect
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   interact read: 6 lists, 6 interacted, 0 skipped, 0 broken
OK   write    host / xc: 均 OK（xc 上 on_host=False）
baseline PASS in 580s | repo 86ccd280d (dirty files: 0)
```

**这是第一条可以当证据的多集群基线**：代码状态干净、页面真的渲染（55+ 页有数据）、交互真的触发、
写入落点正确、且唯一的失败是已知的环境缺失。
## 10. 会话掉线的最终修法：重新登录，而不是重放旧 token

每 15 页重放一次旧 token 只解决了一半问题：**如果那个 token 本身已被判定失效，重放没有用**。
改成「发现 `/login` 就用账号密码**重新登录拿新 token**，再重试该页」，并给登录本身加保护
（A100 的 console 会偶发 503，登录失败就退回旧 token，不能让整个巡检崩掉）。

修后项目级巡检：

```
visits: 34 | states: {'ready': 20, 'empty': 14}   ← 之前有 1 次 signed-out
```

34 次访问全部有明确归属，没有掉线、没有失败请求。
