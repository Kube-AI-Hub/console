# TC-L3-KUBE-FRONTEND-STORAGE-LIST-01 存储 · 列表五列与名称链接

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

['存', '储', '卷', '列', '表', '显', '示', '名', '称', '、', '状', '态', '、', '容', '量', '、', '访', '问', '模', '式', '、', '创', '建', '时', '间', '，', '名', '称', '可', '点', '进', '详', '情', '。']

### 关联需求

- `prd/kube-frontend/storage/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-01** — 已知项目内有存储卷，当打开存储卷列表，则表格显示名称、状态、容量、访问模式、创建时间五列。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/list.md`](../../../../design/kube-frontend/storage/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些存储卷、是否绑定 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到绑定状态、容量与访问模式**，以便 **判断有没有卷没绑上**。

**Independent Test**：打开 `…/projects/<ns>/persistentvolumeclaims`，核对五列与状态徽章。

## 前置与配置

- 由夹具创建一个 tc-e2e- 前缀的存储卷，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开存储卷列表
2. 核对表头
3. 核对目标行存在且名称是链接

## 期望结果

- 表头依次为 名称、状态、容量、访问模式、创建时间
- 目标行出现
- 名称链接指向该对象的详情地址

## 失败排查

- 缺列时先看 StorageListPage 的 columns 与 hideBelow 断点

## 产品改版后如何更新自动化

- 列变化时改 pages/storage.py 的 headers 断言
