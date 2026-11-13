# 项目成员列表（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/members.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02

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

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02 — 成员写入的请求形状与兄弟资源不同

**为什么**：实测这三个动词都不是常规 kube 形状——`POST /members` 要求**数组**（传单个对象会返回 `cannot unmarshal object into Go value of type []v1alpha2.Member`），改角色是 `PUT /members/<username>`，移除是 `DELETE /members/<username>`。因此写在 `membersWriteApi` 里并注明原因，而不是复用通用资源 API。

**被否方案**：照常走 `resourceApi`。POST 形状不匹配，会得到一句看不懂的 Go 类型错误。

**何时重新考虑**：上游把成员写入统一为常规资源 API 时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03 — 邀请与改角色共用一个弹窗

**为什么**：两者是同一个决定（谁、什么角色），只差用户名可否修改。分开做会产生两个几乎一样的表单。

**被否方案**：两个弹窗。同一份校验写两遍。

**何时重新考虑**：邀请需要批量选择用户时（那会是独立的批量弹窗）。

## 系统现状## 系统现状

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
