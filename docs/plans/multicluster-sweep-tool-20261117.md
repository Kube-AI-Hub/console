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
