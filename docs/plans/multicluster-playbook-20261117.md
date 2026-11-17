# 多集群验证手册（A100：`host` + `xc`）

> 这份文档回答一个问题：**拿到一台多集群环境，怎样在半小时内确认新 UI 在成员集群上真的能用。**
> 所有命令都实测过，结论与耗时都来自真实运行。

> ⚠️ **数字有效性**：本文第 11–20 节里出现的 `state`/`rows` 汇总（含「72 visits / 72 ready」、
> 「431 秒 PASS」、交互全绿等）来自**会话键写错的那段时期**，页面实际停在登录页，
> 数字**已作废**。逐条判定见 [多集群结论有效性清单](multicluster-conclusions-validity-20261117.md)。
> 修复后的可信基线见本文第 21 节与[手册](multicluster-playbook-20261117.md)。
## 1. 起栈（4 步）

```bash
# 1) 隧道：本机 18091 → A100 的 ks-console NodePort（30880）
ssh -N -L 18091:172.26.1.44:30880 a100

# 2) BFF 指向隧道（与 B200 的 8092 分开，避免互相干扰）
cd console/kube-frontend/server
BFF_PORT=8093 KS_API_URL=http://127.0.0.1:18091 ./node_modules/.bin/tsx src/dev.ts

# 3) 静态站
cd console/kube-frontend
node scripts/dev-static-server.mjs apps/console-next/dist 5179 http://127.0.0.1:8093

# 4) 冒烟：登录必须 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8093/api/session/login \
  -H 'content-type: application/json' -d '{"username":"admin","password":"P@88w0rd"}'
```

**坑**：`admin` 的密码含 `@`。走 ks-console 时必须用前端那套加密（BFF 已实现）；直连 ks-apiserver 才是明文。

## 2. 一条命令跑完基线

```bash
cd console/tests/ui
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env \
  --baseline --clusters host,xc --namespace spaces --project spaces
```

`/tmp/a100.env` 只需两行：`KA_USERNAME=admin`、`KA_PASSWORD=…`。

实测输出（431 秒）：

```
OK   cluster  read: 72 visits, 60 ready, 12 empty, 0 error, 0 failed requests
OK   project  read: 34 visits, 20 ready, 14 empty, 0 error, 0 failed requests
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   interact read: 6 lists, 6 interacted, 0 skipped, 0 broken
OK   write    host    : created=201 on_target=True  deleted=200 gone=True
OK   write    xc      : created=201 on_target=True on_host=False deleted=200 gone=True
baseline PASS in 431s
```

## 3. 每一段在证明什么

| 段 | 证明 | 失败通常意味着 |
| --- | --- | --- |
| `cluster read` | 36 个集群级页面 × 2 集群能渲染、无 4xx/5xx | 成员集群路径段位置错 |
| `project read` | 17 个项目级页面 × 2 集群 | 同上，或项目上下文丢失 |
| `detail read` | 每种对象各开一个详情页 | 详情/子资源路径错（如 `workloadPath`） |
| `interact` | 排序、搜索各触发一次真实请求 | 查询参数丢掉集群段 |
| `write` | 分组资源写**落在目标集群**、能删干净 | 写到了主集群（最严重） |

## 4. 已确认的能力边界（别当成 bug 再报一遍）

| 资源 | 成员集群读 | 成员集群写/删 |
| --- | --- | --- |
| core（configmaps、secrets、pods…） | ✅ 走 kapis 代理 | ❌ 控制台**明确拒绝**（core 组无成员形态） |
| 分组（ingresses、jobs、cronjobs…） | ✅ | ✅ 实测 201 / 200 |

## 5. 环境怪癖（遇到先重试，别改代码）

| 现象 | 处理 |
| --- | --- |
| `/api/session/login` 偶发 503，隧道根路径仍 200 | 重试 1–3 次；A100 的 ks-console 会抖动 |
| 某页 `503 configz`，几分钟后同一接口 200 | 基线对「整页失败且全是 5xx」会自动重载一次 |
| `session/me` 401 | 认证握手，已在采集时过滤 |

## 6. 单独跑某一段

```bash
--pages nodes,configmaps    # 只跑指定页面
--scope project             # 项目级页面
--details                   # 只跑详情页
--interactions              # 只跑排序/搜索
--write-check               # 只跑写入落点
--out /tmp/sweep.json       # 存 JSON 便于比对
```

## 7. 写操作的自证要求

任何写检查都必须：**唯一名字 → 在目标集群与 host 两边列举 → `finally` 删除 → 复核消失**。
只在一个集群上看列表会被乐观刷新骗过（历史事故：从 `xc` 创建的配置字典落到了 `host`）。
## 8. 同一套基线跑单集群（B200 回归）

路径改动（`clusterScoped` / `coreWritePath`）动的是**共享代码**，所以单集群环境也必须回归。同一份工具换参数即可：

```bash
cd console/tests/ui
python3 tools/multicluster_sweep.py --env-file .env \
  --app http://localhost:5178 --bff http://127.0.0.1:8092 \
  --baseline --clusters host --namespace default --project default
```

B200 实测（172 秒）：

```
OK   cluster  read: 36 visits, 33 ready, 3 empty, 0 error, 0 failed requests
OK   project  read: 17 visits, 12 ready, 5 empty, 0 error, 0 failed requests
OK   detail   read: 6 visits, 6 ok, 0 broken
OK   interact read: 3 lists, 3 interacted, 0 skipped, 0 broken
OK   write    host    : created=201 on_target=True  deleted=200 gone=True
baseline PASS in 172s
```

**单集群上 host 路径未被改动破坏**——这是所有成员集群修复的回归证据。

### 一个参数坑（不是回归）

第一次在 B200 上跑用了 A100 的 `--namespace public --project spaces`，写检查 `created=404`。
B200 没有 `spaces` 这个项目，**是参数不匹配，不是代码回归**。换成 `--namespace default` 后 201。

**结论**：基线参数是**环境相关**的，跑之前先确认目标环境里真实存在的命名空间。
## 9. 两条已验证的基线（2026-11-17，修复工具后）

### A100（多集群：`host` + `xc`）

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

### B200（单集群回归）

```bash
python3 tools/multicluster_sweep.py --env-file .env \
  --app http://localhost:5181 --bff http://127.0.0.1:8092 \
  --baseline --clusters host --namespace default --project default
```

```
OK   cluster  read: 36 visits, 33 ready, 3 empty, 0 error, 0 failed requests
OK   project  read: 17 visits, 11 ready, 6 empty, 0 error, 0 failed requests
OK   identity read: 0 collections（单集群没有可比对象，符合预期）
OK   detail   read: 6 visits, 6 ok, 0 broken
OK   interact read: 3 lists, 3 interacted, 0 skipped, 0 broken
OK   write    host: created=201 on_target=True deleted=200 gone=True
baseline PASS in 213s
```

**单集群没有回归**——所有成员集群的路径修复都没有破坏 host 行为。

## 10. 已知不可用清单（`--allow`）

| 集群:页面 | 原因 |
| --- | --- |
| `xc:alerting-messages` | 成员集群没有告警组件，`globalalerts`/`clusteralerts` 稳定 503；页面应显示「加载失败」 |
| `xc:alerting-policies` | 同上，`clusterrulegroups`/`globalrulegroups` 503 |

**预期内的 404 不算失败**：`resourcequotas` / `limitranges` 在成员集群上读不到（宪法 C6），
页面主动请求并渲染「不可用」。这类 404 由工具内置过滤，不计入 `failed requests`。

清单要跟着环境更新：**新出现的 error 先查是不是环境缺失，确认后再进白名单**，不要为了绿灯而加。
## 11. A100 的可用性并不稳定（本轮实测）

本轮想再跑一次干净基线时，A100 的登录接口连续返回 **502**，隧道根路径一度 `000`（连接失败），
而同一时刻 `ssh a100` 正常。重试两次后恢复 200。

**这不是本仓库的问题**，但会直接毁掉一次 10 分钟的巡检：

| 现象 | 处置 |
| --- | --- |
| `/api/session/login` 502/503 | 先重试 2–3 次；仍失败就先修隧道（`ssh -N -L 18091:…` 重连） |
| 隧道根路径 `000` | 隧道进程已断，重启它再谈巡检 |
| 巡检卡住无输出 | Python 重定向会缓冲；用 `python3 -u` 或先看 `login` 是否 200 |

**建议**：跑基线前固定做一次「三条健康探针」（隧道根、`/api/session/login`、静态站首页），
任一失败就不开跑——比跑到一半再失败省时间。
## 12. 开跑前的三条探针（已内置）

`--baseline` 现在**先做三条探针**，任一失败就直接退出并说明「环境不可用」，而不是跑十分钟再报失败：

```
preflight: BFF <bff> answered <status> on /api/session/me   → BFF 不在
preflight: app <app> is not serving (<异常类型>)            → 静态站不在
preflight: login attempt 1/3 failed (<异常类型>)            → 控制台登录不可用
baseline NOT RUN: the environment is not usable
```

退出码 **2** 与「跑完但有缺陷」（1）区分开：前者是环境问题，后者是代码问题。

## 13. 写入检查也重试一次 5xx

B200 上实测到一次 `created: 502`——控制台抖动，不是写被拒绝。写入检查现在遇到 5xx 重试一次，
复跑即 `created: 201 / deleted: 200`。
## 14. 详情页也重试一次 5xx

A100 本轮出现一次 `host pods/<name>` 详情页报 `error`，失败请求是 `503 /kapis/…/namespaces?page=1&limit=50`
——又是控制台抖动。详情页巡检现在与页面巡检同规则：**整页失败且全是 5xx 就重载一次**。

复跑：

```
OK   host   nodes/a100-04                       state=ready errors=0
OK   host   pods/u-admin-…                       state=ready errors=0   ← 之前是 error
… 12 visits, 12 ok, 0 broken
```

## 15. 单集群时身份检查显式跳过

```
     identity: skipped -- a single cluster has nothing to compare against
```

以前它打印 `0 collections, 0 distinct, 0 identical, 0 suspect`，看起来像「检查通过」，
实际是「没有可比对象」。**未执行与通过必须能区分**。
## 16. 六段式基线（Tab 段已并入）

`--baseline` 现在覆盖：集群级读 / 项目级读 / 数据归属 / 详情页 / **Tab** / 交互 / 写入落点。
Tab 段实测 **24 个 Tab（两集群各 12）、0 失败**。

### 所有模式共用同一套登录重试

单页巡检、`--details`、`--tabs` 与 `--baseline` 现在都先跑同一段 preflight（3 次登录重试），
环境不可用一律打印 `NOT RUN` 并退出码 2——**没有哪个模式会因为一次瞬时 503 而崩掉**。

### 5xx 重试的覆盖范围

| 位置 | 规则 |
| --- | --- |
| 页面读 | 整页失败且全是 5xx → 重载一次 |
| 详情页 | 同上；`state=none`（页面没渲染出来）也算 |
| Tab | 该 Tab 全是 5xx → 再点一次 |
| 写入 | 5xx → 重试一次 |

## 17. 全绿基线（六段式，2026-11-17）

```
OK   cluster  read: 72 visits, 57 ready, 11 empty, 0 error, 0 failed requests
OK   project  read: 34 visits, 20 ready, 14 empty, 0 error, 0 failed requests
OK   identity read: 9 collections, 8 distinct, 1 identical, 0 suspect
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   tabs     read: 24 tabs, 24 ok, 0 skipped, 0 broken
OK   interact read: 6 lists, 6 interacted, 0 skipped, 0 broken
OK   write    host / xc: created=201 on_target=True deleted=200 gone=True（xc 上 on_host=False）
baseline PASS in 845s
```

**六段全绿、零失败请求、零掉线、零残留**：36 页 × 2 集群、17 页 × 2 集群、9 个集合归属比对、
6 种对象详情、**24 个 Tab**、6 张列表 × 6 项交互、两集群各一次真实写入。

这是多集群这条线第一个把 **Tab** 也纳入的全绿结果。

