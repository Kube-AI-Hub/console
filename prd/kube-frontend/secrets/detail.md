# 保密字典详情（L3）

## 概述

详情页回答「这条 Secret 里到底是什么」，并且必须回答得**克制**：默认遮挡，一次点击才显示。属性区五项（集群、项目、类型、创建时间、创建者），下方 `数据` 分区按类型渲染。

老控制台同一页面是 `Secrets/Detail/SecretDetail/index.jsx`：一个眼睛按钮切换遮挡，遮挡用等长 `*`；四种类型各有渲染分支；属性区五项顺序如上。

## 用户故事

### US1 - 作为项目成员，在不暴露内容的前提下确认某个 Secret 的结构

**Independent Test**：打开 TLS 类型的详情，看到「证书」与「私钥」两块，各以 `*` 遮挡，长度与内容一致；不点击任何按钮时页面文本中没有明文。

### US2 - 作为项目成员，需要时看到明文

**Independent Test**：点眼睛后两块显示真实 PEM 内容，换行保留；再点一次恢复遮挡；刷新后回到遮挡。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01** — Given 一条 TLS Secret，When 打开详情，Then 属性区依次显示集群、项目、类型（「TLS 信息」）、创建时间（`YYYY-MM-DD HH:mm:ss`）、创建者；数据区显示「证书」「私钥」两块且内容被 `*` 遮挡；点击「显示明文」后显示 `tls.crt` 与 `tls.key` 的实际内容。
- **AC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02** — Given 一条镜像仓库 Secret 且未被设为默认，When 打开详情，Then 头部出现「设为默认镜像仓库」操作；点击后确认，该 Secret 的 `secret.kubesphere.io/is-default-class` 变为 `"true"`，原先的默认项变为 `"false"`，头部出现「默认仓库」徽标，操作按钮消失。

## 设计目标

- 遮挡是**默认**而不是可选：详情页经常被投屏、截图、录屏。
- 遮挡长度与原文一致：既能避免泄露，又能在比对（例如确认证书长度）时保留信息。
- 操作与列表一致，只多一个「设为默认镜像仓库」。

## 约束与边界

- 遮挡只发生在展示层；`data` 仍是 Base64，不修改、不回写。
- `binaryData` 不展示（老控制台也不展示）。
- 非 UTF-8 的二进制值显示「（二进制内容，请在「编辑 YAML」中查看）」而不是乱码。
- 镜像仓库 Secret 列出 `.dockerconfigjson` 中的**全部** registry 条目，而不是只列第一个。
- 另一个「设为默认」的前置：当前项已经是默认时，不显示该操作。

## UI 交互设计

- 返回链接文案「保密字典」，指向列表。
- 眼睛按钮带 `aria-pressed`，文案在「显示明文」与「隐藏明文」间切换。
- 值以等宽字体、`pre-wrap` 展示，长值可横向滚动。
- TLS 两块并排（`lg` 以上两列），镜像仓库按 registry 卡片排布。

## 文案与校验

- 分区标题：属性、数据。
- 空数据：暂无数据。
- 服务账户令牌等非表单类型：正常展示键值，不提示「无法编辑」。

## 边界情况

- 对象已被他人删除：详情请求 404，显示「资源不存在」，返回链接仍可用。
- 值为空：显示 `-`。
- 类型为系统令牌：值通常是 JWT 与证书，遮挡后仍是等长 `*`，展开后可见——与服务账户详情页从同一份 `data` 生成 kubeconfig。
- 设为默认失败（如对象已被删除）：弹窗内给出错误，不关闭弹窗。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SECRETS-DETAIL-01** — 详情默认遮挡全部值，遮挡后的长度等于原文长度。
- **FR-L3-KUBE-FRONTEND-SECRETS-DETAIL-02** — 「设为默认镜像仓库」必须先清除旧默认项，再设置新项。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01** — 详情展示的键集合与 `kubectl get secret <name> -o jsonpath='{.data}'` 的键集合一致。

## 明确不做

- 不做「复制值」按钮：复制会把明文放进系统剪贴板，绕过页面的遮挡意图。
- 不做值的就地编辑（走编辑设置）。
- 不做 labels/annotations 展示（走编辑 YAML）。

## 假设

- 同一个项目里只有一个 Secret 带有 `is-default-class: "true"`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02`
