# TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02 保密字典 · 设为默认镜像仓库

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/detail.md`

## 产品功能

镜像仓库类型且非默认时提供「设为默认」，确认后旧默认被清除。

### 关联需求

- `prd/kube-frontend/secrets/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/detail.md`](../../../../prd/kube-frontend/secrets/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02** — Given 一条镜像仓库 Secret 且未被设为默认，When 打开详情，Then 头部出现「设为默认镜像仓库」操作；点击后确认，该 Secret 的 `secret.kubesphere.io/is-default-class` 变为 `"true"`，原先的默认项变为 `"false"`，头部出现「默认仓库」徽标，操作按钮消失。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/detail.md`](../../../../design/kube-frontend/secrets/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/detail.md`](../../../../prd/kube-frontend/secrets/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，需要时看到明文


**Independent Test**：点眼睛后两块显示真实 PEM 内容，换行保留；再点一次恢复遮挡；刷新后回到遮挡。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 存在一条 dockerconfigjson 类型且非默认的对象

## 测试步骤

1. 打开该对象详情
2. 点击「设为默认镜像仓库」并确认
3. 用 kubectl 读取两条对象的注解

## 期望结果

- 当前对象出现「默认仓库」徽标
- 「设为默认镜像仓库」按钮消失
- 当前对象注解 is-default-class 为 true，旧默认项为 false

## 失败排查

- 旧默认未清除时检查 useRegistrySecrets 是否返回了数据

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
