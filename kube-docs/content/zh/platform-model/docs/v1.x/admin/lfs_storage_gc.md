---
title: "模型存储与空间回收"
keywords: "行业大模型平台, 模型存储, MinIO, Git LFS, 对象存储, 空间回收, 垃圾回收, lfs-gc, dry_run"
description: "模型权重在对象存储中的两种布局，删除文件或仓库后空间不释放的原因，以及用管理 API 和 cron 子命令回收空间的方法与安全规则。"
linkTitle: "模型存储与空间回收"
weight: 8020
---

## 权重存放在哪里

模型仓库里存的不是权重本身。Git 仓库只保存 LFS 指针（几十字节的文本），真实权重按内容寻址存放在对象存储（MinIO）中。桶名由 `STARHUB_SERVER_S3_BUCKET` 指定，本项目为 `csghub-server`。

对象键有两种布局，取决于仓库的 `migrated` 标记：

| 布局 | 对象键 | 说明 |
|------|--------|------|
| 共享布局（未迁移） | `lfs/<oid 前 2 位>/<oid 第 3-4 位>/<oid 其余部分>` | 同一 OID 全平台只存一份，多个仓库共用 |
| 独立布局（已迁移） | `repos/<h 前 2 位>/<h 第 3-4 位>/<h>/<oid>` | 每个仓库各存一份，`h` 是 `sha256(仓库数字 ID)` |

`oid` 是文件内容的 SHA-256，所以键由内容决定：同样内容的文件无论传到哪个仓库，OID 都相同。共享布局下一个对象可能被多个仓库同时引用，这是回收时最容易踩坑的地方。

数据库表 `lfs_meta_objects` 是权重的账本，每行记录 `repository_id`、`oid`、`size`。仓库列表里显示的仓库大小来自这些行的汇总（写回 `repositories.lfs_objects_size`），不是对象存储的实时统计。

**公共模型不适用本节**：公共模型是共享模型缓存 `public/` 目录下的文件，由扫描器建成 `public/<name>` 条目，不是 Git 仓库，也没有 LFS 对象。

## 为什么删除不释放空间

| 操作 | 对象存储 | `lfs_meta_objects` |
|------|----------|--------------------|
| 仓库内删除文件（普通提交） | 对象保留，历史提交仍引用它 | 行保留，不会被删除 |
| 改写历史或强制推送，丢掉最后一个引用 | 对象保留，但已无 ref 可达 | 行保留 |
| 删除仓库（`release/3.4` 及更早） | 对象保留，成为孤儿对象 | 行随仓库一起删除 |

前两种情况的后果相同：Git LFS 对象不可变、内容寻址，只要历史提交还引用它就不能删；`lfs_meta_objects` 行也不会随着删除文件而减少。第三种情况更隐蔽：仓库记录和元数据行都没了，对象存储里的权重却还在占空间。

`develop` 分支上删除仓库会触发一次异步清理（后台协程、10 分钟超时、失败只记日志），能覆盖"删仓库"这一类。但仓库内删文件和历史改写仍然没有任何自动回收，只能靠下文的 GC 对账。

## 查看当前占用

先分别看对象存储和数据库两侧的用量，差值就是对不上账、可以回收的部分。

### 对象存储侧

```bash
mc alias set csghub http://<minio-endpoint> <access-key> <secret-key>
mc du csghub/csghub-server/lfs
mc du csghub/csghub-server/repos
```

对象存储位于集群内时，也可以在 MinIO Pod 里执行，或先 `kubectl port-forward` 再在本机执行。要精确统计对象数与字节数：

```bash
mc ls -r --json csghub/csghub-server/lfs | jq -s '{objects: length, bytes: (map(.size) | add)}'
```

### 数据库侧

```bash
kubectl -n csghub exec -i csghub-postgresql-0 -- bash -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -U csghub -d csghub_server -c \
  "SELECT count(*) AS objects, pg_size_pretty(sum(size)) AS total FROM lfs_meta_objects;"'
```

按仓库看占用最大的前 20 个：

```sql
SELECT r.path, count(*) AS objects, pg_size_pretty(sum(l.size)) AS size
FROM lfs_meta_objects l
JOIN repositories r ON r.id = l.repository_id
WHERE r.deleted_at IS NULL
GROUP BY r.path
ORDER BY sum(l.size) DESC
LIMIT 20;
```

数据库侧是"平台认为在用的权重"，对象存储侧是"实际存着的字节"。两者通常不相等，差值可能来自删除仓库后留下的孤儿对象、历史改写后不再被引用的对象，以及其它没有元数据行覆盖的对象。

## 回收空间

回收通过 GC 完成：它以 Git ref 为准重新对账，删掉没有 ref 可达的元数据行，并在没有其它仓库引用同一 OID 时删除对象。`dry_run` 走同一套只读判定，因此它给出的就是这次回收的预计量。

### 前置条件

- 运行版本包含该能力：`develop` 分支自提交 `07add4c9c`（2026-11-16）起。`v3.4.2` 与 `release/3.4` **没有**这个能力，`cron lfs-gc` 会提示未知子命令，管理 API 返回 404。`dry_run` 报告预计回收字节需要提交 `d13d80396`（2026-11-16）之后的构建，更早的构建 `dry_run` 只报行数。
- 调用管理 API 需要管理员账号；用 cron 子命令需要能 `exec` 到 API 服务 Pod 的集群权限。
- 数据库、Gitaly 与对象存储连接正常。GC 要读 Git ref、读元数据、删对象，任何一侧异常都会让结果不可信。
- 先在低峰期跑 `dry_run`，确认清单后再实跑。

### 用管理 API

```bash
curl -X POST "https://<平台地址>/platform-model/api/v1/admin/lfs/gc" \
  -H "Authorization: Bearer <管理员令牌>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "force": false}'
```

平台地址后的路径前缀由部署决定，本项目为 `/platform-model`，接口本身是 `POST /api/v1/admin/lfs/gc`。未登录返回 401，非管理员返回 403。

请求体两个字段都可以省略，省略即为 `false`。注意 `{"dry_run": false}` 与空请求体等价，都是**直接清理**，第一次调用务必显式写 `"dry_run": true`。

| 字段 | 说明 |
|------|------|
| `dry_run` | 为 `true` 时只统计（含预计回收的对象数与字节数），不改数据库、不删对象 |
| `force` | 为 `true` 时清理"Git 报 0 个指针但仍有元数据"的仓库，见下文的安全规则 |

### 用 cron 子命令

没有集群外访问入口时，直接在 API 服务 Pod 里跑同一个 GC：

```bash
kubectl -n csghub exec deploy/csghub-server -- \
  /starhub-bin/starhub cron lfs-gc --dry-run
```

二进制路径以容器内实际为准（本环境为 `/starhub-bin/starhub`）。去掉 `--dry-run` 即实跑，需要清理空引用集仓库时再加 `--force`。

输出是 JSON 日志：汇总在 `lfs gc finished` 这一行，跳过的仓库各有一行 `lfs gc skipped repository`（带 `reason`），错误在 `lfs gc repository error`。cron 只打印汇总与逐仓库的跳过、错误信息，要看 `repos[]` 明细请用管理 API。

### 响应字段

| 字段 | 说明 |
|------|------|
| `repos_scanned` | 实际对账的仓库数，只统计有 `lfs_meta_objects` 行且仓库记录可读的仓库 |
| `repos_cleaned` | 未跳过、完成对账的仓库数（没有可删的行也算在内） |
| `repos_skipped` | 被跳过的仓库数，原因见 `repos[].reason` |
| `rows_removed` | 删除的元数据行数（`dry_run` 时为预计删除的行数） |
| `objects_removed` | 删除的对象数（`dry_run` 时为预计删除的对象数；真跑时只计删除成功的对象） |
| `bytes_removed` | 删除对象的字节数（`dry_run` 时为预计回收的字节数；按 `lfs_meta_objects.size` 的逻辑大小累加，不是对象存储实际占用） |
| `errors` | 逐仓库的错误，通常是 Git 读失败或仓库记录不存在 |
| `repos[]` | 每个仓库的明细，见下表 |

`repos[]` 的元素：

| 字段 | 说明 |
|------|------|
| `repo_id`、`repo_path` | 仓库 ID 与路径 |
| `referenced_oids` | 当前 Git ref 可达的 OID 数量 |
| `rows_before` | 对账前的元数据行数 |
| `rows_removed` | 本次删除的行数 |
| `objects_removed`、`bytes_removed` | 本次删除的对象数与字节数（`dry_run` 时为将会删除的量） |
| `kept_for_other_repos` | 因其它仓库仍引用同一 OID 而保留的对象数（`dry_run` 时为将会保留的对象数） |
| `skipped`、`reason` | 是否跳过及原因 |

读结果时注意三点：

- `dry_run` 不写库、不删对象，但会做同样的只读共享判定，所以 `objects_removed`、`bytes_removed`、`kept_for_other_repos` 是"将会回收 / 将会保留"的量，不再是 0，可以直接据此判断这次回收值不值得做。
- 真跑时 `objects_removed` 只计删除成功的对象，`bytes_removed` 按准备删除的对象累加（删除失败的对象也计入）；有删除失败的仓库会整体进 `errors`，其行数、对象数与字节数都不计入总量。
- `repos_scanned` 可能大于 `repos_cleaned` 与 `repos_skipped` 之和。Git 读失败或仓库记录不存在的仓库只进 `errors`，不进 `repos[]`，也不计入这两个计数。

### 一次完整示例

先在低峰期跑 `dry_run`：

```bash
curl -X POST "https://<平台地址>/platform-model/api/v1/admin/lfs/gc" \
  -H "Authorization: Bearer <管理员令牌>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "force": false}'
```

响应（数值为示例）：

```json
{
  "msg": "OK",
  "data": {
    "repos_scanned": 3,
    "repos_cleaned": 2,
    "repos_skipped": 1,
    "rows_removed": 12,
    "objects_removed": 9,
    "bytes_removed": 12884901888,
    "errors": [
      "repo 1024: failed to find repository: record not found"
    ],
    "repos": [
      {
        "repo_id": 2634,
        "repo_path": "models_admin/Qwen3.5-0.8B",
        "referenced_oids": 10,
        "rows_before": 22,
        "rows_removed": 12,
        "objects_removed": 9,
        "bytes_removed": 12884901888,
        "kept_for_other_repos": 3,
        "skipped": false
      },
      {
        "repo_id": 2637,
        "repo_path": "models_admin/DeepSeek-R1-Distill-Qwen-7B",
        "referenced_oids": 0,
        "rows_before": 8,
        "rows_removed": 0,
        "objects_removed": 0,
        "bytes_removed": 0,
        "kept_for_other_repos": 0,
        "skipped": true,
        "reason": "git reports no LFS pointer while 8 metadata rows exist; pass force to clean"
      },
      {
        "repo_id": 3100,
        "repo_path": "models_admin/Qwen3-Embedding-0.6B-GGUF",
        "referenced_oids": 6,
        "rows_before": 6,
        "rows_removed": 0,
        "objects_removed": 0,
        "bytes_removed": 0,
        "kept_for_other_repos": 0,
        "skipped": false
      }
    ]
  }
}
```

这份结果说明：`models_admin/Qwen3.5-0.8B` 有 12 行元数据已无 ref 可达，实跑会删掉这 12 行，其中 9 个对象可回收（约 12 GiB）、3 个仍被其它仓库引用而保留；`DeepSeek-R1-Distill-Qwen-7B` 的 Git 侧报 0 个指针而元数据还有 8 行，默认跳过；`Qwen3-Embedding-0.6B-GGUF` 的 6 个对象都还有引用，没有可回收的内容；仓库 1024 读不到记录，进了 `errors`。

确认清单后实跑：

```bash
curl -X POST "https://<平台地址>/platform-model/api/v1/admin/lfs/gc" \
  -H "Authorization: Bearer <管理员令牌>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false, "force": false}'
```

实跑的数字与 `dry_run` 的预计值一致（下例为节选，其余仓库的条目与 `dry_run` 相同）：

```json
{
  "msg": "OK",
  "data": {
    "repos_scanned": 3,
    "repos_cleaned": 2,
    "repos_skipped": 1,
    "rows_removed": 12,
    "objects_removed": 9,
    "bytes_removed": 12884901888,
    "errors": [
      "repo 1024: failed to find repository: record not found"
    ],
    "repos": [
      {
        "repo_id": 2634,
        "repo_path": "models_admin/Qwen3.5-0.8B",
        "referenced_oids": 10,
        "rows_before": 22,
        "rows_removed": 12,
        "objects_removed": 9,
        "bytes_removed": 12884901888,
        "kept_for_other_repos": 3,
        "skipped": false
      }
    ]
  }
}
```

`kept_for_other_repos` 为 3 表示有 3 个对象虽在本仓库失去引用，但别的仓库仍引用同一 OID，因此留在对象存储里；`dry_run` 已把这 3 个对象排除在回收量之外。`bytes_removed` 是 `lfs_meta_objects.size` 的逻辑大小，单位字节，这里约 12 GiB。

## 安全规则

1. **共享 OID 不会被误删。** 未迁移仓库共用一份对象，只要还有别的仓库持有该 OID 的元数据行，对象就保留并计入 `kept_for_other_repos`。已迁移仓库的对象按仓库哈希分目录存放，各仓库互不影响。
2. **空引用集默认跳过。** 元数据还在、Git 却报 0 个指针时，GC 跳过该仓库并给出原因。这种状态更常见的原因是 Git 读取异常，而不是仓库真的空了，所以默认不动。
3. **`force` 只处理空引用集。** 加 `force` 后，上述仓库会按"所有元数据都无引用"清理，元数据行与对象都会被删除，且不可恢复。Git 调用本身失败属于 `errors`，加 `force` 也不会变成清理——先修好 Git 再谈 `force`。
4. **公共模型会被跳过。** 它们不是 Git 仓库，文件在共享模型缓存里，与 LFS 无关。
5. **删除不可逆，先 `dry_run`。** 实跑前用 `dry_run` 核对 `repos[]` 与 `errors`；实跑选低峰期，期间不要向仓库推送大文件——GC 先读 Git ref 再读元数据，两次读取之间完成的推送可能被误判为无引用。
6. **删仓库留下的孤儿对象不在扫描范围内。** GC 的扫描对象是仍有元数据行的仓库，仓库记录已删除时元数据行也随之消失，这些对象不会出现在结果里。升级到含该能力的版本后，历史遗留的孤儿对象仍需单独核对：按 `lfs/` 与 `repos/` 两个前缀列出对象，与 `lfs_meta_objects` 的 OID 集合、存活仓库的 `sha256(ID)` 集合比对后再删，务必先只统计不删除。

## 常见问题

**所有仓库都被跳过，原因都是 `git reports no LFS pointer`**：先确认 Gitaly 能读到这些仓库（路径与存储配置是否正确），不要直接加 `force`。

**`errors` 里全是 `record not found`**：元数据行指向已经不存在的仓库记录（软删除或历史残留）。GC 不会处理这些行，需要人工清理。

**`dry_run` 的 `bytes_removed` 与对象存储实际减少量不一致**：`bytes_removed` 是 `lfs_meta_objects.size` 的逻辑大小，与对象存储的实际占用（副本、压缩、存储池布局）可能不同，回收后用 `mc du` 复核。

**实跑后磁盘占用没怎么变**：用 `mc du` 复核对象存储用量，不要用节点的 `df` 判断——对象存储可能跑在别的节点或别的存储池上。

## 相关文档

- [管理后台说明](./admin_intro)
- [模型仓库](../model/)
- [租户与算力归属](../tenancy/)
