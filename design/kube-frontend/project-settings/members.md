# 项目成员列表（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/members.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01

## 概述

成员表：用户名、状态、角色、最近活动。

## 设计目标与非目标

把注解字段变成可读列。非目标：邀请与改角色。

## 关键约束

- 角色来自注解；最近活动来自最近改密时间。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01 — 「最近活动」如实指向最近改密时间

**为什么**：IAM 的成员投影没有登录时间字段。把改密时间标成「最近登录」是编造事实；标成「最近活动」并在设计里写清来源，是能做到诚实的最近似。

**被否方案**：读取用户对象上的登录审计。需要额外的审计接口与权限，收益不足以抵消复杂度。

**何时重新考虑**：IAM 提供登录时间字段时。

## 系统现状

老 console 的成员列包含「最近登录」；本模块用改密时间近似，文案改为「最近活动」。

## 仓库落点

- `pages/settings/SettingsListPage.tsx`（members 分支）

## 对外契约

只读。

## 不变量

角色列等于注解值。

## 已知坑

- 成员对象是用户投影，`status` 可能缺失；缺失时按活跃处理而不是显示未知。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`。

## 后续改进

邀请成员与改角色。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01`
