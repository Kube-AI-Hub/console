# 配置字典（L2）

## 概述

`kube-frontend` 的第一个资源模块。它是 schema 抽象的验收用例：如果这一页需要手写页面骨架，说明抽象不成立，后续 24 个资源模块会退化成 24 份手写代码。

入口：`/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/configmaps`，从侧栏「配置字典」进入。

## 用户故事

### US1 - 作为项目成员，浏览本项目会被挂载到工作负载的配置

**Independent Test**：进入列表，确认能看到至少一条真实 ConfigMap 的名称、键、创建时间；点击名称进入详情，字段与 `kubectl get configmap -o yaml` 的 `data` 一致。

### US2 - 作为项目成员，清理不再需要的配置

**Independent Test**：删除一条自己创建的 ConfigMap，列表刷新后该条消失；再用 `kubectl get` 确认对象已不存在。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-CONFIGMAPS-01** — Given 项目内有真实 ConfigMap，When 打开列表并逐项核对，Then 名称、键、创建时间与 `kubectl` 输出一致，且分页总数与实际对象数一致。

## 页面结构

| 区域 | 内容 | 说明 |
|---|---|---|
| 页头 | 标题、一句说明 | 只出现一次 |
| 工具条 | 搜索框、「创建」、「批量删除」 | 主操作唯一且显眼 |
| 列表 | 名称 / 键 / 创建时间 / 操作列 | 小屏折叠「键」与「创建时间」 |
| 分页 | 页码与总数 | 仅在 `ready` 态出现 |

## 功能点

- 配置字典列表（`list`）
- 按名称搜索（`search`）
- 删除配置字典（`delete`）
- 智能体可操作性（`ai-surface`）
- 移动端适配（`mobile`）

## 异常态

| 状态 | 触发 | 呈现 |
|---|---|---|
| `loading` | 首次加载、切页、改排序 | 骨架行，`aria-busy` |
| `empty` | 查询成功但无结果 | 空态标题 + 一句引导，不渲染空表头 |
| `error` | 请求失败 | 一句人话 + 可重试时的重试按钮 |
| 权限不足 | 403 | 说明无权限，**不提供重试** |

## 设计目标

- 列表行为与老控制台一致，不因迁移丢失排序与搜索。
- 新增资源模块时，只替换列定义与查询，复用同一套页面骨架。

## 约束与边界

- 读走 BFF 的 `GET /api/configmaps`；删除走 `DELETE /api/configmaps?cluster&namespace&name`（可重复 `name` 实现批量）。
- 排序与分页由上游完成，BFF 不做二次排序：只排序当前页会得到跨页错误顺序。

## UI 交互设计

- 点击列头在 `asc` / `desc` 之间切换；切到新列时默认 `asc`。
- 搜索输入 250ms 后发起请求，并把页码重置为第 1 页。
- 翻页、改排序、改搜索都会清空已选项：对看不见的行做批量操作是删错东西的主要来源。

## 功能需求

- **FR-FULL-KUBE_FRONTEND-CONFIGMAPS-01** — 列表必须支持按名称与创建时间排序、按名称搜索、分页。

## 成功标准

- **SC-FULL-KUBE_FRONTEND-CONFIGMAPS-01** — 真实集群上与 `kubectl` 逐项核对无差异。

## 明确不做

- 不显示 YAML 原文与编辑入口（属创建 / 编辑能力，首期不做）。
- 不支持跨 namespace 查看。

## 假设

- 上游分页参数为 `page` / `limit`，返回 `totalItems`。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-CONFIGMAPS-01`
