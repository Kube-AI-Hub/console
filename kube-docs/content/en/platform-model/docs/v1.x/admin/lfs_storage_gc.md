---
title: "Model Storage and Space Reclamation"
keywords: "Industry AI Model Platform, model storage, MinIO, Git LFS, object storage, space reclamation, garbage collection, lfs-gc, dry_run"
description: "How model weights are laid out in object storage, why deleting files or repositories does not free space, and how to reclaim it with the admin API and the cron subcommand, including the safety rules."
linkTitle: "Model Storage and Space Reclamation"
weight: 8020
---

## Where the Weights Live

A model repository does not store the weights themselves. The Git repository holds only LFS pointers (text files of a few dozen bytes), while the real weights are stored in object storage (MinIO) and addressed by content. The bucket is set by `STARHUB_SERVER_S3_BUCKET`; in this project it is `csghub-server`.

Object keys follow one of two layouts, depending on the `migrated` flag of the repository:

| Layout | Object key | Notes |
|--------|------------|-------|
| Shared (not migrated) | `lfs/<first 2 chars of oid>/<chars 3-4 of oid>/<rest of oid>` | One object per OID for the whole platform, shared by several repositories |
| Dedicated (migrated) | `repos/<first 2 chars of h>/<chars 3-4 of h>/<h>/<oid>` | One copy per repository, where `h` is `sha256(repository numeric ID)` |

The `oid` is the SHA-256 of the file content, so the key is decided by the content: the same file uploaded to different repositories has the same OID. Under the shared layout one object can be referenced by several repositories at once, which is the part most likely to trip you up during reclamation.

The `lfs_meta_objects` table is the ledger for weights: each row records `repository_id`, `oid` and `size`. The repository size shown in the console is the sum of these rows (written back to `repositories.lfs_objects_size`), not a live measurement of object storage.

**Public models are out of scope here**: a public model is a file under the `public/` directory of the shared model cache, turned into a `public/<name>` entry by the scanner. It is not a Git repository and has no LFS objects.

## Why Deleting Does Not Free Space

| Operation | Object storage | `lfs_meta_objects` |
|-----------|----------------|--------------------|
| Delete a file in a repository (ordinary commit) | The object stays; history still references it | The row stays; it is not deleted |
| Rewrite history or force-push away the last reference | The object stays, but no ref can reach it any more | The row stays |
| Delete the repository (`release/3.4` and earlier) | The object stays and becomes an orphan | The rows are deleted together with the repository |

The first two cases end the same way: Git LFS objects are immutable and content addressed, so as long as a historical commit references the object it cannot be removed; and `lfs_meta_objects` rows do not shrink when you delete files. The third case is less obvious: the repository record and its metadata rows are gone, yet the weights still take up space in object storage.

On the `develop` branch, deleting a repository triggers an asynchronous cleanup (background goroutine, 10-minute timeout, failures only logged), which covers the "deleted repository" case. Deleting files inside a repository and rewriting history still have no automatic reclamation on any branch; only the GC described below reconciles them.

## Check Current Usage

Look at object storage and at the database separately; the difference is the part that does not add up and can be reclaimed.

### Object storage side

```bash
mc alias set csghub http://<minio-endpoint> <access-key> <secret-key>
mc du csghub/csghub-server/lfs
mc du csghub/csghub-server/repos
```

When object storage runs inside the cluster, you can also run this inside the MinIO pod, or use `kubectl port-forward` and run it locally. To count objects and bytes precisely:

```bash
mc ls -r --json csghub/csghub-server/lfs | jq -s '{objects: length, bytes: (map(.size) | add)}'
```

### Database side

```bash
kubectl -n csghub exec -i csghub-postgresql-0 -- bash -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -U csghub -d csghub_server -c \
  "SELECT count(*) AS objects, pg_size_pretty(sum(size)) AS total FROM lfs_meta_objects;"'
```

The 20 repositories with the largest footprint:

```sql
SELECT r.path, count(*) AS objects, pg_size_pretty(sum(l.size)) AS size
FROM lfs_meta_objects l
JOIN repositories r ON r.id = l.repository_id
WHERE r.deleted_at IS NULL
GROUP BY r.path
ORDER BY sum(l.size) DESC
LIMIT 20;
```

The database side is what the platform believes is in use; the object storage side is what is actually stored. The two are usually different, and the difference comes from orphan objects left behind by deleted repositories, objects no longer referenced after a history rewrite, and other objects that no metadata row covers.

## Reclaim Space

Reclamation is done by the GC: it reconciles against Git refs, drops metadata rows that no ref can reach, and removes the object when no other repository references the same OID. A `dry_run` goes through the same read-only decisions, so its numbers are the expected size of that reclamation.

### Prerequisites

- The running version includes the capability: `develop` since commit `07add4c9c` (2026-11-16). `v3.4.2` and `release/3.4` **do not** have it — `cron lfs-gc` reports an unknown subcommand and the admin API returns 404. Reporting the reclaimable bytes from a `dry_run` needs a build after commit `d13d80396` (2026-11-16); earlier builds only report row counts for a dry run.
- Calling the admin API requires an administrator account; using the cron subcommand requires cluster permission to `exec` into the API service pod.
- The database, Gitaly and object storage connections all work. The GC reads Git refs, reads metadata and deletes objects, so a problem on any of the three makes the result untrustworthy.
- Run `dry_run` off-peak first, review the list, and only then run it for real.

### Use the Admin API

```bash
curl -X POST "https://<platform-host>/platform-model/api/v1/admin/lfs/gc" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "force": false}'
```

The path prefix after the platform host depends on the deployment; in this project it is `/platform-model`, and the endpoint itself is `POST /api/v1/admin/lfs/gc`. An unauthenticated call returns 401, a non-administrator returns 403.

Both fields of the request body may be omitted, which means `false`. Note that `{"dry_run": false}` is equivalent to an empty body, and both **clean for real**, so the first call must spell out `"dry_run": true`.

| Field | Description |
|-------|-------------|
| `dry_run` | When `true`, only report (including the objects and bytes that would be reclaimed); neither the database nor object storage is touched |
| `force` | When `true`, also clean repositories where Git reports no LFS pointer while metadata still exists; see the safety rules below |

### Use the Cron Subcommand

Without an entry point from outside the cluster, run the same GC inside the API service pod:

```bash
kubectl -n csghub exec deploy/csghub-server -- \
  /starhub-bin/starhub cron lfs-gc --dry-run
```

The binary path follows the container (in this environment it is `/starhub-bin/starhub`). Drop `--dry-run` to clean for real, and add `--force` when you also want repositories with an empty reference set cleaned.

The output is JSON logs: the summary is the `lfs gc finished` line, each skipped repository has a `lfs gc skipped repository` line with its `reason`, and failures appear as `lfs gc repository error`. The cron command prints only the summary plus per-repository skip and error lines; use the admin API when you need the `repos[]` detail.

### Response fields

| Field | Description |
|-------|-------------|
| `repos_scanned` | Repositories actually reconciled; only those with `lfs_meta_objects` rows and a readable repository record are counted |
| `repos_cleaned` | Repositories reconciled without being skipped (a repository with nothing to drop counts too) |
| `repos_skipped` | Repositories skipped; see `repos[].reason` |
| `rows_removed` | Metadata rows dropped (with `dry_run`, the number that would be dropped) |
| `objects_removed` | Objects removed (with `dry_run`, the number that would be removed; after a real run, only the ones that were removed successfully) |
| `bytes_removed` | Bytes of the removed objects (with `dry_run`, the bytes that would be reclaimed; summed from the logical `lfs_meta_objects.size`, not the actual object storage footprint) |
| `errors` | Per-repository errors, usually a Git read failure or a missing repository record |
| `repos[]` | Per-repository detail, see the next table |

Each `repos[]` element:

| Field | Description |
|-------|-------------|
| `repo_id`, `repo_path` | Repository ID and path |
| `referenced_oids` | Number of OIDs reachable from the current Git refs |
| `rows_before` | Metadata rows before reconciliation |
| `rows_removed` | Rows dropped in this run |
| `objects_removed`, `bytes_removed` | Objects and bytes removed in this run (with `dry_run`, what would be removed) |
| `kept_for_other_repos` | Objects kept because another repository still references the same OID (with `dry_run`, what would be kept) |
| `skipped`, `reason` | Whether the repository was skipped, and why |

Three things to keep in mind when reading the result:

- A `dry_run` writes nothing and deletes nothing, but it performs the same read-only sharing check, so `objects_removed`, `bytes_removed` and `kept_for_other_repos` are the amounts that **would** be reclaimed and kept. They are no longer 0, which makes a dry run enough to judge whether the reclamation is worth doing.
- After a real run, `objects_removed` counts only the objects that were removed successfully, while `bytes_removed` is summed over every object that was going to be removed (failed ones included); a repository with a failed removal goes into `errors` as a whole, and its rows, objects and bytes are not added to the totals.
- `repos_scanned` can be larger than `repos_cleaned` plus `repos_skipped`. A repository whose Git read failed or whose record is missing only appears in `errors`, not in `repos[]`, and is counted in neither.

### A worked example

Run `dry_run` off-peak first:

```bash
curl -X POST "https://<platform-host>/platform-model/api/v1/admin/lfs/gc" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "force": false}'
```

The response (values are illustrative):

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

This result says: `models_admin/Qwen3.5-0.8B` has 12 metadata rows no ref can reach, so a real run drops all 12, of which 9 objects can be reclaimed (about 12 GiB) and 3 stay because another repository still references them; `DeepSeek-R1-Distill-Qwen-7B` reports no LFS pointer on the Git side while 8 metadata rows remain, so it is skipped by default; all 6 objects of `Qwen3-Embedding-0.6B-GGUF` are still referenced and there is nothing to reclaim; repository 1024 has no readable record and lands in `errors`.

Once the list looks right, run for real:

```bash
curl -X POST "https://<platform-host>/platform-model/api/v1/admin/lfs/gc" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false, "force": false}'
```

A real run produces the numbers the `dry_run` predicted (excerpt below; the other repository entries match the `dry_run`):

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

A `kept_for_other_repos` of 3 means three objects lost their reference in this repository but another repository still references the same OID, so they stay in object storage; the `dry_run` already excluded those three from the reclaimable amount. `bytes_removed` is the logical `lfs_meta_objects.size` in bytes; here it is about 12 GiB.

## Safety Rules

1. **Shared OIDs are never removed by mistake.** Non-migrated repositories share one object per OID, so as long as another repository holds a metadata row for that OID the object is kept and counted in `kept_for_other_repos`. Objects of migrated repositories live under their own repository hash and do not affect each other.
2. **An empty reference set is skipped by default.** When metadata still exists but Git reports no LFS pointer, the GC skips the repository and reports why. A broken Git read is a far more common cause than a repository that really became empty, so nothing is touched.
3. **`force` only handles the empty reference set.** With `force`, such a repository is cleaned as if every metadata row were unreferenced; both rows and objects are deleted, irreversibly. A failing Git call is reported in `errors` and does not become a cleanup just because you passed `force` — fix Git first.
4. **Public models are skipped.** They are not Git repositories; their files live in the shared model cache and have nothing to do with LFS.
5. **Deletion is irreversible, so run `dry_run` first.** Review `repos[]` and `errors` before a real run, run off-peak, and do not push large files to repositories while it runs — the GC reads Git refs before metadata, so a push that completes between the two reads can be misjudged as unreferenced.
6. **Orphans left by deleted repositories are out of scope.** The GC walks repositories that still have metadata rows; deleting a repository also removes its rows, so those objects never show up in the result. After upgrading to a version with this capability, orphans left over from earlier deletions still need a separate reconciliation: list objects under the `lfs/` and `repos/` prefixes, compare them with the OID set in `lfs_meta_objects` and the `sha256(ID)` set of live repositories, and count only before you delete anything.

## Troubleshooting

**Every repository is skipped with `git reports no LFS pointer`**: first make sure Gitaly can read these repositories (correct paths and storage configuration); do not reach for `force`.

**`errors` is full of `record not found`**: metadata rows point at repository records that no longer exist (soft-deleted or historical leftovers). The GC does not handle those rows, so they need manual cleanup.

**The `bytes_removed` of a `dry_run` does not match what object storage actually frees**: `bytes_removed` is the logical `lfs_meta_objects.size`, which can differ from the real footprint (replicas, compression, storage pool layout). Verify with `mc du` after the reclamation.

**Disk usage barely changed after a real run**: verify usage with `mc du`, not with `df` on the node — object storage may run on a different node or a different storage pool.

## Related Documentation

- [Admin console in detail](./admin_intro)
- [Model Hub](../model/)
- [Tenant and compute ownership](../tenancy/)
