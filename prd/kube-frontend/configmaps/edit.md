# 编辑配置字典（L3）

## 概述

三种编辑入口，与旧 console 一一对应：

- 编辑信息：只改别名与描述（注解），名称只读。
- 编辑设置：只增删改 `data` 里的键值。
- 编辑 YAML：整对象替换，用于改任何字段。

拆成三个而不是一个万能弹窗，是因为它们需要的权限不同，混在一起会让「只改了一句描述」看起来像一次数据变更。

## 用户故事

### US1 - 作为项目成员，修改配置字典的别名与描述

**Independent Test**：打开编辑信息，改别名后提交，列表与详情的别名随之变化，`kubectl get` 的注解已更新。

### US2 - 作为项目成员，增删配置项

**Independent Test**：打开编辑设置，新增一个键、修改一个已有键的值、删除另一个键，提交后详情与 `kubectl get` 一致。

### US3 - 作为项目成员，直接用 YAML 修改任意字段

**Independent Test**：打开编辑 YAML，改动一个键值后提交，对象被替换为 YAML 的内容。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01** — Given 编辑信息弹窗打开，When 名称被尝试修改，Then 该字段只读；When 别名不符合规则，Then 提示「别名无效…」且不提交。
- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02** — Given 编辑设置弹窗打开，When 把某个键改名成已存在的键，Then 提示重复且不提交，原有键值不丢失。
- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03** — Given 编辑 YAML 打开，When YAML 中的名称与当前对象不一致，Then 拒绝提交；When YAML 合法且名称一致，Then 提交后详情刷新为新内容。

## 设计目标

- 每次编辑只动它自己的那部分字段，不覆盖他人同时改动的其他字段。
- 乐观锁：更新前读取当前 `resourceVersion`，避免并发覆盖。

## 约束与边界

- 编辑信息只影响 `kubesphere.io/alias-name` 与 `kubesphere.io/description` 两条注解；其余注解原样保留（其中包含创建者与多集群标记）。
- 编辑设置只替换 `data`；`binaryData` 保持不变。
- 编辑 YAML 名称为只读约束：改名是另一种操作（删除重建），不允许在此发生。
- 更新端点为 `PUT /kapis/.../configmaps/{name}`，提交前先 `GET` 取最新 `resourceVersion`——与旧 console `stores/base.js:262-276` 一致。

## UI 交互设计

- 编辑信息：名称字段禁用并给出只读观感；别名与描述可编辑。
- 编辑设置：与创建的数据设置同一组件，行为一致（子表单未保存时禁用提交）。
- 编辑 YAML：与创建的 YAML 模式共用组件，附带当前对象。
- 三个弹窗提交成功后关闭并通过 Toast 提示「已更新配置字典 {name}」。

## 文案与校验

- 标题：编辑信息、编辑设置、编辑 YAML。
- 提示：已更新配置字典 {name}。
- 校验文案与创建一致：别名无效…／描述最长 256 个字符。／键名 {key} 重复…／YAML 格式有误，请修正后再提交。

## 边界情况

- 提交时对象已被删除：上游返回 404，页面显示错误信息，弹窗保持打开以便用户确认。
- 提交时 `resourceVersion` 已变：先读取再写入，正常情况下不会冲突；仍冲突时呈现上游 409 消息。
- 编辑 YAML 删除了 `data`：等同清空所有键值，允许。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01** — 编辑信息只提交注解变更，名称不可编辑。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02** — 编辑设置的数据编辑器拒绝空键、重复键与含斜杠的键。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03** — 编辑 YAML 提交前校验语法与名称一致性，提交走 PUT。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01** — 编辑后 `kubectl get configmap <name> -o json` 的注解与 `data` 与界面一致。

## 明确不做

- 不做名称重命名。
- 不做 labels 的图形化编辑（走 YAML）。
- 不做变更历史与回滚。

## 假设

- 权限不足时上游返回 403，BFF 透传状态码，页面显示「没有权限执行该操作」。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03`
