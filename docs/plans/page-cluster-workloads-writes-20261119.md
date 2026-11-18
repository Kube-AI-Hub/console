# 集群级工作负载：按项目筛选与写入口（2026-11-19）

> 本页记录：集群作用域七类负载列表补回旧 console 的「按项目筛选」，并补上三类通用写入口
> （编辑信息 / 编辑 YAML / 删除 + 批量删除）。方法见[迁移指南](../legacy-ui-migration-guide.md)，
> 模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群作用域：跨项目找对象（「这个项目里有什么」），找到后就地改或清理 |
| 旧入口、源码 | `clusters/containers/Workload/Deployments/index.jsx:69-161`（项目下拉 `ResourceTable/ProjectSelect`、行操作 编辑信息/编辑 YAML/重新部署/停止启动/删除、`isFedManaged` 收敛） |
| 新入口、构建 | `apps/console-next/src/pages/cluster/ClusterWorkloadsPage.tsx`（七类共用一页）：项目筛选 + 三个行操作 + 批量删除 |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 子页面与状态范围 | 项目筛选（含清空回全部项目）/ 普通行 / 联邦托管行 / 单选与批量删除 / 写入失败可见 |
| 明确排除及批准 | 重新部署、停止启动、扩缩容**不在本批**：每种负载规则不同（Job 无副本、Service 无模板），属于项目页职责（DEC 记录） |
| 并行文件与安全边界 | 只改该页、该功能 PRD/design/spec/tests 与记录；E2E 建唯一命名 Deployment 并删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码证据 | 显示条件 | 字段/动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-CLUSTER-WL-001 | `ResourceTable/ProjectSelect/index.jsx:56-71` | 始终 | 按项目筛选（可搜索/清空） | schema `filters` + `namespace` 参数 | AC-CLUSTER_WORKLOADS-03 / TC-03 | 通过 |
| LEG-CLUSTER-WL-002 | `Workload/Deployments/index.jsx:71-100` | 非联邦托管行 | 编辑信息 | `editInfo` + `EditInfoDialog` | 同上 | 通过 |
| LEG-CLUSTER-WL-003 | 同上 | 同上 | 编辑 YAML | `editYaml` + 懒加载编辑器 | 同上 | 通过 |
| LEG-CLUSTER-WL-004 | 同上 `:120-138` | 同上 | 删除（输入名称确认） | `delete` + `DeleteDialog` | 同上 | 通过 |
| LEG-CLUSTER-WL-005 | 同上 `:130-161` | 有勾选 | 批量删除 | `bulkActions` + 按项目分组删除 | 同上 | 通过 |
| LEG-CLUSTER-WL-006 | `isFedManaged` | 联邦托管 | 行操作收敛 | `visible: (row) => !row.federated` | 同上 | 通过 |
| — | 同上 `:140-160` | — | 重新部署 / 停止启动 / 扩缩容 | **不在本批**（项目页职责） | — | 记录不做 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段 | 显示/写 | 缺值规则 | 对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | `GET …/<kind>?namespace=<项目|空>` | JSON | `items`/`total` | 列表 + 分页 | 空值 = 跨项目 | 筛选进入 queryKey，切项目重新请求并回第 1 页 |
| 002 | `PATCH …/namespaces/<行ns>/<kind>/<name>` | JSON | 注解 | 对话框 | 清空键发 null | E2E 回读描述注解 |
| 003 | `PUT …/namespaces/<行ns>/<kind>/<name>` | JSON | 整对象 | YAML 编辑器 | 带 resourceVersion | — |
| 004–005 | `DELETE …/namespaces/<行ns>/<kind>/<name>`（批量按项目分组，每组一次） | JSON | — | 删除确认 | 按行命名空间 | E2E 用列表确认消失；分组保证部分失败可见 |
| 006 | — | — | `federated` | 隐藏操作 | — | 与配置三页同一守卫 |

## 4. 交互、视觉与复用基线

- 行操作顺序：编辑信息 → 编辑 YAML → 删除（旧页与项目页一致）。
- 项目筛选在搜索框右侧，与其他列表的筛选控件同形；清空即回全部项目。
- 批量删除的确认框列出所有选中对象名（跨项目时名称并列，删除按各自项目发出）。

## 5. 编码与回归

- [x] AC/design/spec/tests 同步；生成物重跑（507 篇）。
- [x] E2E：筛选（断言请求带命名空间）→ 搜索 → 编辑信息回读 → 删除确认消失。
- [x] 复用配置三页的对话框与守卫写法，不新增表单。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 6 条原子 ID（另 1 条记录不做） | — |
| 数据语义 | 通过 | 筛选走服务端；写按行命名空间 | — |
| 交互与权限 | 通过 | 三项操作、联邦保护、批量分组 | 真实非 admin 403 分支未在部署验证 |
| 视觉与主题 | 部分通过 | 1280 深色截图（`cluster-workloads-writes`） | 1024/1600、浅色、英文 |
| 静态/类型/构建/测试 | 通过 | typecheck 0；build 成功；strict 门禁 0/0 | — |
| 本地全栈/mlu370 | 通过 | E2E 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-…-CLUSTER_WORKLOADS-03（新增：筛选 + 编辑信息回读 + 删除确认） | 通过（7.14s） |
| CLUSTER_WORKLOADS 既有用例（01/02） | 通过 |

命令：`pytest tests/kube-frontend/cluster-management -q -n 0 -k "CLUSTER_WORKLOADS"` → **3 passed, 141 deselected in 29.17s**。
