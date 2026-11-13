# 编辑 YAML（L3）

[子模块需求](./_index.md)

## 概述

列表与详情都有「编辑 YAML」。打开前若需要最新对象，先弹加载对话框。

## 用户故事

### US1 - 用 YAML 改一处配置 (Priority: P1)

作为 **项目运维**，我希望 **直接编辑对象 YAML 并保存**，以便 **改列表没暴露的字段**。

**Independent Test**：改一个部署的注解并保存，刷新后仍在。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01** — 已知在部署详情，当编辑 YAML 并保存，则对象被更新，且名称不可修改。

## 设计目标

与配置字典的 YAML 编辑保持同一交互与同一校验。

## 约束与边界

- 名称锁定。
- 写路径按资源 API 组构造：核心组 `/api/v1`，其余 `/apis/<group>/<version>`。

## UI 交互设计

加载对话框 → 编辑器 → 保存/取消；保存期间按钮 pending。

## 文案与校验

- 保存按钮「保存」；解析失败提示「YAML 格式不正确」。

## 边界情况

- 服务端拒绝时在弹窗内显示错误，不关闭。

## 明确不做

- 不做多文档 YAML。

## 假设

- 对象已是最新，无需额外版本校验。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01** — 读取当前对象渲染为 YAML 并保存。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01** — 保存后列表与详情都反映新值。
