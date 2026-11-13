# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01 集群配置字典 · 手机宽度

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `mobile`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/mobile.md`

## 产品功能

390px 下无整页横向滚动，「项目」列仍可见。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/mobile.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/mobile.md`](../../../../prd/kube-frontend/cluster-configmaps/mobile.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/mobile.md`](../../../../design/kube-frontend/cluster-configmaps/mobile.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/mobile.md`](../../../../prd/kube-frontend/cluster-configmaps/mobile.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在移动端适配上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 已登录，且为集群管理员

## 测试步骤

1. 以 390×780 视口打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 测量 scrollWidth 与 clientWidth
3. 核对表头

## 期望结果

- scrollWidth 等于 clientWidth
- 表头仍包含「项目」
- 触控目标不小于 44px

## 失败排查

- 截图看起来超宽时先量 scrollWidth，注意 deviceScaleFactor

## 产品改版后如何更新自动化

- 断点变化时同步本文件
