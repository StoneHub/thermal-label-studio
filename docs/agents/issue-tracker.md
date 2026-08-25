# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Run commands inside this repository so `gh` resolves `StoneHub/thermal-label-studio` from its configured remote.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares one number space across issues and pull requests. For a bare `#42`, try `gh pr view 42` and fall back to `gh issue view 42`.

## Skill operations

- "Publish to the issue tracker" means create a GitHub issue.
- "Fetch the relevant ticket" means run `gh issue view <number> --comments`.

## Wayfinding operations

A wayfinding map is one issue with child issues as tickets.

- Map issues use the `wayfinder:map` label and hold notes, decisions, and unresolved questions.
- Child issues use a `wayfinder:<type>` label. Supported types are `research`, `prototype`, `grilling`, and `task`.
- Use GitHub sub-issues and native issue dependencies when the repository supports them. Otherwise, link children in the map body and add `Part of #<map>` or `Blocked by: #<issue>` to child bodies.
- Claim work with `gh issue edit <number> --add-assignee @me` before the first write.
- Resolve work by commenting with the result, closing the child, and adding a pointer to the map's decisions.
