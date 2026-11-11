# 编辑服务账户（L3）

## 概述

两个入口：行操作「编辑」/ 详情「编辑信息」修改别名与描述；「编辑 YAML」修改整个对象。角色的修改有单独入口（见 `role`）。老控制台这一页的行操作第一条文案是「编辑」（`t('EDIT')`），而不是保密字典的「编辑信息」，本页保留该差异。

## 用户故事

### US1 - 作为项目成员，改别名与描述

**Independent Test**：行操作「编辑」→ 名称只读，改别名与描述 → 确认；列表中名称显示为新别名，描述更新。

### US2 - 作为项目成员，用 YAML 修改 autmount 设置

**Independent Test**：行操作「编辑 YAML」→ 加一行 `automountServiceAccountToken: false` → 确认；对象更新。

## 验收场景

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-EDIT-01** — Given 一条服务账户，When 打开「编辑」，Then 名称只读、别名与描述可改；保存后 `iam.kubesphere.io/role` 与 `secrets[]` 保持不变；When 打开「编辑 YAML」并修改名称，Then 提示名称锁定且提交禁用。

## 设计目标

- 编辑信息不碰角色与令牌：角色有独立入口，令牌由控制器维护。

## 约束与边界

- 编辑信息提交的是完整对象 PUT（携带当前 `resourceVersion`），注解合并而非替换。
- 编辑 YAML 同样先取当前资源版本；名称锁定。

## UI 交互设计

- 「编辑」与「编辑信息」打开同一个共享弹窗（名称只读、别名、描述）。
- 编辑 YAML 与其它资源相同。

## 文案与校验

- 标题：编辑信息 / 编辑 YAML。
- 校验：别名无效…／描述最长 256 个字符。／已有对象不支持改名…

## 边界情况

- 编辑期间对象被改：409 显示在弹窗上方。
- `secrets[]` 在编辑期间被控制器更新：PUT 基于读取时的对象，可能把旧列表写回；下一次控制器调谐会纠正。因此建议用「修改角色」（注解 patch）而不是整对象写来做角色变更。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01** — 编辑信息只改别名与描述注解。
- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-02** — 编辑 YAML 拒绝改名。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01** — 保存后 `kubectl diff` 只显示用户改动的字段。

## 明确不做

- 不在「编辑」里改角色（见 `role`）。
- 不做标签编辑。

## 假设

- 上游 PUT 需要资源版本。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01`
