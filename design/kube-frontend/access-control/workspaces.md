# 企业空间列表（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspaces.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-02

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01

## 概述

企业空间表。

## 设计目标与非目标

让归属可见。非目标：写操作。

## 关键约束

- 读 resources 代理 `workspaces`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01 — 企业空间走 resources 代理而不是身份组

**为什么**：实测 `tenants.kubesphere.io/v1alpha2/workspaces` 返回 404，而 `resources.kubesphere.io/v1alpha3/workspaces` 返回 4 条。按「访问控制=IAM」的直觉写会得到一个空列表且不报错原因。

**被否方案**：尝试多个路径再回退。会掩盖真正的问题（路径写错）。让来源显式、可测。

**何时重新考虑**：平台提供统一的企业空间接口时。

## 系统现状

老 console 企业空间列含名称、别名、创建时间、集群；并支持创建。

## 仓库落点

- `pages/platform/PlatformListPage.tsx`（workspaces 分支）
- `packages/api-client/src/access.ts` 的 `toWorkspaceSummary`

## 对外契约

只读。

## 不变量

`spec.clusters` 为空显示 `Cluster`。

## 已知坑

- 走 IAM 组会是 404，且错误信息不指向「来源写错」。

## 测试与可观测

E2E 见 `tests/kube-frontend/access-control/`。

## 后续改进

企业空间创建与配额。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01`

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-WORKSPACES-02 — 读走 resources 代理，写走 **kapis/tenant**

**为什么**：实测三条结论——`POST /apis/tenant.kubesphere.io/.../workspaces` **404**（该组不经 `/apis` 暴露）；`POST /kapis/tenant.kubesphere.io/v1alpha2/workspaces` **200** 且对象立即出现在列表；对已存在对象 **merge patch 返回 500**，而 **PUT 返回 200** 并正确更新别名。

这三条决定了实现：写路径用 kapis 前缀，编辑先读 `resourceVersion` 再整对象 PUT。

**被否方案**：沿用 `resourceApi` 的写路径（`/apis/<group>`）。会得到一个 404，且错误信息指向"资源不存在"，与真实原因（组路径不对）无关。

**何时重新考虑**：tenant 组在 `/apis` 下注册时。
