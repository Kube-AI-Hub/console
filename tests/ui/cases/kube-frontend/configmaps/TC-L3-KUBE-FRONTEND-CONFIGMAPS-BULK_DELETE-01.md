# TC-L3-KUBE-FRONTEND-CONFIGMAPS-BULK_DELETE-01 配置字典 · 批量删除走完整条路径

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-BULK_DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `bulk-delete`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/_index.md`

## 产品功能

选中两个配置字典后批量删除，确认框要求输入数量，确认后两者都被删除。

### 关联需求

- `prd/kube-frontend/configmaps/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/_index.md`](../../../../prd/kube-frontend/configmaps/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-BULK_DELETE-01** — 已知选中两个配置字典，当点批量删除，则确认框要求输入数量 `2`（而不是逐个名字的拼接），输入后确认按钮可用；确认后两个对象都不再存在。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/_index.md`](../../../../design/kube-frontend/configmaps/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/_index.md`](../../../../prd/kube-frontend/configmaps/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，浏览本项目会被挂载到工作负载的配置


**Independent Test**：进入列表，确认能看到至少一条真实 ConfigMap 的名称、键、创建时间；点击名称进入详情，字段与 `kubectl get configmap -o yaml` 的 `data` 一致。

## 前置与配置

- 由夹具创建两个 tc-e2e- 配置字典，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开配置字典列表并选中这两行
2. 点批量删除
3. 在确认框输入数量 2 并确认
4. 用 API 查询两者

## 期望结果

- 确认框可以完成（按钮可用）
- 两个对象都不存在

## 失败排查

- 按钮始终禁用说明确认文本仍是名字拼接而非数量
- 只删了一个说明批量执行被中断

## 产品改版后如何更新自动化

- 确认方式变化时改 components/resource/DeleteDialog
