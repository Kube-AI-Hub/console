# 项目成员列表 — 技术方案（L3）

[关联需求](../../../prd/kube-frontend/project-settings/members.md)

## 概述

SettingsListPage 的 members 分支管列表与写操作；membersApi / membersWriteApi 封装 IAM 项目成员集合。角色选项走 rolesApi，过滤 `role-template-*`。

## 关联需求

- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01`
- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02`
- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03`

## 设计目标与非目标

- **目标**：在同一 IAM 成员对象上补齐旧页的查找、自我保护、批量解绑和诚实的登录时间。
- **非目标**：角色规则编辑、平台账号删除、租户(企业空间)成员绑定、成员详情页、邀请搜索弹窗。

## 关键约束

- 成员读写：`/kapis/iam.kubesphere.io/v1alpha2/[clusters/<cluster>/]namespaces/<ns>/members`。
- POST 必须是数组 `[{username, roleRef}]`。
- 中文界面产品名约束见租户(企业空间)批次；本页标题仍是「项目成员」。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01 — 「最近登录」读 `status.lastLoginTime`

**为什么**：旧 mapper 读 `status.lastLoginTime`。把改密注解标成「最近活动」是近似，但会让从未登录的人看起来刚活跃过。与平台用户、集群成员、租户(企业空间)成员同一时钟。

**被否方案**：继续只用 `iam.kubesphere.io/last-password-change-time`。集群成员已经证明投影上有 `lastLoginTime`。

**何时重新考虑**：IAM 去掉登录字段时，再回退改密时间并改回「最近活动」。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02 — 成员写入的请求形状与兄弟资源不同

**为什么**：实测这三个动词都不是常规 kube 形状——`POST /members` 要求**数组**（传单个对象会返回 `cannot unmarshal object into Go value of type []v1alpha2.Member`），改角色是 `PUT /members/<username>`，移除是 `DELETE /members/<username>`。因此写在 `membersWriteApi` 里并注明原因，而不是复用通用资源 API。批量是顺序 DELETE。

**被否方案**：照常走 `resourceApi`。POST 形状不匹配，会得到一句看不懂的 Go 类型错误。

**何时重新考虑**：上游把成员写入统一为常规资源 API 时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03 — 邀请与改角色共用一个弹窗

**为什么**：两者是同一个决定（谁、什么角色），只差用户名可否修改。分开做会产生两个几乎一样的表单。

**被否方案**：两个弹窗。同一份校验写两遍。

**何时重新考虑**：邀请需要批量选择用户时（那会是独立的批量弹窗）。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-04 — 当前用户不能操作自己；批量确认词是人数

**为什么**：旧页 `showAction` 用 `globals.user.username !== record.name` 同时关掉行菜单和 checkbox。点了再报错会让人以为权限坏了。DeleteDialog 批量确认用人数，与租户(企业空间)成员一致。

**被否方案**：允许勾选自己、提交时 403。旧页直接不给入口。

**何时重新考虑**：平台提供「转让项目管理员」流程时。

## 系统现状

旧页 `pages/projects/containers/Members`：邀请、改角色、移除、批量移除、按名搜索、用户名+邮箱、`USER_${status}`、未登录文案、不能操作自己、名称 `noLink`。新页原先有邀请/改角色/单人移除和「最近活动」，缺其余。

## 仓库落点

- 页面：`apps/console-next/src/pages/settings/SettingsListPage.tsx`（members 分支）、`MemberDialog.tsx`、`queries.ts`
- 接口：`packages/api-client/src/iam.ts` 的 `membersApi` / `membersWriteApi`
- 文案：`packages/locales/src/index.ts`（`settings.members.*`）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 成员集合 | GET IAM `.../namespaces/<ns>/members` |
| 角色集合 | GET IAM `.../namespaces/<ns>/roles` |
| 邀请 | POST 同集合，体 `[{username, roleRef}]` |
| 改角色 | PUT `/members/<username>` `{username, roleRef}` |
| 移除 | DELETE 同上；批量是连续 DELETE |

## 不变量

1. 邀请和改角色不得把模板角色提交为 roleRef。
2. 移除只调用项目成员对象 DELETE，不调用 users DELETE。
3. 当前用户行没有复选框和写菜单。

## 已知坑

- 成员对象是用户投影，`status` 可能缺失；缺失时按活跃处理而不是显示未知。
- POST 单个对象会 400。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`。句柄：`members:surface`、`members:invite`、`members:search`、`members:bulk-remove`、`members:select`。

## 后续改进

邀请搜索弹窗（明确不做）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03`
