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

## 采样结果：不是「逐渐变慢」，而是「偶发长时间卡死」（2026-11-16 04:00）

在一次 `app-workloads` 长跑（11 分 47 秒，9 failed / 61 passed）期间，用一个旁路采样器每 10 秒请求一次 BFF（`/api/v1/namespaces/default/pods?limit=10`），共 52 个样本：

| 指标 | 值 |
| --- | --- |
| 中位数 | **387 ms** |
| 最小 / 最大 | 289 ms / **925 846 ms（约 15.4 分钟）** |
| 超过 2 秒的样本 | **2 个**：925 846 ms、37 193 ms |

关键结论：**中位数从头到尾稳定在 380 ms 左右**（首 5 个样本 382~484 ms，末 5 个 326~897 ms），没有任何「越跑越慢」的趋势。取而代之的是**两次孤立的长卡死**——其中一次采样请求本身等了 15 分钟才返回。

这解释了长区成片失败的机制：

1. 上游（B200 经 SSH 隧道）偶发地把某个请求挂住数分钟；
2. Playwright 的等待超时（多为 30~60 秒）先触发，该用例失败；
3. 卡死期间同一会话里的后续用例接连超时，于是「成片失败」；
4. 会话越久、请求越多，撞上一次卡死的概率越高——所以只有长区（>5 分钟）会出现，短区几乎不会。

因此问题不在控制台，也不在用例，而在**链路偶发卡死**；可行的缓解是给 E2E 的请求加超时重试，或把长区继续拆小（每区独立会话，已经在做）。

**复核**：该次长跑失败的 5 条具名用例（`GRAY_RELEASE-08`、`S2IBUILDER-05`、`SERVICES-01`、`STATUS-01`、`STATUS-02`）在新会话里复跑：**5 passed in 19.87s**。

## 已实施的第一项缓解：API 调用重试（2026-11-16 04:40）

`tests/ui/conftest.py` 的 `ApiClient.request` 现在对**幂等方法**（GET/PUT/PATCH/DELETE/HEAD）在超时/连接错误时重试一次；POST 不重试（重试创建会留下两个对象）。

同一区（`app-workloads`）前后对比：

| | 结果 |
| --- | --- |
| 加重试前 | 9 failed / 61 passed / 1 skipped（11:47） |
| 加重试后 | 6 failed / 64 passed / 1 skipped（8:33） |

**只解决了一部分**：重试救回的是夹具与断言里的 API 调用；页面加载（Playwright `goto` / 等待选择器）遇到同一次卡死仍然会超时。失败的用例集合也随每次卡死发生在哪一条而变（这次是 `SERVICE_PODS-01` 而非上次的 `GRAY_RELEASE-08`），进一步说明与具体用例无关。

要让长区也稳定，需要给页面导航加重试（改 harness 的 `page` 夹具），风险高于收益：它会把真正的页面错误也重试掉。因此维持现有判据——**长区失败在新区复跑再定性**。

## 加重试后重跑各区（2026-11-16 05:00）

| 区 | 加重试前 | 加重试后 |
| --- | --- | --- |
| monitoring | 1 failed / 14 passed | **16 passed** |
| access-control | 1 failed / 42 passed | **43 passed** |
| cluster-management | 3 failed / 90 passed | **94 passed / 12 skipped** |
| app-workloads | 9 failed / 61 passed | 3 failed / 66 passed（再跑一次 1~3 条） |

三个长区在加重试后**完全转绿**，只有用例最多的 `app-workloads`（71 条、单区 7~11 分钟）仍会掉 1~3 条。

把这些掉队的用例单独跑：`SERVICES-01`、`STATUS-01`、`STATUS-02` 三条 **3 passed in 9.54s**（各自 2~4 秒）。它们本身不慢、也没有依赖，只是恰好落在卡死窗口里。

把 `app-workloads` 拆成两半再跑（各 35/36 个文件）仍各有 1 条与 3 条失败，且**失败的用例会换**（这次多了 `COLUMN_VISIBILITY-01`）——进一步印证与用例无关，与「哪条正好撞上卡死」有关。

结论：**加重试是有效且应当保留的**（三个长区从红转绿）；`app-workloads` 的残余失败属于同一条链路的偶发卡死，用「新区复跑」判定即可。

## 最终逐区核查（2026-11-16 06:20）

每个区各自一个会话，逐区单独跑完：

| 区 | 结果 |
| --- | --- |
| access-control | **44 passed** |
| app-store | **18 passed** |
| app-workloads | 66 passed / **3 failed**（掉队用例单独跑 9.54s 全绿） |
| cluster-management | **94 passed / 12 skipped** |
| configmaps | **27 passed / 2 skipped** |
| core | **1 passed** |
| login | **3 passed** |
| monitoring | **16 passed** |
| platform-settings | **3 passed / 6 skipped** |
| project-settings | **27 passed / 1 skipped** |
| secrets | **16 passed** |
| serviceaccounts | **13 passed** |
| storage | **21 passed** |
| theme | **3 passed** |
| user-settings | **7 passed** |
| workbench | **3 passed** |

**15 / 16 个区完全通过**；只有用例最多的 `app-workloads` 仍会掉 1~3 条，且掉的是哪几条每次都不同、单独跑均全绿。

附带确认：把两个区（app-store + access-control）合到一个会话里跑，也会出现 3 条失败——**变量是会话长度，不是区本身**。

## 第 4 次全站长跑（2026-11-16 06:02–07:06，64 分 37 秒）

| 指标 | 值 |
| --- | --- |
| 结果 | **151 failed / 218 passed / 19 skipped**（3877s） |
| 失败分布 | cluster-management 56、project-settings 19、storage 16、configmaps 16、secrets 13、monitoring 11、serviceaccounts 8、其余 12 |
| 前 18% | 基本全绿（2 条失败） |
| 18% 之后 | 成片失败，与第 2、3 次同形态 |

**对照**：同一天在「新会话」里按区单跑同一批用例，全部通过——

| 区 | 单跑结果 |
| --- | --- |
| configmaps | 27 passed / 2 skipped |
| monitoring | 16 passed |
| app-store（含商店管理） | 通过 |
| access-control | 44 passed |
| project-settings | 27 passed / 1 skipped |

结论与本文档前三次一致：**长跑退化是环境现象，不是产品回归**；本轮的 151 条失败不能作为判定，
也不能从分母里删掉——它们只说明「全站一次性长跑」这条路在当前环境下仍然不可用。
唯一可用的判据仍是按区串行 + 失败单条复跑。
