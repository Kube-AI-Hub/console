# 集群设置 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/settings.md)

## 概述

集群对象的可编辑子集（目前只有描述注解）+ 安装器字段的只读展示。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-02

## 设计目标与非目标

目标：让唯一真正可写的字段可写，并把其余字段的「不能写」变成看得见的说明。

非目标：集群注册/注销、可见性、分组标签、region/zone。

## 关键约束

- 写：PATCH `/apis/cluster.kubesphere.io/v1alpha1/clusters/<id>`，媒体类型 `application/merge-patch+json`。
- 读：GET `/kapis/cluster.kubesphere.io/v1alpha1/clusters/<id>`，与概览页同源。
- 描述存放位置：注解 `kubesphere.io/description`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SETTINGS-01 — 写走原生组，读走 kapis

**为什么**：实测 kapis 端点对该对象的 PATCH 返回 400 `wrong resource GroupVersionKind`，原生组 `/apis/...` 返回 200。读侧沿用 kapis，是因为 B200 上 `resources` 代理曾漏掉新建对象，列表与详情必须同源；而集群对象的 kapis 读与原生读结果一致。

**被否方案**：读写都走 `/apis`。会与列表页的读取路径分开，出现「列表显示旧值、详情显示新值」这类只能在现场复现的问题。

**何时重新考虑**：kapis 支持该对象的写操作时，统一回 kapis。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SETTINGS-02 — 清空描述发送 null，不发送空串

**为什么**：JSON merge patch 的语义是「`null` 删除键、键缺失表示不变」（RFC 7386）。发送 `{"annotations": {"kubesphere.io/description": ""}}` 会留下一个空字符串注解，键仍然存在；发送 `{"annotations": {}}` 更是完全不变。两种情况都表现为「保存成功但没变化」。

**被否方案**：PUT 整对象。需要先读 `resourceVersion`，且会把并发修改覆盖掉；这里只改一个注解，merge patch 更精确。

**何时重新考虑**：需要一次修改多个字段且要求原子性时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SETTINGS-03 — 只暴露一个可写字段

**为什么**：老 console 的集群设置还能改分组标签、region/zone 与供应者。这些字段由安装器写；让控制台改它们，控制台与安装器就会各存一份真值，分歧只会在下次安装时暴露。

**被否方案**：照搬全部可编辑字段。看起来「功能完整」，实际制造了一类无法自查的不一致。

**何时重新考虑**：平台提供正式的集群注册/更新接口（带校验与幂等）时。

## 系统现状

老 console 的 BaseInfo 页 + EditBasicInfo 弹窗：可编辑描述、分组、region/zone、供应者。本次只迁移描述，其余列为只读。

## 仓库落点

- 页面：apps/console-next/src/pages/cluster/ClusterSettingsPage.tsx
- 路由：apps/console-next/src/routes/kube-frontend.clusters.$cluster/settings/{route.tsx,index.tsx}
- 区域注册：apps/console-next/src/areas/registry.ts（cluster-management 增加 settings）
- 接口：packages/api-client/src/cluster.ts 的 clusterWriteApi.setDescription
- 文案：packages/locales/src/index.ts（cluster.settings.*；平台版本 key 为 `cluster.settings.productVersion`，标签为 Kube AI Hub 版本）

## 对外契约

| 用途 | 路径 | 方法 |
| --- | --- | --- |
| 读取集群对象 | /kapis/cluster.kubesphere.io/v1alpha1/clusters/<id> | GET |
| 更新描述 | /apis/cluster.kubesphere.io/v1alpha1/clusters/<id> | PATCH (merge-patch+json) |

## 不变量

1. 清空 = 删除注解，不是写入空串。
2. 保存只改注解，不改 spec 与其它注解。
3. 保存失败不退出编辑态，输入不丢。
4. 只读区不出现任何编辑控件。

## 已知坑

- **merge patch 的空 map 是「不变」**：`{"annotations": {}}` 不会清空任何键。这是本项目第三次遇到同一语义（ConfigMap 别名、EditInfoDialog、本页）。
- **kapis 写会 400**：`wrong resource GroupVersionKind`，不是 404，容易被误判成权限问题。
- **保存后要失效 `cluster-detail` 缓存**：概览页用同一个 queryKey 读同一对象，否则两页显示不同描述直到手动刷新。
- **注解值可能很长**：描述来自安装器，实测 200+ 字符，文本域需换行而不是单行。

## 测试与可观测

用例：tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01.yaml
测试：tests/ui/tests/kube-frontend/cluster-management/test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_SETTINGS_01.py
可观测点：`cluster-settings:*` 的 data-ai-id；保存成功后有 `cluster-settings:saved` 标记。

## 后续改进

- 集群可见性与分组标签（需要平台接口）。
- 描述长度上限提示（取决于产品是否采纳）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01
