# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01 集群设置 · 编辑与清空描述、只读字段

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `settings`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/settings`
- **需求**: `prd/kube-frontend/cluster-management/settings.md`

## 产品功能

集群设置可修改描述（写入注解），清空时删除注解；安装器字段只读展示。

### 关联需求

- `prd/kube-frontend/cluster-management/settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/settings.md`](../../../../prd/kube-frontend/cluster-management/settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01** — 已知已登录且对集群有写权限，当在集群设置里把描述改为新值并保存，则页面显示新描述与「已保存」，且集群对象的 `kubesphere.io/description` 注解等于新值；只读区列出供应者、Kubernetes 版本、KubeSphere 版本、连接方式、API 端点与节点数。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-02** — 已知集群对象带有描述注解，当把描述清空并保存，则集群对象上该注解被**删除**（而不是留成空字符串），页面显示 `-`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/settings.md`](../../../../design/kube-frontend/cluster-management/settings.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/settings.md`](../../../../prd/kube-frontend/cluster-management/settings.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 修改集群描述 (Priority: P1)

作为 **平台管理员**，我希望 **直接修改集群描述**，以便 **在概览页说明这个集群的用途，而不必去改 YAML**。

**Independent Test**：打开集群设置，点「编辑描述」，改文案后保存，然后重新读取集群对象，核对注解已更新且概览页显示新文案。

### US2 - 清空描述 (Priority: P2)

作为 **平台管理员**，我希望 **能把描述清空**，以便 **去掉过期或不再准确的说明**。

**Independent Test**：清空描述并保存，重新读取集群对象，核对 `kubesphere.io/description` 注解**不再存在**（不是留空串）。

### US3 - 明确哪些字段不能在这里改 (Priority: P2)

作为 **平台管理员**，我希望 **版本与连接信息以只读形态展示并说明原因**，以便 **不会在页面上找不存在的编辑入口**。

**Independent Test**：打开集群设置，核对只读区列出供应者、版本、连接方式、API 端点、节点数，且没有编辑控件。

## 前置与配置

- 已登录，且对集群 host 有写权限
- 记录当前描述注解的原值，用例结束时还原

## 测试步骤

1. 打开集群设置，等待 surface 就绪
2. 核对只读区包含供应者、Kubernetes 版本、KubeSphere 版本、连接方式、API 端点、节点数
3. 点「编辑描述」，填入唯一标记文案并保存，等待「已保存」
4. 用 API 读取集群对象，核对 kubesphere.io/description 等于该文案
5. 再次进入编辑，清空并保存
6. 用 API 读取集群对象，核对 kubesphere.io/description 键不存在
7. 还原原描述注解

## 期望结果

- 只读区六个字段存在且无编辑控件
- 保存后注解值等于输入值
- 清空后注解被删除（键不存在），页面显示 -

## 失败排查

- 保存成功但注解未变：检查是否发送了空 map 而不是 null
- 保存返回 400 wrong resource GroupVersionKind：说明写到了 kapis 端点，应走 /apis
- 概览页仍显示旧描述：检查保存后是否 invalidation 了 cluster-detail

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_settings.py；字段变化时同步更新
