# 企业空间成员授权（L3）

[关联需求](../../../prd/kube-frontend/access-control/workspace-members.md)

## 概述

WorkspaceMembersPage 负责操作状态，WorkspaceMemberDialog 负责 schema 表单；
workspaceMembersApi 封装 IAM 写接口，workspaceRolesApi 共享空间角色读取。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01

## 系统现状

空间成员原来只读；角色页面已经可读，后端 register.go 已注册成员 POST、PUT、DELETE。
后端创建绑定校验角色但不验证账号存在，因此客户端邀请先确认账号。

## 仓库落点

- `apps/console-next/src/pages/workspace/{WorkspaceMembersPage,WorkspaceMemberDialog,WorkspaceRolesPage}.tsx`
- `packages/api-client/src/access.ts` 与 barrel
- `apps/console-next/src/components/resource/DeleteDialog.tsx`

## 对外契约

- GET `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles?limit=-1`
- 邀请前 GET `/kapis/iam.kubesphere.io/v1alpha2/users/<username>`，验证 metadata.name。
- POST `/workspaces/<ws>/workspacemembers`，body 为 `[{username, roleRef}]`。
- PUT `/workspaces/<ws>/workspacemembers/<username>`，body 为 `{username, roleRef}`。
- DELETE 同成员对象路径，移除空间绑定而非账号。
- 上述空间路径均以 IAM v1alpha2 kapis 为前缀，路径段逐一编码。

## 设计目标与非目标

目标：补齐成员授权并复用公共交互；非目标：角色权限编辑、账号删除或跨项目授权。

## 关键约束

角色值为真实对象名称而非展示别名；query key 含空间名称，切换空间不保留旧弹窗。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01 — 复用表单组件而非项目成员接口

**为什么**：交互相同但授权作用域和请求结构不同；共享 ResourceForm 和 DeleteDialog，
将空间 API 与 schema 留在本模块，角色页复用同一 reader。

**被否方案**：把工作空间名当 namespace 调项目接口；会授予错误作用域的权限。
自由文本角色也不能证明角色存在，必须由当前空间集合提供。

**何时重新考虑**：多个作用域出现一致的授权策略时提取通用授权外壳，仍保留各自 adapter。

## 不变量

1. 邀请和改角色不得把别名提交为 roleRef。
2. 移除只调用空间成员对象 DELETE，不调用 users DELETE。
3. 写失败保留弹窗与输入；成功 invalidates 当前空间成员查询。

## 已知坑

- POST 是数组，PUT 是单对象；URL 用户名必须与 PUT body 一致。
- 账号读取可能独立于成员写权限，读取拒绝时停止邀请并显示错误，不跳过存在性校验。
- 移除空间绑定不表示项目中的独立绑定也被移除。

## 测试与可观测

API 单测检查路径、请求体、账号存在性和错误传播；UI 单测检查无效角色、锁定身份和失败保留。
B200 用例创建唯一用户，只在一次性账号上写权限，finally 移除绑定并删除测试账号。
句柄为 `workspace-members:invite/dialog/delete-input/delete-confirm`。

## 后续改进

角色规则、部门与其他空间页面逐项验收，不将成员闭环等同于整个企业空间迁移完成。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01`
