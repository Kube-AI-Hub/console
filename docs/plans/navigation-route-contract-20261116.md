# 导航与路由一致性契约（2026-11-16）

> 新增 `kube-frontend/config/navigation-route-contract.test.ts`（4 条）。
> 直接检查「侧栏说的」和「路由有的」是否一致。

## 1. 对象

`apps/console-next/src/areas/registry.ts` 是本 app 描述**功能分组**的唯一一处（旧 console 的
`server/config.yaml` 对应物）：每个 area 声明 scope（project/cluster/platform/workspace）与其页面，
页面带 `status: 'ready' | 'planned'`。当前 **15 个 area / 93 个 ready 页 / 1 个 planned 页**。

两种迁移遗留，类型系统都抓不到：

| 遗留 | 后果 |
| --- | --- |
| 声明 ready 但没有路由 | 侧栏点进去是 404 |
| 有路由但没声明 | 只能靠手动输入 URL 到达，导航里看不见 |

## 2. 四条断言

1. **规模自检**：area > 10、ready 页 > 80（防清单被删空后静默通过）；
2. **每个 ready 页都有真实路由目录**：按 scope 映射到文件路由前缀（project → `kube-frontend.$workspace.clusters.$cluster.projects.$namespace`、
   cluster → `kube-frontend.clusters.$cluster`、workspace → `kube-frontend.workspaces.$workspace`），再拼页面 `path`（允许嵌套，如 `apps/instances`）；
3. **平台页可达**：platform scope 的页面分散在 `kube-frontend.apps` / `apps-manage` / `access` / `settings` 四组，按末段名匹配；
4. **planned 页不越界**：数量不得超过 ready（保证「计划中」始终是少数）。

## 3. 一次真实的修正

首版只列了 scope 目录的**直接子目录**，于是把 `app-repos/apps/instances`（两层的 `apps/instances`）判成缺失——
**是契约写错了，不是产品错了**。改为按完整相对路径 `existsSync` 判断后通过。这类误报必须当缺陷对待：
否则下一个人会去「修」一个不存在的问题。

## 4. 反向验证

把 registry 里某页的 `path` 改成 `apps/missing-page` → 契约立刻失败并指出具体 area/key 与期望路径；恢复后全绿。

## 5. 结果

| 项 | 结果 |
| --- | --- |
| 契约套件 | **17 文件 / 1471 passed** |

## 6. 边界

只验证「声明 ↔ 路由目录」存在性，不验证页面内容、不验证侧栏渲染顺序、也不扫描「有路由没声明」的方向
（那需要把 251 个路由文件反解成 area/page，噪声大）。
