# TC-CORE-CLUSTER-STORAGE-01 集群存储 · 共享存储入口

- **用例 ID**: `TC-CORE-CLUSTER-STORAGE-01`
- **级别**: L1  **套件**: `core`
- **模块**: `cluster-storage` / `` ``
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/overview`
- **需求**: `prd/cluster-storage/_index.md`

## 产品功能

从集群菜单进入共享存储，核对标题、三个页签与概览卡片。

### 关联需求

- `prd/cluster-storage/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/_index.md`](../../../../prd/cluster-storage/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-CORE-CLUSTER-STORAGE-01** — Given 已登录且对 `volumes` 有 manage 权限，When 打开 `/clusters/default/juicefs-storage/overview`，Then 页面标题为「共享存储」、三个页签可见、概览卡片显示共享卷数与总配额，且不出现任何未翻译的 key。

### 关联设计

- 技术方案 [`design/cluster-storage/_index.md`](../../../../design/cluster-storage/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/_index.md`](../../../../prd/cluster-storage/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，从集群菜单进入存储，看到共享存储入口与当前容量概况


**Independent Test**：打开 `/clusters/default/overview`，在左侧「存储」分组里点「共享存储」，页面出现三个页签与四张概览卡片；卡片上的总配额与 `kubectl get pv` 里两个共享卷的容量之和一致。

## 前置与配置

- 已登录，且在 default 集群
- 对 volumes 有 manage 权限

## 测试步骤

1. 打开 /clusters/default/overview
2. 在左侧「存储」分组点「共享存储」
3. 核对页面标题为「共享存储」，页签为概览 / 卷与配额 / 性能
4. 核对概览出现四张卡片，且页面文本里没有 _PL / _DESC 这类未翻译 key

## 期望结果

- 页面标题与三个页签可见
- 四张卡片都有标题与数值
- 概览卡片里的共享卷数与卷页表格行数一致

## 失败排查

- 菜单项缺失时先确认 console 镜像的 server/config.yaml 里有 juicefs-storage
- 页面空白时看浏览器控制台是否有 kapis 401

## 产品改版后如何更新自动化

- 菜单文案变化时改 helpers/nav.py
