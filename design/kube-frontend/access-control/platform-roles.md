# 平台角色列表（L3）

[子模块需求](../../../prd/kube-frontend/access-control/platform-roles.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-03

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-02
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-04
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-05

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01

## 概述

平台角色表。

## 设计目标与非目标

与项目角色一致的呈现规则。非目标：角色写操作。

## 关键约束

- 读 IAM `clusterroles`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01 — 模板角色显示而非隐藏

**为什么**：与项目角色同理，管理员排查权限来源时需要看到它们。

**被否方案**：过滤掉模板角色。会让角色与规则的对应关系出现无法解释的空洞。

**何时重新考虑**：模板角色占绝大多数且影响检索时。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-PLATFORM_ROLES-05 — 授权对象从绑定列表筛选，不做逐角色接口

**为什么**：没有「某角色的授权对象」接口；绑定列表在 B200 上是 142 条，一次取回按 roleRef 过滤比逐角色查更可靠，也不会因分页漏掉后几页。

**被否方案**：跳进每个 binding 逐个读。请求数不可控，分页时容易漏。

**何时重新考虑**：绑定数量增长到一次读不完时（届时按 labelSelector 过滤）。

## 系统现状

老 console 平台角色列含名称、描述、创建时间，并支持创建。

## 仓库落点

- `pages/platform/PlatformListPage.tsx`（clusterroles 分支）

## 对外契约

只读。

## 不变量

模板角色判定按名称前缀。

## 已知坑

- 平台角色有 200 余个，多为模板。

## 测试与可观测

E2E 见 `tests/kube-frontend/access-control/`。

## 后续改进

角色编辑。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01`

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-PLATFORM-ROLES-02 — 角色**读走 IAM，写走原生 RBAC**

**为什么**：实测发现，POST 到 `iam.kubesphere.io/.../clusterroles` 返回 200，但创建出来的对象 `rules` 为 `null` —— IAM 层消费了规则列表却没有存下来。一个没有规则的平台角色不授予任何权限，而响应里没有任何提示。原生 `rbac.authorization.k8s.io/v1/clusterroles` 能正确保存规则。

**被否方案**：写入后再读回校验。能发现问题，但仍然无法修好写操作。

**何时重新考虑**：IAM 修正该行为时。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-PLATFORM-ROLES-03 — 空 API 组写成 `[""]`，动作用预设下拉

**为什么**：Kubernetes 拒绝空的 `apiGroups`（422：`resource rules must supply at least one api group`），而管理员留空时的意思是「核心组」——必须翻译成 `[""]`。动作则以「读 / 写 / 管理」三个预设给出：`checkbox` 在本表单里是单个布尔（实测 7 个选项只渲染 1 个），`tags` 又不从 `defaultValues` 取值，两者都会**静默产生一个没有规则的角色**。

**被否方案**：动作自由填文本。拼错的动词会被 apiserver 接受，只是不授予任何权限——最难排查的一类错误。

**何时重新考虑**：需要「逐条多规则」编辑时，另做一个规则列表编辑器。
