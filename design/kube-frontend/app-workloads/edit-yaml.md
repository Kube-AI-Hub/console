# 编辑 YAML（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/edit-yaml.md)

## 概述

复用配置字典的 `YamlDialog`：先取最新对象，锁定名称，保存走原生端点。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01`
- `prd/kube-frontend/app-workloads/edit-yaml.md`

## 设计目标与非目标

与配置字典完全一致的编辑体验，且写路径按 API 组构造。非目标：多文档 YAML。

## 关键约束

- 名称只读。
- 保存前不自动重试；失败保留弹窗。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT-YAML-01 — 写路径按资源所属 API 组构造

**为什么**：`/api/v1` 只服务核心组。把 Deployment 的 PATCH 发到 `/api/v1` 会得到 404「the server could not find the requested resource」，而列表是正常的——这种「读得到、写不了」最难自查。

**被否方案**：为每种资源手写路径。重复且容易漏；现在是一张表 + 一个函数，并由单测固定。

**何时重新考虑**：接入 CRD 时，组与版本要来自发现接口，而不是静态表。

## 系统现状

老 console 用 `resource.yaml.edit` 弹窗，路径由 store 决定。

## 仓库落点

- `packages/api-client/src/resources.ts`（`kubePrefix`）
- `components/resource/YamlDialog.tsx`

## 对外契约

`kubePrefix(resource)` → `/api/v1` 或 `/apis/<group>/<version>`。

## 不变量

- 同一资源的读、写、删走同一组。

## 已知坑

- 未登记的新资源会回退核心组，表现为写操作 404；新增资源必须登记。

## 测试与可观测

- 单测 `resources.test.ts` 覆盖核心组、分组、未登记回退。

## 后续改进

- CRD 的组来自发现接口。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01`
