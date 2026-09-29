# Delivery routes

A built target is one folder, `skills/<targetId>/` under the build root, and every route reads that same folder: a route adds thin files beside it and never moves, edits, or rebuilds it elsewhere, because that shared folder is what `check` verifies and what every other route reads too. The route is the user's choice, recorded with the build root; "later" is a valid answer and becomes an open question. The host you are running in is not a default.

## Ask, do not assume

In one message: which route or routes, with each route's one-line shape and trade-off from below; and, for a route that adds a frame, whether the shared-`skills/` shape stays the template or the project wants its own and whether to prepare room now for more than skills or for more agents. Build no frame the user has not asked for.

## The three guided routes

Each shape below is the shape, not the names: file names and fields belong to the tool, so confirm its current rules as the first source before writing them, and validate the frame with that tool before claiming the route is in place.

**A. An agent's own skill folder.** A copy or link of `skills/<targetId>/` placed in the folder an agent reads, personal or project; some such folders are read by several agents.

```text
<agent skill folder>/<name>/   ← copy or link of <build root>/skills/<targetId>/
```

Nothing sits between build and use. Placement is per agent and per machine, updates are by hand, and nothing records where a copy came from.

**B. An installer that pulls from a repository.** A tool such as `npx skills add <repository>` reads the pushed repository's `skills/`, installs into agent folders, and tracks origin and version.

```text
<repository root>/skills/<targetId>/   ← committed build output; the installer finds it here
```

One command reaches several agents and updates them. It needs the built folders committed and pushed, and it follows a third-party tool's rules, which change.

**C. A plugin, optionally through a marketplace.** A manifest at the repository root beside `skills/` names the plugin; a marketplace file lists plugins and where to fetch them; skills may sit next to commands, hooks, or servers.

```text
<repository root>/skills/<targetId>/
<repository root>/<plugin manifest>      ← one per plugin system, each in its own format
<repository root>/<marketplace file>     ← only when the project publishes a marketplace
```

Versioned install and room for more than skills. Each plugin system keeps its own manifest and does not read the others', and keeping their names and versions in agreement is the project's discipline: one of them is the source the others copy, and the record says which.

**Other.** Hosting, a package registry, or the project's own way: the user defines it and the record keeps the definition.

Routes coexist: B and C read the same `skills/`, and A places copies of it.

## Walls

- A frame that declares a component the project does not have is a promise the installer fails on: add manifests and fields only for what exists.
- A route that rewrites bytes on the way, such as line-ending conversion, breaks the receipt: run `check` on the installed copy, not only on the build.
- Placing into an agent folder or publishing is an effect outside the project: only on the user's word.

## Record

The chosen route or routes, whether the template was kept, and which frame files exist go where the project keeps its current state, beside the build root.
