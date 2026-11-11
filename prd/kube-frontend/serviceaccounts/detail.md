# 服务账户详情与 kubeconfig（L3）

## 概述

详情页回答两件事：「这个账户有什么权限」与「我怎么用它的身份访问集群」。属性区五项（集群、项目、角色、创建时间、创建者），数据区为每个令牌 Secret 渲染一块：上方是该 Secret 的键值（默认遮挡），下方是据此生成的 kubeconfig（只读，可复制、下载）。

老控制台同一页面是 `ServiceAccounts/Detail/index.jsx` + `ServiceAccountDetail/Secret.jsx`：后者按 `{serviceAccountName, namespace, token, ca.crt}` 组装 `kind: Config` 文档，`server` 固定 `https://kubernetes.default.svc:443`，并提供复制与下载 `kubeconfig.yaml`。

## 用户故事

### US1 - 作为平台用户，下载一个服务账户的 kubeconfig

**Independent Test**：打开有令牌的服务账户，点「下载」，得到 `kubeconfig.yaml`；文件里 `users[0].user.token` 等于 `data.token` 解码值，`contexts[0].context.namespace` 等于该 Secret 所在项目。

### US2 - 作为项目成员，确认这个账户挂载了哪些令牌

**Independent Test**：数据区每个令牌 Secret 一块，标题为「保密字典：<name>」，键值列表与 Secret 一致。

### US3 - 作为项目成员，看到没有令牌时的解释

**Independent Test**：打开没有 `secrets[]` 的服务账户，数据区显示提示，而不是空白或错误。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01** — Given 一个有令牌 Secret 的服务账户，When 打开详情，Then 属性区依次显示集群、项目、角色、创建时间（`YYYY-MM-DD HH:mm:ss`）、创建者；数据区显示该令牌的键值（默认遮挡）以及一段 kubeconfig，其中 `server` 为 `https://kubernetes.default.svc:443`、`current-context` 为 `<sa>@local`。
- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02** — Given 详情已打开，When 点「显示明文」，Then 该令牌的值以明文显示；When 点「下载」，Then 浏览器下载 `kubeconfig.yaml`；When 打开没有令牌的服务账户，Then 数据区提示当前没有令牌且不报错。

## 设计目标

- kubeconfig 是**生成物**：只读、可复制、可下载，不提供就地编辑（编辑对象走「编辑 YAML」）。
- 遮挡与保密字典一致：键值默认 `*`，长度与原值一致。

## 约束与边界

- kubeconfig 的 `clusters[0].cluster['certificate-authority-data']` 是 `data['ca.crt']` 的再编码（kubeconfig 要求该字段本身就是 base64 文本）。
- 令牌取 `data.token` 解码后的 JWT；若 Secret 是用 `stringData` 写的（值本身就是 JWT），按原值使用。
- 每个 Secret 单独取详情，多个令牌并行请求。
- 复制使用 `navigator.clipboard`；不可用时（非安全上下文）按钮不报错，用户可用下载。

## UI 交互设计

- 头部操作：编辑信息、编辑 YAML、修改角色、删除。
- 每个令牌块标题「保密字典：<name>」；kubeconfig 预览使用等宽字体、最高 72 高度单位可滚动。
- 复制成功后按钮文字短暂变为「已复制」。

## 文案与校验

- 分区：属性、数据。
- 提示：复制或下载后即可用 kubectl 以该服务账户访问集群。
- 无令牌：该服务账户没有绑定令牌，暂时无法生成 kubeconfig……

## 边界情况

- 令牌 Secret 已被删除：该块显示加载失败/空数据，其余令牌不受影响。
- 服务账户被删除后刷新：404 → 「资源不存在」，返回链接可用。
- `ca.crt` 缺失：kubeconfig 不输出 `certificate-authority-data` 字段，而不是输出空字符串。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01** — 详情必须为每个令牌 Secret 生成 kubeconfig。
- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02** — kubeconfig 必须可复制与下载，文件名 `kubeconfig.yaml`。
- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-03** — 没有令牌时必须给出解释而不是空白。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01** — 在集群内用下载的 kubeconfig 执行 `kubectl get ns`，返回结果与角色权限一致（`project-viewer` 只能看项目内资源）。

## 明确不做

- 不生成新的令牌 Secret（由集群控制器负责）。
- 不做 kubeconfig 的就地编辑。
- 不做 kubeconfig 的「合并到本地 ~/.kube/config」引导。

## 假设

- 集群内访问 API 的地址是 `https://kubernetes.default.svc:443`（老控制台同一假设）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02`
