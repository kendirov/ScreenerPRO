# Recovery Guide: Checkpoint Restore

This project checkpoint is documented as:

- `checkpoint-academy-sidebar-stable`

Use this guide to save and restore that exact state safely.

## Save the Checkpoint (Git)

From repository root:

```bash
git add .
git commit -m "checkpoint: academy sidebar stable"
git tag -a checkpoint-academy-sidebar-stable -m "Stable checkpoint: screener + benchmark + academy + sidebar state"
```

Optional (if remote is configured):

```bash
git push
git push origin checkpoint-academy-sidebar-stable
```

## Restore the Checkpoint Later (Git)

Inspect the checkpoint:

```bash
git show checkpoint-academy-sidebar-stable --stat
```

Restore in a new branch (recommended):

```bash
git switch -c restore/checkpoint-academy-sidebar-stable checkpoint-academy-sidebar-stable
```

Or detach directly at the checkpoint:

```bash
git switch --detach checkpoint-academy-sidebar-stable
```

## Practical Local Developer Restore Steps

After switching to the checkpoint commit/tag:

```bash
pnpm install
pnpm --dir frontend dev
```

Then validate:

- `/screener` loads and table flow remains intact.
- Benchmark block renders in current screener view.
- `/academy` and `/academy/[slug]` open correctly.
- Left navigation rail is present and click-to-expand behavior works.
