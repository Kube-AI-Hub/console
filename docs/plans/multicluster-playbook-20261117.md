# 多集群验证手册（A100：`host` + `xc`）

> 回答一个问题：**拿到一台多集群环境，怎样在半小时内确认新 UI 在成员集群上真的能用。**
> 命令与数字都来自真实运行；作废的历史数字在文末指路。

> ⚠️ **2026-11-18 05:23 起本文的起栈步骤已过时**：`4ff017afa` 退役了 BFF，新 console 改由 ks-console 直接提供。
> 第 1–2 节描述的三段式属于**重构前**形态；新形态见下方「0. 起栈（新形态，未验证）」。

## 0. 起栈（新形态，未验证）

```bash
# 只剩一步：隧道。ks-console 自己提供新 console、自己转发 API、自己完成登录。
ssh -N -L 18091:172.26.1.44:30880 a100
```

验收目标就是 `http://127.0.0.1:18091/kube-frontend/`，不需要 BFF，也不需要单独的静态站。

**就绪检查（十秒）**：

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env \
  --app http://127.0.0.1:18091 --bff - --probes --clusters host
```

`oauth-userinfo` 与 `oauth-login-route` 两条不再是 WARN，才值得往下跑。

**本节未验证**：2026-11-18 06:05 实测该部署的 `POST /kapis/oauth.kubesphere.io/v1alpha1/login` 仍返回 **403**
（`login.oauth.kubesphere.io` 未注册），所以上面的命令是**按新架构推导**的，不是跑通过的结果。
跑通后请把这一行删掉并附上实际输出。

## 1. 起栈（4 步，重构前形态）

```bash
# 1) 隧道：本机 18091 → A100 的 ks-console NodePort（30880）
ssh -N -L 18091:172.26.1.44:30880 a100

# 2) BFF 指向隧道（与 B200 的 8092 分开，避免互相干扰）
cd console/kube-frontend/server
BFF_PORT=8093 KS_API_URL=http://127.0.0.1:18091 KS_OAUTH_ENCODING=mix ./node_modules/.bin/tsx src/dev.ts

# 3) 静态站
cd console/kube-frontend
node scripts/dev-static-server.mjs apps/console-next/dist 5179 http://127.0.0.1:8093 kube-frontend

# 4) 冒烟：登录必须 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8093/api/session/login \
  -H 'content-type: application/json' -d '{"username":"admin","password":"P@88w0rd"}'
```

**`KS_OAUTH_ENCODING=mix` 不能省**：A100/B200 的上游是 ks-console，它会把含 `@` 的密码当密文解密。
不设这个变量时登录返回 **400 `invalid_credentials`**——不是密码错了。直连 ks-apiserver 的部署才用默认明文。

B200 需要两段：ssh 隧道（18089）+ `tools/tunnel-proxy.mjs`（18088 → 18089）；BFF 用 **8092**。

**静态站必须与 BFF 配对**：`node scripts/dev-static-server.mjs apps/console-next/dist 5183 http://127.0.0.1:8092 kube-frontend`。
2026-11-18 实测过 `5178` 被接到 8093（A100 的 BFF），于是「B200 巡检」量的是登录页、整段却报 0 error——
preflight 现在会用同一个 token 经应用请求 `/api/session/me`，不是 200 就拒绝开跑。

## 2. 一条命令跑完

```bash
cd console/tests/ui
python3 -u tools/multicluster_sweep.py --env-file /tmp/a100.env \
  --baseline --clusters host,xc --namespace spaces --project spaces \
  --allow xc:alerting-messages,xc:alerting-policies --budget 1700
```

`/tmp/a100.env` 只需两行：`KA_USERNAME=admin`、`KA_PASSWORD=…`。`-u` 必须加，否则输出会被缓冲成「卡住」。

| 模式 | 覆盖 | 耗时（A100） |
| --- | --- | --- |
| `--baseline` | 八段：集群读 / 项目读 / 企业空间读 / 数据归属 / 详情 / Tab / 交互 / 写入 | ~15 分钟 |
| `--keyboard` | 两集群 × 4 主题色调组合 × 3 页 的 Tab 顺序与焦点指示对比度 | ~9 分钟 |
| `--keyboard-local` | 登录页（**不需要集群**）：结构 a11y + 4 组合 | ~1 分钟 |
| `--locale-scan --locale en` | 英文界面的裸标识符（未翻译文案） | ~2 分钟 |
| `--probes` | 7 个只读接口探针的状态码（能力指纹，两个部署可直接对比） | ~10 秒 |

**四种模式一条命令跑完**（按「最快失败」排序）。第三个参数是 BFF；**传 `-` 表示应用与接口同一个 origin**
（BFF 退役后的形态）：

```bash
tools/verify-all.sh /tmp/a100.env http://localhost:5182 http://127.0.0.1:8093 host,xc system-workspace spaces
```

最后打印 `=== summary ===` 与 `VERDICT: PASS|FAIL|INCOMPLETE`；某模式因环境不可用退出 2 时记 `SKIP` 而不是 `FAIL`。

**整轮只登录一次**：脚本先取一个 token，再用 `--token` 传给各模式。此前每个模式各自登录，
五次连续登录会触发控制台的限流（**429**），整轮被误报成「环境不可用」。

**退出码**：`0` 全绿 / `1` 跑完但有缺陷 / `2` 环境不可用（preflight 拦下）/ `3` 超预算中止。

## 3. 每一段在证明什么

| 段 | 证明 | 失败通常意味着 |
| --- | --- | --- |
| `cluster read` | 36 个集群级页面 × 2 集群能渲染、无 4xx/5xx | 成员集群路径段位置错 |
| `project read` | 17 个项目级页面 × 2 集群 | 同上，或项目上下文丢失 |
| `workspace read` | 8 个企业空间页面（与集群无关，跑一遍即可） | 企业空间 API 或路由错 |
| `identity` | 9 个集合在两个集群上的数据归属 | 成员集群读到了主集群的数据 |
| `detail` | 每种对象各开一个详情页 | 详情/子资源路径错（如 `workloadPath`） |
| `tabs` | 每个详情页的每个 Tab 都点开 | 某个 Tab 走了主集群的接口 |
| `interact` | 排序、搜索各触发一次真实请求 | 查询参数丢掉集群段 |
| `write` | 分组资源写**落在目标集群**、能删干净 | 写到了主集群（最严重） |

## 4. 已确认的能力边界（别当成 bug 再报一遍）

| 资源 | 成员集群读 | 成员集群写/删 |
| --- | --- | --- |
| core（configmaps、secrets、pods…） | ✅ 走 kapis 代理 | ❌ 控制台**明确拒绝**（core 组无成员形态） |
| 分组（ingresses、jobs、cronjobs…） | ✅ | ✅ 实测 201 / 200 |
| `resourcequotas` / `limitranges` | ❌ 读不到 | ❌ |
| `events` | ✅ 但只走 `events.k8s.io/v1` + `regarding.*` | — |

## 5. 环境不稳定：症状与处置

| 现象 | 含义 | 处置 |
| --- | --- | --- |
| `/api/session/login` 502/503，隧道根路径仍 200 | 控制台抖动 | 重试 2–3 次；仍失败先修隧道 |
| `/api/session/login` **429** | 登录被限流（同一账号短时间内登录太多次） | **等几分钟**再跑；这不是缺陷，重试也没用 |
| 登录 **400 `invalid_credentials`**，而手工用已知密码能登进去 | `tests/ui/.env` 里的密码**过期**了 | 更新那个文件（它被 gitignore）；先确认手工登录能过 |
| 隧道根路径 `000` | 隧道进程已断 | 重启隧道再谈巡检 |
| 某页 `503 configz`，几分钟后同一接口 200 | 控制台抖动 | 巡检对「整页失败且全是 5xx」自动重载一次 |
| `session/me` 401 | 认证握手 | 已在采集时过滤 |
| **长时间无新行 + 登录 502** | 上游掉了，某请求在等超时 | **kill 巡检**，修隧道后重跑 |
| 长时间无新行 + 登录 200 | 某页在等很慢的响应 | 看该段等待上限（页面 40s / Tab 30s / 详情 60s） |
| 巡检「卡住」 | Python 输出缓冲，或真的卡在某个页面 | 用 `python3 -u`；再加 `SWEEP_PROGRESS=1` 让每个页面打一行并给出耗时 |
| 每页要 30 秒以上、结果全是 `state=signed-out` | **会话没建立**：应用没出现 shell | 现在会立刻 `NOT RUN` 并退出码 2，不再把登录页量 36 遍 |

**不要把「卡住」当成「通过」**。整轮有 `--budget`（默认 1800 秒）兜底：超时打印 `ABORTED` 并退出码 3。
它用看门狗线程实现（`signal.alarm` 在主线程阻塞于 Playwright 调用时不投递，实测 55 分钟没触发）。

开跑前三条探针（已内置在 `--baseline`，任一失败即退出码 2）：BFF `/api/session/me`、静态站首页、登录。

**探测用的字段名要从客户端代码里取**：2026-11-18 手工探 `cluster_gpu_used` 得到「缺失」，差点判成
「缺失被显示成 0」；客户端实际用的是 `cluster_gpu_usage`，值为真实 0。字段名凭直觉拼会造出假缺陷。

## 6. 单独跑某一段

```bash
--pages nodes,configmaps    # 只跑指定页面
--scope project             # 项目级页面（另有 workspace）
--details                   # 只跑详情页
--tabs                      # 只跑 Tab 段
--interactions              # 只跑排序/搜索
--write-check               # 只跑写入落点
--out /tmp/sweep.json       # 存 JSON 便于比对
```

## 7. 写操作的自证要求

任何写检查都必须：**唯一名字 → 在目标集群与 host 两边列举 → `finally` 删除 → 复核消失**。
只在一个集群上看列表会被乐观刷新骗过（历史事故：从 `xc` 创建的配置字典落到了 `host`）。

## 8. 已知不可用清单（`--allow`）

| 集群:页面 | 原因 |
| --- | --- |
| `xc:alerting-messages` | 成员集群没有告警组件，`globalalerts`/`clusteralerts` 稳定 503；页面应显示「加载失败」 |
| `xc:alerting-policies` | 同上，`clusterrulegroups`/`globalrulegroups` 503 |

**预期内的 404 不算失败**：`resourcequotas` / `limitranges` 在成员集群上读不到（宪法 C6），
页面主动请求并渲染「不可用」。这类 404 由工具内置过滤，不计入 `failed requests`。

清单要跟着环境更新：**新出现的 error 先查是不是环境缺失，确认后再进白名单**，不要为了绿灯而加。

## 9. 已验证的基线（2026-11-17）

| 环境 | 命令参数 | 结果 |
| --- | --- | --- |
| A100（多集群，**已不可复现**） | `--clusters host,xc --namespace spaces --project spaces` | **PASS 789s**：72 次集群级访问（59 ready/11 empty/0 error）、34 次项目级（20/14）、16 次企业空间访问（10/6）、9 个集合归属、12 个详情、24 个 Tab、6 张列表交互、两集群各一次写入。**2026-11-18 01:40 起 `xc` 已从 A100 移除，见[记录](a100-member-cluster-removed-20261118.md)** |
| A100（单集群） | `--clusters host --workspace system-workspace --project spaces` | **PASS 391s**（`verify-all.sh` 四模式整体 PASS，2026-11-18）：36+17+8 次访问、6 个详情、12 个 Tab、3 张列表交互、1 次写入，**0 失败请求** |
| B200（单集群） | `--clusters host --workspace system-workspace --project default` | **PASS 323s**（`verify-all.sh` 四模式整体 PASS，2026-11-18）：36+17+8 次访问、6 个详情、12 个 Tab、3 张列表交互、1 次写入，**0 失败请求** |
| B200（单集群） | `--clusters host --namespace default --project default` | **PASS 284s**（静态站 5183 → BFF 8092 配对正确后）：36+17+8 次访问、6 个详情、12 个 Tab、3 张列表交互、1 次写入 |

B200 那条是**共享代码的回归证据**：路径改动动的是 `clusterScoped`/`coreWritePath`，单集群也必须照常。

**参数是环境相关的**：在 B200 上用 A100 的 `--namespace spaces` 会让写入检查 `created=404`——那是参数不匹配，不是回归。

### 定向用例（2026-11-17 晚，mlu370 成员集群只读）

环境：`ssh -N -L 18093:10.233.60.28:80 cam`；BFF `8096 → http://127.0.0.1:18093`；静态 5177；`KA_CLUSTER=4paradigm`、admin。

| 用例 | 结果 |
| --- | --- |
| 节点列表 `NODES-01` | **1 passed（13.49s）** |
| 节点详情 `NODES-03` + `NODES-06` | **2 passed（32.29s）** |
| 配置字典创建 + 删除 `CONFIGMAPS-CREATE-01` + `CONFIGMAPS-DELETE-01` | **2 passed（4.08s）**，写后清理 |

读用例只读；配置字典用例验证了成员集群**写入**路径（创建成功后删除）。节点读链路与成员集群路径 `/kapis/clusters/4paradigm/...` 可用；其他能力的成员写仍需逐个验证。

### 读扫描回归（2026-11-17 晚，B200 单集群，只读）

命令（同一次会话复用登录与浏览器）：

```
python3 tools/multicluster_sweep.py --app http://localhost:5176 --bff http://127.0.0.1:8092 \
  --env-file /tmp/kah/sweep.env --clusters host --namespace default --project default \
  --scope cluster --pages deployments,statefulsets,pods,nodes,services,ingresses,configmaps,secrets,persistentvolumeclaims,storageclasses
```

| 范围 | 页面数 | 结果 |
| --- | --- | --- |
| 集群作用域 | 10 | 全部 ready/empty，**0 请求错误** |
| 项目作用域（default） | 10 | 全部 ready/empty，**0 请求错误** |

只读扫描，不含写入；用于页面/路由/查询改动后的快速回归，不替代逐功能 AC 验收。

## 10. 企业空间作用域（`--scope workspace`）

```bash
python3 -u tools/multicluster_sweep.py --env-file <env> --app http://localhost:5182 \
  --bff http://127.0.0.1:8093 --scope workspace --clusters host
```

八个页面：overview / base-info / members / user-groups / projects / devops / quota / roles。

**坑**：项目页 URL 里的 workspace 段是**装饰性的**（页面靠 cluster+namespace 取数），所以 `--workspace` 写错时
项目级照样全绿，而企业空间页八页全 404。工具现在会先解析：名字取不到就退到 `system-workspace`（或第一个可用）并打印。

## 11. 重试规则（有单元测试）

| 位置 | 规则 |
| --- | --- |
| 页面读 | 整页失败且全是 5xx → 重载一次（`state=none`，导航本身 503 也算） |
| 详情页 | 同上 |
| Tab | 该 Tab 全是 5xx → 再点一次 |
| 写入 | 5xx → 重试一次 |
| 对象查询 | 5xx → 重试一次（否则页面被误标 `skipped`） |

**判定规则有 20 条单元测试**（`tools/test_multicluster_retries.py`，0.03 秒，不需要集群）：
5xx 重试、404/403 不重试、渲染正常的页面不重载、混合失败不重试；写入判定覆盖「落到主集群」「没出现在目标集群」
「创建 5xx」「删了还在」「删除被拒」五类真实故障。

**Tab 是否「渲染了东西」按差值判断**：Tab 条本身就有几百字符，`body < 300` 会把「渲染了空态」误判成「什么都没渲染」。
现在记下点击前的长度，只有**没比点击前长 20 字符以上**才算异常。

## 12. 历史与作废数字

2026-11-17 早些时候的一批基线数字（「431 秒 PASS」「72 ready」等）来自**会话键写错**的时期——
页面实际停在登录页，那些数字**已作废**。逐条判定见[结论有效性清单](multicluster-conclusions-validity-20261117.md)；
本文第 9 节只保留修复后的记录，不再并存多套数字。
