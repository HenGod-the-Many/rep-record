# Git workflow

This repo uses main / dev / feature branches. docs/git-workflow.md explains the
model with full commands; these are the rules to act on.

## Before changing anything

- Check the current branch. `main` and `dev` never take direct commits (a
  pre-commit hook refuses them; content in a mixed repo is the exception, see
  the last section), so start the right branch first:
  - `feature/<name>` for new work, `fix/<name>` for a bug in unreleased work,
    both from an up-to-date `dev`
  - `hotfix/<name>` for a bug in a release, from an up-to-date `main`
- Use short kebab-case names. In a multi-project repo, lead with the project:
  `feature/poster-tracker-spotify-login`.
- If `git config core.hooksPath` isn't `.githooks`, the hook is off. Say so and
  offer to turn it on.

## Getting work merged

- Test on the branch before opening a pull request: run the project's tests, or
  check the behavior by hand if there are none. The PR's "How I tested it"
  section says exactly what was done. "Not tested" is allowed, but it's a
  reason not to merge yet.
- Every change reaches `dev` or `main` through a pull request made with `gh`.
  Never merge into them locally. (`git pull` to update them is fine; with no
  direct commits it only ever fast-forwards.)
- Who merges:
  - `feature/` or `fix/` → `dev`: merge it yourself once it's tested, then tell
    the user what went in. The user reviews this work at release time instead.
  - Anything into `main`, a release or a hotfix: **only when the user says
    to.** First summarize what it contains since the last release.
- Don't open a release for every feature. Release when dev holds something
  worth releasing, or when the user asks.
- Use the right merge method; the wrong one damages the history:
  - `feature/` or `fix/` → `dev`: `gh pr merge --squash --delete-branch`
  - `dev` → `main` (a release): `gh pr merge dev --merge`. Never `--squash`,
    never `--delete-branch`.
  - `hotfix/` → `main`: `gh pr merge --merge --delete-branch`, then open a
    `main` → `dev` pull request and merge it with `--merge`.
- Never force-push `main` or `dev`. Never use `--no-verify` unless the user
  explicitly asks.

## Releases

- A release PR's title names its version (`Release v0.3.0`), so approving the
  merge approves the number. Find the current version with `git tag --list`.
- Releases from dev bump MINOR; hotfixes bump PATCH.
- After merging into `main`, tag it and push the tag:
  `git tag -a v0.3.0 -m "<summary>"`, then `git push origin v0.3.0`.
  In a multi-project repo the tag is `<project>/vX.Y.Z`, one per project that
  changed.
- Keep dev releasable. If something merged into dev isn't going to be ready,
  propose reverting its squash commit through a `fix/` pull request rather than
  letting it block a release.

## Repos that mix content and code

If `.githooks/code-paths` exists, only the paths it lists follow this workflow:

- Commit changes outside those paths directly on `main`. Don't create branches
  or pull requests for them.
- Never put code and content in the same commit.
- If `dev` is checked out in a separate folder (`git worktree list`), do code
  work there and leave the main folder on `main`.
