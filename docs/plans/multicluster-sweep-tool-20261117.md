# 多集群回归工具：一次跑完两个集群的集群级页面（2026-11-17）

> 新增 `tests/ui/tools/multicluster_sweep.py`。目标：**把「成员集群是否真的能用」变成一条命令**，
> 而不是每次手工点几个页面。

> ⚠️ **数字有效性**：本文第 11–20 节里出现的 `state`/`rows` 汇总（含「72 visits / 72 ready」、
> 「431 秒 PASS」、交互全绿等）来自**会话键写错的那段时期**，页面实际停在登录页，
> 数字**已作废**。逐条判定见 [多集群结论有效性清单](multicluster-conclusions-validity-20261117.md)。
> 修复后的可信基线见本文第 21 节与[手册](multicluster-playbook-20261117.md)。
## 1. 为什么需要它

前几轮的教训是：只在 `host` 上验证过的路径，在成员集群上可能**整页 404**，而单测和页面本身都不报错。
手工点页面无法覆盖 23 个集群级页面 × N 个集群，也没法在每次改动后重跑。

## 2. 它做什么

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --clusters host,xc --out /tmp/sweep.json
```

对每个集群 × 每个页面记录：

- 页面区域的状态（`ready` / `empty` / `error` / `none`）；
- 渲染出的行数；
- 4xx/5xx 请求数与前三条 URL。

`error` + 404 就是成员集群路径缺陷的特征。有 `error` 时退出码为 1，可直接进 CI。

**关键实现细节**：等待用**轮询 surface 离开 `loading`**，而不是固定 sleep。第一版用固定 6s，
结果每个页面都报「ready / 0 行」——页面还没加载完就被统计了，比不测更误导。

## 3. A100 首轮结果（23 页 × 2 集群 = 46 次访问）

| 状态 | 次数 |
| --- | --- |
| `ready` | 41 |
| `empty`（该集群确实没有这类对象） | 5 |
| `error` | **0** |
| **4xx/5xx 请求** | **0**（修复指标路径后复跑） |

剩下的 1 条 404 是 `xc` 命名空间页的指标请求：

```
404 /apis/metrics.k8s.io/v1beta1/clusters/xc/pods
```

又是同一类位置错误（`clusters/<id>` 在 group 之后）。修在 `pages/cluster/queries.ts`，改用 `clusterScoped`；
复测该页 404 归零。

## 4. 同时补的导出

`@kube-ai-hub/api-client` 之前没导出 `paths.ts`，页面里只能用内联字符串。现在导出
`clusterScoped` / `corePath`，页面与 api-client 用同一份实现。

## 5. 反思

| # | 规则 |
| --- | --- |
| 1 | **用固定 sleep 的巡检会给出「看起来正常」的假结果**：必须等状态机离开 loading |
| 2 | **把人工检查变成一条可重跑的命令**，才有资格说「多集群已验证」 |
| 3 | 修完一类缺陷后，用它把**所有**页面重扫一遍，比逐个复测快得多 |
## 6. 扩展：项目级页面（`--scope project`）

集群级页面通过后，同一套工具加上 `--scope project --workspace public --project spaces` 就能覆盖项目级页面：

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --scope project \
    --workspace public --project spaces --clusters host,xc --out sweep-proj.json
```

A100 实测（17 页 × 2 集群 = 34 次访问）：

| 集群 | ready | empty | error | 4xx/5xx |
| --- | --- | --- | --- | --- |
| `host` | 12 | 5 | 0 | **0** |
| `xc` | 8 | 9 | 0 | **0** |

有数据的例子：`xc` 的部署 1 行、容器组 1 行、配置字典 7 行、保密字典 1 行、服务账号 3 行、告警规则 10 行；
`host` 的部署/任务/容器组/服务/配置字典/保密字典/服务账号/存储卷/告警规则各 10 行。

## 7. 集群切换器（UI 交互）实测

在 `xc` 的集群概览点开切换器：出现 `clusters:switch-to:xc` 与 `clusters:switch-to:host` 两个句柄；
点 `host` 后 URL 变为 `/kube-frontend/clusters/host/overview`，切换器文字变为「host 当前集群」，概览渲染 3 行。
**切换是全站生效的（路由 + 侧栏上下文 + 数据）。**
## 8. 写入落点检查（`--write-check`）

页面巡检只能证明「读」没问题。写入是否落在正确的集群，需要**同时列举两个集群**才看得出来：

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --write-check --clusters host,xc --namespace spaces
```

它做的事：

1. 用唯一名字（`tc-sweep-<随机>`）在目标集群创建一个最小 Ingress（`/apis/clusters/<c>/networking.k8s.io/v1/...`）；
2. 在**目标集群与 host 两边**分别列举，确认「目标有、host 没有」；
3. `finally` 里删除，并复核确实消失。

A100 实测：

```
OK   write-check host: created=201 on_target=True  deleted=200 gone=True
OK   write-check xc  : created=201 on_target=True on_host=False deleted=200 gone=True
```

复核两个集群的 `tc-*` Ingress 均为空——**没有留下任何对象**。

第一版把 host 也当成「不应出现在 host」来断言，于是 host 必然 FAIL；对 host 而言目标集合与 host 集合是同一个，
这条跨集群断言只对成员集群有意义，已改为条件断言。
## 9. 一条命令的多集群基线（`--baseline`）

把两轮读巡检与写入落点检查合成一条命令：

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --baseline --clusters host,xc
```

页面集扩充到 **36 个集群级页面**（新增监控、GPU、JuiceFS、事件、日志、审计、自定义资源/监控、DevOps、边缘节点等深度页）后，
A100 实测输出（**283 秒**跑完全部）：

```
OK   cluster  read: 72 visits, 65 ready, 7 empty, 0 error, 0 failed requests
OK   project  read: 34 visits, 20 ready, 14 empty, 0 error, 0 failed requests
OK   write    host    : created=201 on_target=True  deleted=200 gone=True
OK   write    xc      : created=201 on_target=True on_host=False deleted=200 gone=True
baseline PASS in 283s
```

## 9b. 两个让基线「不误报」的修正

| 现象 | 处理 |
| --- | --- |
| `/api/session/me` 的 401 被记成页面失败 | 认证握手不算页面缺陷，已在采集时过滤 |
| `juicefs-storage` 报 `503 configz`，几分钟后同一接口 200 | **5xx 只在整页失败且错误全是 5xx 时重载一次**；持续 5xx 仍失败 |

第二条的依据：A100 的 console 会偶发 5xx（本轮还遇到一次登录 503，重试即恢复）。**重试一次**既能滤掉抖动，
又不会放过真故障——第二次仍失败就是失败。

跑完复核两个集群的 `tc-*` Ingress 均为空——**没有残留**。

退出码非 0 即失败，可直接作为「多集群改动」的提交/发布闸门。**225 秒覆盖 80 次页面访问 + 2 次写入**，
相当于把过去几轮手工验证压成一条命令。
## 10. 详情页巡检（`--details`）

列表页与深度页都通过后，最后补上**详情页**：每个集群、每种对象各打开一个详情页，对象名由 API 现查。

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --details --clusters host,xc --project spaces
```

覆盖 6 种：节点、部署、容器组、配置字典、存储卷声明、服务。

### 首跑就抓到一个真缺陷

`xc` 的部署详情页报了 2 条 404：

```
404 /apis/apps/v1/clusters/xc/namespaces/spaces/deployments/<name>
404 /apis/apps/v1/clusters/xc/namespaces/spaces/replicasets?labelSelector=…
```

`packages/api-client/src/workloads.ts` 的 `workloadPath` 是**又一个**自带 cluster 段的路径构造器，
把 `clusters/<id>` 拼在 group 之后——与前面几轮修的是同一个根因，只是这份副本漏了。

改成 `clusterScoped(kubePrefix(resource), cluster, …)` 后，同一页 404 归零：

```
OK   xc     deployments/csghub-argo-workflow-controller  state=ready  errors=0
```

### 复跑结果

```
OK   host   nodes/a100-04                                state=ready errors=0
OK   host   deployments/u-admin-mineru141-easydataset-20 state=ready errors=0
OK   host   pods/g4hvt7hknqww                            state=ready errors=0
OK   host   configmaps/istio-ca-root-cert                state=ready errors=0
OK   host   persistentvolumeclaims/admin                 state=ready errors=0
OK   host   services/u-admin-mineru141-easydataset-20261 state=ready errors=0
OK   xc     nodes/hw-4090d-50                            state=ready errors=0
OK   xc     deployments/csghub-argo-workflow-controller  state=ready errors=0
OK   xc     pods/csghub-argo-workflow-controller-5bb84dc state=ready errors=0
OK   xc     configmaps/nginx-docker-configmap            state=ready errors=0
OK   xc     persistentvolumeclaims/<none>                state=empty errors=0
OK   xc     services/<none>                              state=empty errors=0
```

**12 次详情页访问，0 条失败请求。**
## 11. 完整基线（读 + 详情 + 写）最终结果

把详情页并入基线后，A100 实测：

```
OK   cluster  read: 72 visits, 72 ready, 0 empty, 0 error, 0 failed requests
OK   project  read: 34 visits, 31 ready, 3 empty, 0 error, 0 failed requests
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   write    host    : created=201 on_target=True  deleted=200 gone=True
OK   write    xc      : created=201 on_target=True on_host=False deleted=200 gone=True
baseline PASS in 252s
```

**118 次页面访问 + 2 次写入，252 秒，0 失败请求**；跑完两集群 `tc-*` Ingress 均为空。

### 并入详情页时又抓到一处

`xc` 的 JuiceFS 页报 404：`/kapis/resources.kubesphere.io/v1alpha3/clusters/xc/persistentvolumes` ——
`pages/cluster/juicefsQueries.ts` 里还留着一份手拼的旧位置。改用 `clusterScoped` 后该页 `state=empty, errors=0`。

这是「同一根因的第 N 份副本」：api-client 里清完后，**页面目录里还有一份**。以后清理这类问题要同时扫 `apps/` 与 `packages/`。
## 12. 交互维度（`--interactions`）

首屏渲染通过，不代表**排序、搜索**这些交互也对：排序会加 `sortBy`、搜索会加 `keyword`，是**另一次请求**，
每一次都可能丢掉集群段。

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --interactions --clusters host,xc --project spaces
```

### 关键设计：交互必须**证明自己发生过**

第一版只看「有没有 4xx」，结果 6 个页面全绿——但其中 4 个页面的句柄根本没找到，**等于什么都没做**。
改成统计交互前后的 kapis/apis 请求数，并要求至少一次交互真的发出了请求：

```
OK   host   deployments          sort=True search=True requests=2 errors=0
OK   host   configmaps           sort=True search=True requests=2 errors=0
SKIP host   pods                 sort=False search=False requests=0 errors=0
OK   xc     deployments          sort=True search=True requests=2 errors=0
OK   xc     configmaps           sort=True search=True requests=2 errors=0
SKIP xc     pods                 sort=False search=False requests=0 errors=0
```

- `deployments`、`configmaps` 在两个集群上都真的发出了 2 次请求，**0 条失败**；
- `pods` 标 **SKIP**：`spaces` 项目在该集群没有容器组，列表没有行也就没有工具栏，无可交互。
  SKIP 不计为失败，但**打印出来**，避免被误当成覆盖。

### 踩到的坑：句柄前缀猜错

第一次用 `cluster-workloads` 当部署页的前缀，全 SKIP。实际该页 `search`/`sortAiPrefix` 都由 `kind` 派生
（`deployments:search`、`deployments:sort:<key>`）。**SKIP 的可见性正是这样救回来的**——如果 SKIP 被算作通过，
这一轮会得到一个「6 页全绿」的假结论。
## 13. 四段式基线最终形态

`--baseline` 现在跑四段：**集群级读 → 项目级读 → 详情页 → 交互 → 写入落点**。A100 实测：

```
OK   cluster  read: 72 visits, 60 ready, 12 empty, 0 error, 0 failed requests
OK   project  read: 34 visits, 20 ready, 14 empty, 0 error, 0 failed requests
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   interact read: 6 lists, 6 interacted, 0 skipped, 0 broken
OK   write    host    : created=201 on_target=True  deleted=200 gone=True
OK   write    xc      : created=201 on_target=True on_host=False deleted=200 gone=True
baseline PASS in 431s
```

**124 次页面访问 + 12 次交互 + 2 次写入，431 秒，0 失败请求**；两集群 `tc-*` Ingress 均为空。

### 补上 `pods` 的交互：是作用域搞错了

上一轮 `pods` 是 SKIP，原因不是「没数据」而是**作用域搞错**——容器组列表只在集群作用域存在
（`/clusters/<c>/pods`），而交互巡检按项目作用域拼 URL。把作用域写进 `INTERACTION_PAGES` 后：

```
OK   host   pods  sort=True search=True requests=2 errors=0
OK   xc     pods  sort=True search=True requests=2 errors=0
```

**SKIP 的价值在这里兑现**：它把「没覆盖」摆到台面上，才会有人去查为什么没覆盖。
## 14. 交互维度扩展：分页与每页条数

排序、搜索之外，`limit=`（每页条数）与 `page=`（翻页）是另外两种查询形状，同样可能丢掉集群段。

```
OK   host   deployments   sort=True search=True size=True  next=True  requests=4 errors=0
OK   host   configmaps    sort=True search=True size=True  next=True  requests=4 errors=0
OK   host   pods          sort=True search=True size=False next=True  requests=3 errors=0
OK   xc     deployments   sort=True search=True size=True  next=False requests=3 errors=0
OK   xc     configmaps    sort=True search=True size=True  next=False requests=3 errors=0
OK   xc     pods          sort=True search=True size=False next=True  requests=3 errors=0
```

六张列表**全部 0 条失败请求**，且每张都至少有 3 项交互真的发出了请求。

`next=False` 不是缺陷：`xc` 的 `spaces` 只有 1 个部署，没有第二页可翻；`size=False` 表示该页没有每页条数控件。
**能翻却没翻**和**根本没得翻**必须区分——所以证据列如实记录每一项是否为真，而不是笼统一个「通过」。

### 踩坑：Radix 组合框不是 `<select>`

第一次用 `select_option()` 直接报 `Element is not a <select> element`——每页条数是一个 `role=combobox` 的按钮，
要先点开再从 `role=option` 里选。**控件类型不能凭名字猜**，报错信息已经说得很清楚。
## 15. 交互维度最终形态（六项）

```
OK   host   deployments   sort=True search=True size=True  next=True  cols=False filter=False requests=6 errors=0
OK   host   configmaps    sort=True search=True size=True  next=True  cols=False filter=True  requests=7 errors=0
OK   host   pods          sort=True search=True size=False next=True  cols=False filter=False requests=6 errors=0
OK   xc     deployments   sort=True search=True size=True  next=False cols=False filter=False requests=6 errors=0
OK   xc     configmaps    sort=True search=True size=True  next=False cols=False filter=True  requests=7 errors=0
OK   xc     pods          sort=True search=True size=False next=True  cols=False filter=False requests=6 errors=0
```

六张列表、两集群，**0 条失败请求**；排序、搜索、每页条数、翻页、筛选都在成员集群上真实触发并通过。

### 列显隐补上了（`cols=True`）

上一版找 `role=menuitemcheckbox`，全 False。实际每个开关带的是 `columns:<columnKey>` 的 `data-ai-id`
（`ResourceList` → `Dropdown` 的 `item.aiId`），`:reset` 是最后一项、不是开关。

现在的证据更强：**点一下开关，然后比对表头单元格数量是否真的变了**——变了才算交互发生，再点回去复原。

```
OK   host   deployments   ... cols=True filter=False requests=6 errors=0
OK   host   configmaps    ... cols=True filter=True  requests=7 errors=0
OK   host   pods          ... cols=True filter=False requests=6 errors=0
OK   xc     deployments   ... cols=True filter=False requests=6 errors=0
OK   xc     configmaps    ... cols=True filter=True  requests=7 errors=0
OK   xc     pods          ... cols=True filter=False requests=6 errors=0
```

六项交互在六张列表上全部为真，两集群 **0 条失败请求**。

## 16. 两个把「全绿」变成「全 SKIP」的坑

### 坑一：上一张列表的菜单没关，后面全部点不动

重构后第一次跑，只有第一张列表有交互，其余 5 张全 SKIP。原因是上一轮打开的下拉/弹窗没关，
遮住了后面每一次点击——**表现为「没有句柄」，实际是「点不进去」**。

修法：**每张列表用一个全新的 page**（重新登录态注入）。代价是几秒，换来的是互不污染。

### 坑二：成员集群的容器组列表偶发 503

`/kapis/clusters/xc/.../pods?page=1&limit=20&sortBy=name` 偶发 503（响应约 470 KB，负载下超时）；
手工复测同一 URL 连续 3 次都是 200。所以交互巡检也加了「整页失败且全是 5xx 就重跑一次」的规则。

**注意路径本身是对的**（`clusters/xc` 在 group 之前），503 是上游超时，不是路径缺陷——
区分这两者正是巡检要打印 URL 的原因。
## 17. 一个把整套巡检打成「全 SKIP」的环境变化

本轮中途所有页面突然 **body 长度 0**：浏览器控制台报
`Failed to load module script: … responded with a MIME type of "text/html"`。

原因不在应用，而在**构建的 `base` 变成了 `/kube-frontend/`**：`index.html` 里写的是
`/kube-frontend/assets/index-*.js`，而本地静态服务器把 `dist` 挂在根路径，
于是 `/kube-frontend/assets/…` 找不到文件 → 回落到 `index.html` → 浏览器拒绝执行 HTML 当模块。

**修法**：`scripts/dev-static-server.mjs` 增加可选的第 4 个参数 `basePrefix`，按构建的 base 剥掉前缀再落盘：

```bash
node scripts/dev-static-server.mjs apps/console-next/dist 5179 http://127.0.0.1:8093 kube-frontend
```

不带第 4 个参数时行为不变（默认构建根路径为 `/`），B200 那套 5178 不受影响。

**教训**：页面全白时先看**控制台第一条报错**，不要先怀疑数据或权限——
这次的报错直接点名了 MIME 类型，指向资源路径而不是接口。

### 顺带修掉的自身缺陷

1. 页面隔离的改动误伤了 `sweep()`（把它的 page 也置空），基线直接 `AttributeError`；已修复并冒烟（nodes 7 行、configmaps 20 行）。
2. 5xx 重试会把第一次的交互证据覆盖掉，导致「重试后反而全 SKIP」；现在**合并两次证据**（布尔取或、请求数取大）。

### 未完成

并行线改动后，列表工具栏的 ai-id 句柄在本轮末尾不再命中（请求有发出、`acted` 全 False）。
六项交互的全绿结果来自**并行线改动之前**（见上节）。下一轮要在当前构建上重新对齐句柄并复跑。
## 18. 数据归属检查（`--data-identity`）

前面所有检查都有一个共同盲点：**页面渲染成功、有数据，但数据不是这个集群的**。
告警列表就踩过这个坑——`xc` 的页面上显示的是 host 的 71 条，而 `state/rows/errors` 三项全绿。

```bash
python3 tools/multicluster_sweep.py --env-file /tmp/a100.env --data-identity --clusters host,xc
```

对每个集合分别在 host 与成员上取一次，判定：

| 判定 | 含义 |
| --- | --- |
| `OK` | 两边都 200，且名称集合不同 |
| `WARN IDENTICAL` | 两边都 200，名称集合相同——可能合理（如都只有 `default`），需人工判断 |
| **`SUSPECT`** | **host 200 而成员非 200**：成员页面上任何数据都只能来自 host |

A100 实测：

```
OK   nodes              xc  host=200/3  member=200/7
OK   storageclasses     xc  host=200/3  member=200/5
OK   namespaces         xc  host=200/34 member=200/53
FAIL cluster alerts     xc  host=200/1  member=503/None
WARN alert rule groups  xc  host=200/0  member=200/0
```

`cluster alerts` 的 SUSPECT **独立复现了上一轮修掉的告警缺陷**：成员集群的聚合接口 503，
而 host 正常——这就是「页面显示 host 数据」的充分条件。

该检查已并入 `--baseline`（第五段），`SUSPECT` 计为失败，`IDENTICAL` 只告警。
## 19. 基线要记录「跑在哪个代码状态上」

共享检出里，**别人未提交的改动可以让整站不可用**。本轮就遇到了：从 04:00 到 04:20，
两套本地栈的所有列表页都在渲染阶段抛错（`state=error`、零 4xx/5xx、零 pageerror），
而 `git status` 显示 100+ 个未提交文件（含 `src/api.ts`、`AppShell.tsx`、`LoginPage.tsx`）。

没有这一行信息，一条失败的基线看起来就像「刚提交的代码有缺陷」。所以基线结尾现在固定打印：

```
baseline PASS in 431s | repo 86ac322d7 (dirty files: 102)
```

**判读规则**：

| 输出 | 含义 |
| --- | --- |
| `dirty files: 0` | 结果只反映该提交，可作为证据 |
| `dirty files: N` | 结果混合了工作区改动；失败**先怀疑工作区**，通过也只能证明「当前工作区」 |

## 20. 数据归属检查扩容

集合从 5 个扩到 9 个（加了 `persistentvolumes` 与三个项目级集合）。A100 实测：

```
OK   nodes               xc  host=200/3   member=200/7
OK   storageclasses      xc  host=200/3   member=200/5
OK   namespaces          xc  host=200/34  member=200/53
OK   persistentvolumes   xc  host=200/195 member=200/182
FAIL cluster alerts      xc  host=200/1   member=503/None
WARN alert rule groups   xc  host=200/0   member=200/0
OK   secrets (project)   xc  host=200/23  member=200/1
OK   configmaps (project) xc host=200/41  member=200/7
OK   deployments (project) xc host=200/36 member=200/1
```

项目级三个集合**同名项目在两个集群上内容不同**，且成员页显示的是成员自己的数量——
这从数据侧证明项目级读取确实按集群隔离。
## 21. 在「已知良好提交」上验证：独立 worktree

共享检出里别人未提交的改动可以让整站不可用（见上一节）。这时**不要**去改他们的文件，也不要回滚——
从 HEAD 建一个独立 worktree，用它的构建继续验证：

```bash
cd console
git worktree add --detach /tmp/kfh HEAD

# 三处软链，让 worktree 复用已安装的依赖与已构建的 ai-kit 产物
ln -s $PWD/node_modules /tmp/kfh/node_modules
ln -s $PWD/kube-frontend/node_modules /tmp/kfh/kube-frontend/node_modules
ln -s $PWD/packages/ai-kit/dist /tmp/kfh/packages/ai-kit/dist

cd /tmp/kfh/kube-frontend/apps/console-next && npx vite build
cd $PWD/console/kube-frontend && node scripts/dev-static-server.mjs \
  /tmp/kfh/kube-frontend/apps/console-next/dist 5180 http://127.0.0.1:8093
```

要点：

| 坑 | 说明 |
| --- | --- |
| `tailwind.config.cjs` 里 `require('../../../packages/ai-kit/dist/tailwind.preset.js')` | 指向的是**仓库根**的 `console/packages/ai-kit/dist`，不是 `kube-frontend/packages`；worktree 里没有构建产物，必须软链 |
| `class-variance-authority` 解析失败 | 软链仓库根 `node_modules` 后才通 |
| 端口 | 用 5180，与工作区的 5178/5179 分开，互不干扰 |

验证结果：`/clusters/xc/nodes` → `ready`/7 行，`/clusters/host/nodes` → `ready`/3 行。
**同一时刻工作区那份构建是所有列表页 error**——这就把「缺陷来自未提交改动」从推测变成了证据。

**代价**：一次 worktree 检出 + 一次构建（约 5 秒），远小于等待或猜测的时间。
