# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02 自定义资源 · 详情与实例列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `custom-resources`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/custom-resources`
- **需求**: `prd/kube-frontend/cluster-management/custom-resources.md`

## 产品功能

从列表点进某个 CRD 的详情，显示该 CRD 的定义与该类型的实例表；实例行数等于按 group/版本/复数名读取的结果。

### 关联需求

- `prd/kube-frontend/cluster-management/custom-resources.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/custom-resources.md`](../../../../prd/kube-frontend/cluster-management/custom-resources.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02** — 已知列表中有某个 CRD，当点击它的类型进入详情，则显示该 CRD 的定义（类型、所属组、版本、作用域、全名、创建时间）与该类型的实例表（名称、命名空间级时显示项目、创建时间）；实例行数等于 `/apis/<group>/<version>/<plural>` 的返回条数；命名空间级实例显示所属项目。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/custom-resources.md`](../../../../design/kube-frontend/cluster-management/custom-resources.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/custom-resources.md`](../../../../prd/kube-frontend/cluster-management/custom-resources.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 看这个类型有哪些实例 (Priority: P1)

作为 **开发或集群管理员**，我希望 **从某个 CRD 直接看到它的实例**，以便 **确认「注册了但没人用」还是「正在被使用」，而不是去记 group/version/plural 再手拼 kubectl 命令**。

**Independent Test**：从列表点进一个 CRD，核对实例表的行数与 `/apis/<group>/<version>/<plural>` 返回一致，且定义区显示组、版本、作用域。

## 前置与配置

- 已登录，且对集群 host 有读取权限
- 集群里至少有一个带实例的 CRD

## 测试步骤

1. 选一个带实例的 CRD，记下 group、存储版本、复数名与实例条数
2. 打开自定义资源列表，搜索该 CRD 的 kind
3. 点击类型进入详情
4. 核对定义区字段与接口一致
5. 核对实例表行数与 /apis/<group>/<version>/<plural> 返回一致

## 期望结果

- 详情页显示类型、所属组、版本、作用域、全名、创建时间
- 实例行数等于接口返回条数（少于说明漏了 limit=-1 或版本读错）
- 命名空间级 CRD 的实例行显示所属项目

## 失败排查

- 实例为空但接口有条目：确认读的是存储版本而不是某个未提供版本
- 详情打不开：确认 $name 路由与列表链接参数一致（CRD 全名含点，需要 URL 编码）
- 行数偏少：请求漏了 limit=-1

## 产品改版后如何更新自动化

- 详情结构变化时改 pages/cluster_management.py 与 CustomResourceDetailPage.tsx
