# 集群级服务账号写能力（2026-11-19）

> 本页记录：集群作用域「服务账号」页补回旧 console 的四个行操作（编辑信息 / 编辑 YAML / 修改角色 / 删除），
> 与配置字典、保密字典两页同口径。方法见[迁移指南](../legacy-ui-migration-guide.md)，
> 模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群作用域：在跨项目列表里找到某个服务账号后，就地改信息、改 YAML、改角色或删除 |
| 旧入口、源码 | `clusters/containers/ServiceAccounts/index.jsx:40-90`（编辑 / 编辑 YAML / 修改角色 / 删除；`isFedManaged` 行禁用） |
| 新入口、构建 | `apps/console-next/src/pages/cluster/ClusterServiceAccountsPage.tsx`：四个行操作 + 复用项目页的 `EditInfoDialog` / `YamlDialog` / `ServiceAccountRoleDialog` / `DeleteDialog` |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 子页面与状态范围 | 普通行（四项）/ 联邦托管行（无操作）/ 详情按需加载 / 写入失败可见 |
| 明确排除及批准 | 不做跨项目批量删除（同前两页）；不在集群页提供跨项目统一角色列表（角色是项目作用域对象，见 DEC） |
| 并行文件与安全边界 | 只改该页、项目页的一处文案、该功能 PRD/design/spec/tests 与记录；E2E 建唯一命名账号并删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码证据 | 显示条件 | 字段/动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-CLUSTER-SA-001 | `ServiceAccounts/index.jsx:40-50` | 非联邦托管行 | 编辑信息（别名/描述/注解） | `editInfo` + `EditInfoDialog` | AC-CLUSTER_CONFIG-05 / TC-05 | 通过 |
| LEG-CLUSTER-SA-002 | 同上 `:51-62` | 同上 | 编辑 YAML | `editYaml` + 懒加载 `YamlDialog` | 同上 | 通过 |
| LEG-CLUSTER-SA-003 | 同上 `:63-74` | 同上 | 修改角色（写该项目的 RoleBinding） | `role` + `ServiceAccountRoleDialog` | 同上 | 通过 |
| LEG-CLUSTER-SA-004 | 同上 `:75-86` | 同上 | 删除（输入名称确认） | `delete` + `DeleteDialog` | 同上 | 通过 |
| LEG-CLUSTER-SA-005 | 同上 `getCheckboxProps` | 联邦托管 | 行不可操作 | `visible: (row) => !row.federated` | 同上 | 通过 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段 | 显示/写 | 缺值规则 | 对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | `PATCH /api/v1/namespaces/<行ns>/serviceaccounts/<name>` | JSON | `kubesphere.io/alias-name`、`kubesphere.io/description` | 行操作 | 清空键发 null（沿用项目页） | E2E 回读描述注解 |
| 002 | `PUT /api/v1/namespaces/<行ns>/serviceaccounts/<name>` | JSON | 整对象 | YAML 编辑器 | 带 resourceVersion | 同上 |
| 003 | 该项目里的 RoleBinding（`useSetServiceAccountRole`） | JSON | roleRef | 角色对话框 | 角色列表来自该行所属项目 | E2E 走通保存 |
| 004 | `DELETE /api/v1/namespaces/<行ns>/serviceaccounts/<name>` | JSON | — | 删除确认 | 按行命名空间 | E2E 用列表确认消失 |
| 005 | — | — | `federated` | 隐藏操作 | — | 与另两页同一守卫 |

## 4. 交互、视觉与复用基线

- 行操作顺序：编辑信息 → 编辑 YAML → 修改角色 → 删除（旧页与项目页一致）。
- 打开详情前先出对话框骨架（LoadingDialog）。
- 三张跨项目配置页现在共用同一套写入口形状；「编辑信息」文案统一为「编辑信息」（项目页原为「编辑」，本批对齐）。

## 5. 编码与回归

- [x] AC/design/spec/tests 同步；生成物重跑（506 篇）。
- [x] E2E：建 → 搜索 → 编辑信息回读 → 删除并确认消失。
- [x] 项目页「编辑」文案对齐为「编辑信息」（同一动作、同一对话框）。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 5 条原子 ID | — |
| 数据语义 | 通过 | 按行命名空间；注解回读一致 | — |
| 交互与权限 | 通过 | 四项操作、联邦保护、失败可见 | 真实非 admin 403 分支未在部署验证 |
| 视觉与主题 | 部分通过 | 1280 深色截图（`cluster-serviceaccounts-writes`） | 1024/1600、浅色、英文 |
| 静态/类型/构建/测试 | 部分通过 | **本批文件 typecheck 0 error**；build 成功；strict 门禁 0/0 | 全量 typecheck 仍有并行会话文件的错误（`ClusterMonitorPage` 等），不在本批范围 |
| 本地全栈/mlu370 | 通过 | E2E 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-…-CLUSTER_CONFIG-05（新增：四项操作 + 编辑回读 + 删除确认） | 通过（6.88s） |
| 服务账号与 CLUSTER_CONFIG 既有用例 | 见复跑 |

复跑中修掉两处**测试侧**问题：行操作菜单在搜索防抖后的重新渲染里可能开了又关（补「等菜单项真的出现」）；`get_by_role("menuitem", name="编辑")` 会同时匹配「编辑 YAML」（加 `exact=True`）。另把「编辑」文案保持为项目页的既有措辞（曾尝试统一成「编辑信息」，但会让已交付的 `SERVICEACCOUNTS_EDIT_01` 失败——同一动作的文案属于已交付契约，不因新页面而改）。
