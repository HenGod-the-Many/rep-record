# Git workflow: main / dev / feature

How changes move through this repo. In short: build and test on a branch,
bring it into `dev` with a pull request, and release by merging `dev` into
`main` and tagging it.

```
feature/<name> ──PR──▶ dev ────PR────▶ main ──▶ tag v0.3.0
 build it and          test finished   released
 test it here          work together

hotfix/<name>  from main ──PR──▶ main (tag v0.3.1) ──PR──▶ dev
```

## The branches

| Branch | Holds | Branches from | Merges into | Merge method |
|---|---|---|---|---|
| `main` | Released code; every release is tagged | — | — | — |
| `dev` | Finished, tested work waiting for the next release | `main`, once | `main` | Merge commit |
| `feature/<name>` | New work | `dev` | `dev` | Squash |
| `fix/<name>` | A bug in work that hasn't been released yet | `dev` | `dev` | Squash |
| `hotfix/<name>` | A bug in a release | `main` | `main`, then `main` → `dev` | Merge commit |

`main` and `dev` never take direct commits; a pre-commit hook refuses them.
Everything reaches them through a pull request. (A repo that mixes content and
code relaxes this for content: see
[Repos that mix content and code](#repos-that-mix-content-and-code).)

Name branches in short kebab-case: `feature/spotify-login`. In a repo holding
several projects, start with the project: `feature/poster-tracker-spotify-login`.

## Three rules that make it work

1. **Test on the branch, before it reaches dev.** Dev is where finished pieces
   get checked *together*. It is not where you find out whether a piece works.
   If half-working features land in dev, the good ones can't be released
   without the broken ones.
2. **Dev is always releasable.** If something in dev turns out not to be ready,
   revert it out instead of holding up the release. Squash merging makes this
   easy: every feature is exactly one commit on dev.
3. **Keep branches small and short-lived.** Days, not weeks. A big feature is
   several small ones. Long-lived branches drift away from dev until merging
   them is a project of its own.

## Day to day

### Start a feature

```bash
git switch dev
git pull
git switch -c feature/spotify-login
```

### Work and test

Commit as often as you like. The branch gets squashed into a single commit when
it merges, so small, messy commits are fine. Before asking for a merge, run the
tests. If there aren't any yet, check it by hand and note what you checked.

### Open a pull request into dev

```bash
git push -u origin feature/spotify-login
gh pr create --base dev
```

Fill in the template, especially "How I tested it". When it's ready:

```bash
gh pr merge --squash --delete-branch
```

When Claude does the work, it merges these pull requests itself once they're
tested, and tells you what went in. You review the work together at release
time.

### Release: dev into main

When dev holds something worth releasing, and it has been tested together,
open a release. This is the merge that waits for your OK. The release pull
request shows everything since the last release in one place, which makes it
the natural point to review.

```bash
gh pr create --base main --head dev --title "Release v0.3.0"
gh pr merge dev --merge
git switch main
git pull
git tag -a v0.3.0 -m "Spotify login and city tracking"
git push origin v0.3.0
```

**Never squash dev into main, and never delete dev.** Squashing gives main a
brand-new commit that dev has never seen, so the next release drags old changes
along and conflicts with itself. A merge commit keeps the two histories joined.

### Hotfix: a bug in a release

```bash
git switch main
git pull
git switch -c hotfix/login-crash
# fix it, test it, commit
git push -u origin hotfix/login-crash
gh pr create --base main
gh pr merge --merge --delete-branch
git switch main
git pull
git tag -a v0.3.1 -m "Fix crash on login"
git push origin v0.3.1
gh pr create --base dev --head main --title "Sync v0.3.1 into dev"
gh pr merge main --merge
```

Don't skip the last step. Without it the fix is in the release but not in dev,
and the next release quietly brings the bug back.

## Versions and tags

Tags follow `vMAJOR.MINOR.PATCH`:

- A release from dev bumps MINOR: `v0.2.0` → `v0.3.0`
- A hotfix bumps PATCH: `v0.3.0` → `v0.3.1`
- `v1.0.0` is the first release you'd call genuinely usable. After that, MAJOR
  goes up when a release breaks how things worked before.

In a repo holding several projects, tags carry the project name, and a release
tags only the projects that changed in it: `poster-tracker/v0.3.0`.

## When the hook blocks you

A refused commit loses nothing: your changes are still there. Move them to a
branch and commit again.

- On `dev`: `git switch -c feature/<name>` (or `fix/<name>`). Your changes come
  along.
- On `main`, fixing a released bug: `git switch -c hotfix/<name>`.
- On `main`, starting new work: `git switch dev`, then
  `git switch -c feature/<name>`.
- In a repo that mixes content and code, `main` only refuses commits that
  include code. The message lists those files; commit everything else on its
  own.

`git commit --no-verify` skips the check. It's there for emergencies. If you
find yourself using it routinely, change the workflow rather than working
around it.

## Repos that mix content and code

Some repos are mostly notes, writing or other content, with some code
alongside. Branches and pull requests pay off for the code but only get in the
way of the writing. In those repos, `.githooks/code-paths` lists the code
folders, one per line:

```
tools/
```

- Files in those folders follow everything above.
- Everything else is committed directly on `main`, like saving a document.
- `dev` still never takes direct commits, and holds only code work.
- Keep code and content in separate commits. On `main`, the hook refuses any
  commit that includes code.
- Name release tags after the code they release, e.g. `dm/v1.0.0`.

If you use that code from `main` day to day, such as a tool you run while
working, give dev a folder of its own. Then switching branches for code work
never changes the tool you are using. From the main folder, with `main` checked
out:

```bash
git worktree add ../<repo>-dev dev
```

The second folder is the same repo, not a copy: branches and commits made in
either one are visible from both. Do code work there (branch from `dev`, open
pull requests), and leave the original folder on `main`. After a release, run
`git pull` in the original folder to pick up the new version.

## Setting up a new clone

Git doesn't run hooks from the repo until you point it at them, once per clone:

```bash
git config core.hooksPath .githooks
```

Pull requests use the GitHub CLI, signed in once per machine:
`winget install --id GitHub.cli`, then `gh auth login`.
