# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01 编辑集群信息 · 四个字段写回与清空

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-edit-info`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/cluster-edit-info.md`

## 产品功能

集群列表的行操作「编辑信息」修改别名、标签、供应商与描述；四个字段复用「添加集群」的同一套控件；清空即删除对应键。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-edit-info.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-edit-info.md`](../../../../prd/kube-frontend/cluster-management/cluster-edit-info.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01** — 已登录平台管理，当在集群列表对某集群提交新的别名、标签、供应商与描述，则集群对象的 `kubesphere.io/alias-name`、`cluster.kubesphere.io/group`、`spec.provider`、`kubesphere.io/description` 随之更新，且列表中该行的名称列显示别名、副行显示对象名。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-02** — 当把别名/标签/描述清空后提交，则对应的注解与标签键**被删除**（而不是保留旧值）。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-edit-info.md`](../../../../design/kube-frontend/cluster-management/cluster-edit-info.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-edit-info.md`](../../../../prd/kube-frontend/cluster-management/cluster-edit-info.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 给集群起一个读得懂的名字 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表直接编辑集群的别名与说明**，以便 **在多个集群之间分辨它们而不必记住对象名**。

**Independent Test**：在列表对某集群点「编辑信息」，修改别名/标签/供应商/描述并确认；读回集群对象，四个字段都变了；清空别名后读回，别名注解消失。

## 前置与配置

- 已登录，且有平台管理权限
- 集群对象可写

## 测试步骤

1. 打开集群列表，对目标集群点「编辑信息」
2. 核对四个字段的控件形态（别名与描述为输入框、标签与供应商为下拉）
3. 展开标签下拉，记录全部选项
4. 展开供应商下拉，记录全部选项
5. 填入别名/标签/供应商/描述并确认
6. 读回集群对象逐项核对，并检查列表名称列显示别名
7. 再次打开清空别名/标签/描述并确认
8. 读回确认对应键已删除
9. 清理：把集群的注解/标签/供应商恢复原值

## 期望结果

- 名称字段禁用且带说明「集群名称是对象标识，接入后不可修改」
- 标签下拉为 5 项：无/生产/开发/测试/演示（与添加集群一致）
- 供应商下拉为 8 项，且为可搜索下拉而非自由文本输入（与添加集群一致）
- 四个字段写入对象
- 列表主行显示别名、副行显示对象名
- 清空后注解与标签键被删除
- 保存成功后弹出「已保存」通知

## 失败排查

- 显示已保存但值没变：清空必须发 null（merge patch 缺失键=不修改）
- 名称列读到别的列：用 data-ai-id 定位而不是 td 序号
- select_option 报「不是 select 元素」：标签已改为 Radix 下拉，需点击后选 role=option

## 产品改版后如何更新自动化

- 字段变化时改 pages/cluster_fleet.py 的 open_edit 与字段选择器
