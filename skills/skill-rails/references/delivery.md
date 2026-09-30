# Delivery routes

The route decides what the built folder becomes part of and what is done with it afterward, so the route is chosen before the first build. The guided routes below read one shared folder, `skills/<targetId>/` under the build root: a route adds thin files beside it and never moves, edits, or rebuilds it elsewhere, because that shared folder is what `check` verifies and what the other guided routes read too. A way of the project's own may need a different structure, so that structure is decided together with the route. The route is the user's choice, made after seeing each route's shape and trade-offs below or defining a way of the project's own, and recorded with the build root.

## The three guided routes

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

Versioned install and room for more than skills. Each plugin system keeps its own manifest and does not read the others', and keeping their names and versions in agreement is the project's discipline: one of them is the source the others copy, and the project's current state says which. Choosing C also raises whether the shared-`skills/` shape stays the template or the project wants its own, and whether to prepare room now for more than skills or for more agents.

**Other.** Hosting, a package registry, or the project's own way: the user defines it and the project's current state keeps the definition.

Routes coexist: B and C read the same `skills/`, and A places copies of it.

## Walls

- Each shape above is the shape, not the names: file names and fields belong to the tool, so confirm its current rules as the first source before writing them, and validate the frame with that tool before claiming the route is in place.
- A frame that declares a component the project does not have is a promise the installer fails on: add manifests and fields only for what exists, and add no frame the user has not asked for.
- A route that rewrites bytes on the way, such as line-ending conversion, breaks the receipt: run `check` on the installed copy, not only on the build.

## Record

The chosen route or routes, whether the template was kept, and which frame files exist go where the project keeps its current state, beside the build root.
