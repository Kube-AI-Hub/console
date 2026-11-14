# 企业空间配额 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-quota.md)

## 概述

`/kube-frontend/workspaces/<ws>/quota`：把企业空间下各项目的 ResourceQuota 展开成「项目 × 资源」的只读表。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02

## 设计目标与非目标

目标：一个请求组合拿到项目与配额，行与接口一一对应；空态能区分「没有项目」与「项目没有配额」。
非目标：企业空间级 quota 对象、配额编辑、用量趋势图。

## 关键约束

- 工作空间级 ResourceQuota **只能按名字读**：`GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/resourcequotas` 探测为 **405**，集群内 `quota.kubesphere.io/resourcequotas` 为 0 个对象，无法枚举。
- 项目级 ResourceQuota 在核心组：`GET /api/v1/namespaces/<ns>/resourcequotas`（200）。
- 页面在 workspace 作用域，URL 不带 cluster 段。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03 — 行粒度取「项目 × 资源」，数据取项目级 ResourceQuota

**为什么**：老 console 的配额页是空间级对象，但本部署既没有对象也没有枚举接口（探测见 PRD「明确不做」）。项目级 ResourceQuota 是同一读者真正会调整的东西，且 `spec.hard` / `status.used` 正好是「配额/已用」。
**被否方案**：展示一个永远空的「企业空间配额」面板；或在页面里按对象名逐个猜（唯一可读的形态是 `<ws>` 名字的详情，实测 404）。
**何时重新考虑**：部署里重新出现 `quota.kubesphere.io` 对象并补了集合 GET 接口时，可加空间级汇总区块，但不替换本表。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04 — 按项目并发读取，而不是集群级一次性 list

**为什么**：`GET /api/v1/resourcequotas?limit=-1` 是平台管理员权限；企业空间成员被授权在空间内的项目里，按项目读是页面的真实权限模型。项目数在本部署为 1 与 10，并发成本可接受。
**被否方案**：集群级 list + 客户端按项目名过滤。它要求一个本页不该要求的权限，且在不允许时整页报错。
**何时重新考虑**：出现数百项目的企业空间时，改为工作空间级聚合接口（需要后端提供）。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05 — 页面直接调用 apiClient.request，不扩展 api-client

**为什么**：本轮三页的读接口只有本页使用，且 `api-client` 正在被并行工作修改；把路径与映射写在页面内可以避免共享 barrel 文件的冲突。路径形状与视图映射都很短，没有第二处读者。
**被否方案**：在 `packages/api-client` 新增 `workspaceQuotasApi` 并在 `index.ts` 导出。接口稳定后应迁移过去（见「后续改进」）。
**何时重新考虑**：第二个页面需要同一组接口，或写路径要复用。

## 系统现状

老 console `src/pages/workspaces/containers/QuotaManage`：按集群渲染 `ResourceQuota` 卡片，数据来自 `kapis/tenant.kubesphere.io/v1alpha2` 的 `resourcequotas/<workspace>`。新 UI 没有空间级对象可读，改用项目级集合。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/WorkspaceQuotaPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/quota/{route,index}.tsx`
- 侧栏/区域：`areas/registry.ts` 的 workspace 区域（已有条目，无需改动）

## 对外契约

| 用途 | 路径 | 说明 |
| --- | --- | --- |
| 空间项目 | `/kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=<ws>&limit=-1` | 经 `workspaceDetailApi.projects` |
| 项目配额 | `/api/v1/namespaces/<ns>/resourcequotas` | 每项目一次，`spec.hard` + `status.used` |
| 空间级配额（不可用） | `/kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/resourcequotas` | 集合 GET 405，不调用 |

## 不变量

1. 行数 = 各项目 ResourceQuota 的 `Object.keys(spec.hard)` 之和。
2. 每行都带项目名与资源键；同一 (项目, 资源) 不重复（一个项目多个 quota 对象时按对象展开，键可能重复——见已知坑）。
3. 读取失败不降级为空态。

## 已知坑

- `403` 与「没有配额」在上游都是空数组：本实现让请求异常冒泡成错误面板，只有成功返回的 `items: []` 才算「没有设置配额」。
- 一个项目可能有多个 ResourceQuota 对象（Kubernetes 取交集）。本实现全部展开；如果出现重复资源键，会渲染两行同 (项目, 资源) 但各自的上限。行 key 含 quota 对象名可避免 React 复用——当前以「项目/资源/对象名」拼 key（见实现）。
- `status.used` 只在已产生用量时出现，缺失`0` 是正确的展示，不是接口失败。
- 页面状态标签：`AiSurface` 的 `state` 必须区分 loading/error/empty/ready，测试等待 `data-ai-state` 离开 loading。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02.yaml`
可观测点：`workspace-quota:surface`（容器、`data-ai-state`）、`workspace-quota:retry`、`tr[data-ai-row]`（行属性 `项目/资源`）。

## 后续改进

- 把读取逻辑迁到 `packages/api-client`（DEC-05）。
- 若有后端聚合接口（工作空间级配额列表），改为服务端分页。
- 已用/上限的进度条与超配额高亮。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02
