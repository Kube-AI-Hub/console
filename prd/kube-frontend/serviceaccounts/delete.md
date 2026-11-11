# 删除服务账户（L3）

## 概述

行操作「删除」（单条）与工具条「批量删除」（所选），共用输入名称确认弹窗，规则与保密字典相同。

## 用户故事

### US1 - 作为项目成员，删掉不再使用的服务账户

**Independent Test**：删除并输入名称确认，行消失，`kubectl get sa <name>` 返回 NotFound。

## 验收场景

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-DELETE-01** — Given 打开删除弹窗，When 输入与名称不一致，Then 确认禁用；When 输入一致并确认，Then 对象被删除、列表刷新、选择清空；批量删除要求输入以逗号加空格分隔的全部名称。

## 设计目标

- 与保密字典、配置字典同一套确认规则，减少「同一个动作在不同页面要背不同确认方式」。

## 约束与边界

- `DELETE /api/v1/namespaces/{ns}/serviceaccounts/{name}`，批量串行。
- 删除服务账户不会删除它的令牌 Secret（由控制器决定，通常随账户清理）；本页不代劳。

## UI 交互设计

- 弹窗标题：删除服务账户 / 批量删除服务账户。确认按钮危险样式。

## 文案与校验

- 与共享删除弹窗一致（`delete.*` 文案，`noun` 为「服务账户」）。

## 边界情况

- 对象已被删除：404 提示，列表刷新后消失。
- 仍被工作负载以 `serviceAccountName` 引用：上游允许删除，本页不拦截。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01** — 确认文本必须与被删名称列表完全一致。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01** — 删除后 `kubectl get sa <name>` 返回 NotFound。

## 明确不做

- 不做回收站。

## 假设

- 批量删除的顺序与勾选顺序一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01`
