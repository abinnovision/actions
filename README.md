# match-paths

Discovers directories by marker file or takes a list of items, then filters or
flags them by directory patterns and optionally renders a template per item.

The action runs in one of two modes:

- **Discovery** (`marker`): every directory in `HEAD` that directly contains a file whose name
  matches one of the `marker` globs is a candidate. The tree is read with `git ls-tree`, so a
  checkout with `filter: blob:none` is enough. With `read-marker`, each item gets `content`, the
  trimmed first line of its marker file. Discovered names must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`.
  The `paths` output is sorted.
- **Filter** (`items`): the candidates are the given JSON objects, which must each have a string
  `path`. The input order is kept. With `flag`, no item is removed and each item gets
  `<flag>: true|false` instead.

Patterns only allow `A-Z a-z 0-9 . _ / * -`, must not start with `/` and must not contain a `..`
segment. A `*` matches exactly one path segment and skips dot directories; `**` behaves like `*`.
A leading `./` and a trailing `/` are ignored, and `.` is the repository root.

Each item gets a `name`: the last path segment, or the repository name for `.`. An existing `name`
on an input item is kept. With `template`, each item also gets a `value` where `{path}` and `{name}`
are replaced. Any other placeholder or brace fails.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@match-paths-v1
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@match-paths-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@match-paths-v1.1.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input           | Description                                                                                                                                               | Required | Default |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `patterns`      | Directory patterns, one per line. `*` matches one path segment and `.` is the repository root. Blank lines are ignored; without patterns nothing matches. | No       | _empty_ |
| `items`         | JSON array of objects with a string `path` (filter mode). Exactly one of `items` or `marker` is required.                                                 | No       | _empty_ |
| `marker`        | File name globs, one per line (discovery mode). A directory is a candidate when it directly contains a matching file in HEAD.                             | No       | _empty_ |
| `read-marker`   | Add the trimmed first line of the marker file as `content` to each item. Requires a single literal `marker`.                                              | No       | `false` |
| `flag`          | Field name to set to true or false on every item instead of removing non-matching items (filter mode only).                                               | No       | _empty_ |
| `template`      | Template rendered per item into `value`. Supports the `{path}` and `{name}` placeholders.                                                                 | No       | _empty_ |
| `require-match` | Fail when a pattern matches no candidate.                                                                                                                 | No       | `false` |
| `unique`        | Fail when two items share this field (`name` or `value`).                                                                                                 | No       | _empty_ |

## Outputs

| Output   | Description                                                                                                                |
| :------- | :------------------------------------------------------------------------------------------------------------------------- |
| `items`  | JSON array of the resulting items, each with `path` and `name`, plus `content`, the flag field and `value` when requested. |
| `paths`  | JSON array of the resulting item paths.                                                                                    |
| `values` | JSON object mapping each path to its rendered value. Only set when `template` is set.                                      |
