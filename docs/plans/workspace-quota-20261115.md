# 租户(企业空间)配额迁移记录

> 当前批次证据。台账入口见[能力矩阵](capability-matrix.md) CHECK-05。
> 未提交。不要把本文件追加到其它历史计划。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 租户(企业空间)管理员看各项目配额上限与已用。数据粒度是项目 × 资源，不是空间级 `quota.kubesphere.io` CR。 |
| 旧入口、源码 | `/workspaces/:ws/quota`；`src/pages/workspaces/containers/QuotaManage/**`；按集群卡片 + `workspace.quota.edit`。 |
| 新入口 | `/kube-frontend/workspaces/<ws>/quota`；`WorkspaceQuotaPage.tsx`。本地 5178 + BFF 8092。未部署生产前端。 |
| 环境 | 实测 `system-workspace`：有项目、无 ResourceQuota 对象，空态。 |
| 视口、主题 | 1024 / 1280 深色中文。英文、浅色未作为本页主验。 |
| 明确排除及批准 | 空间级配额 CR 集合 GET 405、集群内 0 个对象，不做编辑入口；编辑走项目基本信息的 `QuotaEditDialog`。 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-WQ-001 | Banner WORKSPACE_QUOTA | 空间管理员 | 侧栏「配额」 | 保留；描述改为租户(企业空间) | AC-WORKSPACE_CONSOLE-02 | 通过 |
| LEG-WQ-002 | 按集群卡片展示 hard/used | 恒显 | CPU/内存等 | 改进：项目 × 资源表 | 同上 | 通过（改进） |
| LEG-WQ-003 | EDIT_QUOTAS 写空间级 CR | canEdit | PUT/POST `quota.kubesphere.io` | 批准不做：集合 405、对象 0 | PRD 明确不做 | 批准不做 |
| LEG-WQ-004 | 空/未配置 | 无 hard | 不渲染 | 保留空态 | 「这些项目还没有设置资源配额。」 | 通过 |
| LEG-WQ-005 | 多集群卡片 | 联邦 | 每集群一块 | 批准不做：本页 URL 无 cluster | 明确不做 | 批准不做 |

## 3. 数据契约

| 用途 | 路径 | 对账 |
| --- | --- | --- |
| 空间项目 | `workspaceDetailApi.projects` | system-workspace 有项目 |
| 项目配额 | `GET /api/v1/namespaces/<ns>/resourcequotas` | 本空间硬配额条目之和 = 0 → 空态 |
| 空间级 CR | tenant `…/resourcequotas` | 不调用（405） |

## 4. 交互与视觉

| 项 | 验证 |
| --- | --- |
| 空态文案 | [1280](assets/workspace-quota-20261115/quota-list-1280-empty.png)、[1024](assets/workspace-quota-20261115/quota-list-1024-empty.png)：标题「配额」，描述含「租户(企业空间)」，空文案「这些项目还没有设置资源配额。」 |
| 侧栏 | 配额 / 租户(企业空间)成员 / 租户(企业空间)角色 / 用户组 |
| 有数据表 | 本部署无 hard 条目；列契约由 E2E 在 N>0 时断言 项目/资源/上限/已使用 |

## 5. 测试

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @kube-ai-hub/console-next build` | 通过 |
| `python3 prd/tools/check_docs.py --strict` workspace-quota | errors=0 warnings=0 |
| `pytest` WORKSPACE_CONSOLE-02 `KA_APP_URL=http://localhost:5178` | 1 passed / 3.92s |

## 选择依据

CHECK-05 在项目成员之后是配额。页面骨架已在，空态却复用「该项目没有设置资源配额」，在空间页语义错。空间级编辑因接口不可枚举保持批准不做。跳过 B200 部署：仅新 UI。
