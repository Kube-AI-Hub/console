# 多集群回归工具：一次跑完两个集群的集群级页面（2026-11-17）

> 新增 `tests/ui/tools/multicluster_sweep.py`。目标：**把「成员集群是否真的能用」变成一条命令**，
> 而不是每次手工点几个页面。

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
