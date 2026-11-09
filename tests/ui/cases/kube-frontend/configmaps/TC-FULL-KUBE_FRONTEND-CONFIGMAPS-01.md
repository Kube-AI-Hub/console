# TC-FULL-KUBE_FRONTEND-CONFIGMAPS-01 配置字典 · 列表与 kubectl 逐项核对

- **用例 ID**: `TC-FULL-KUBE_FRONTEND-CONFIGMAPS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `configmaps` `page`
- **入口**: `{BASE_URL}/c/host/p/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/_index.md`

## 产品功能

页面展示的配置字典与集群实际对象一致，并能在页面上完成一次删除。

### 关联需求

- `prd/kube-frontend/configmaps/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/_index.md`](../../../../prd/kube-frontend/configmaps/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE_FRONTEND-CONFIGMAPS-01** — Given 项目内有真实 ConfigMap，When 打开列表并逐项核对，Then 名称、键、创建时间与 `kubectl` 输出一致，且分页总数与实际对象数一致。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/_index.md`](../../../../design/kube-frontend/configmaps/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/_index.md`](../../../../prd/kube-frontend/configmaps/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，浏览本项目会被挂载到工作负载的配置


**Independent Test**：进入列表，确认能看到至少一条真实 ConfigMap 的名称、键、创建时间；点击名称进入详情，字段与 `kubectl get configmap -o yaml` 的 `data` 一致。

### US2 - 作为项目成员，清理不再需要的配置


**Independent Test**：删除一条自己创建的 ConfigMap，列表刷新后该条消失；再用 `kubectl get` 确认对象已不存在。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该空间下至少有两条 ConfigMap，其中一条由本用例临时创建

## 测试步骤

1. 打开 {BASE_URL}/c/host/p/default/configmaps
2. 记录每行的名称、键、创建时间
3. 用 kubectl -n default get configmaps 导出同一份数据并逐项比对
4. 在页面上删除本用例临时创建的那条并在确认框点确定
5. 再执行一次 kubectl get 确认对象已不存在

## 期望结果

- 名称集合与 kubectl 一致
- 每条记录的键集合与 kubectl 输出一致
- 分页显示的总数等于 kubectl 返回的对象数
- 删除后页面不再出现该对象，kubectl 返回 NotFound

## 失败排查

- 总数不一致时先确认是否有分页或 fieldSelector 影响了计数
- 删除无效时确认 token 是否有 configmaps 的 delete 权限

## 产品改版后如何更新自动化

- 路由或 kubectl 命令变化时同步本文件
