# TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01 保密字典 · 详情属性与遮挡

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/detail.md`

## 产品功能

属性区五项；数据区默认遮挡，眼睛切换明文。

### 关联需求

- `prd/kube-frontend/secrets/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/detail.md`](../../../../prd/kube-frontend/secrets/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01** — Given 一条 TLS Secret，When 打开详情，Then 属性区依次显示集群、项目、类型（「TLS 信息」）、创建时间（`YYYY-MM-DD HH:mm:ss`）、创建者；数据区显示「证书」「私钥」两块且内容被 `*` 遮挡；点击「显示明文」后显示 `tls.crt` 与 `tls.key` 的实际内容。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/detail.md`](../../../../design/kube-frontend/secrets/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/detail.md`](../../../../prd/kube-frontend/secrets/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，在不暴露内容的前提下确认某个 Secret 的结构


**Independent Test**：打开 TLS 类型的详情，看到「证书」与「私钥」两块，各以 `*` 遮挡，长度与内容一致；不点击任何按钮时页面文本中没有明文。

### US2 - 作为项目成员，需要时看到明文


**Independent Test**：点眼睛后两块显示真实 PEM 内容，换行保留；再点一次恢复遮挡；刷新后回到遮挡。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 存在一条 TLS 类型对象

## 测试步骤

1. 打开该对象详情
2. 读取属性区
3. 点击「显示明文」

## 期望结果

- 属性区依次显示集群、项目、类型、创建时间、创建者
- 创建时间形如 YYYY-MM-DD HH:mm:ss
- 数据区显示「证书」「私钥」，内容为 * 且没有明文
- 点击后出现 PEM 内容

## 失败排查

- 遮挡长度与原文不符时检查 maskValue 与 safeAtob

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
