# Delivery routes

The route decides what the built folder becomes part of and what is done with it afterward, so the route is chosen before the first build. Show the user all four routes below, each with its shape and trade-offs, and let them choose one or more, or define D; record the choice with the build root. The guided routes A, B, and C read one shared folder, `skills/<targetId>/` under the build root: a route adds thin files beside it and never moves, edits, or rebuilds it elsewhere, because that shared folder is what `check` verifies and what the other guided routes read too. B and C can coexist on the same `skills/`, and A places copies of it.

## A. An agent's own skill folder

- Shape: a copy or link of `skills/<targetId>/` in the folder an agent reads, personal or project; some such folders are read by several agents.

  ```text
  <agent skill folder>/<name>/   ← copy or link of <build root>/skills/<targetId>/
  ```

- Fits when: one person uses it on this machine, or tries it first; nothing sits between build and use.
- Costs: placement is per agent and per machine, updates are by hand, and nothing records where a copy came from.
- On this machine: copy or link it into the chosen folder.

## B. An installer that pulls from a repository

- Shape: a tool such as `npx skills add <repository>` reads the repository's `skills/`, installs into agent folders, and tracks origin and version.

  ```text
  <repository root>/skills/<targetId>/   ← committed build output; the installer finds it here
  ```

- Fits when: several agents or machines should get it and receive updates.
- Costs: the built folders are committed, reaching others needs a push, and the installer's third-party rules change.
- On this machine: install it with that tool from the local repository; pushing is a separate step the user asks for.

## C. A plugin, optionally through a marketplace

- Shape: a manifest at the repository root beside `skills/` names the plugin; a marketplace file lists plugins and where to fetch them; skills may sit next to commands, hooks, or servers.

  ```text
  <repository root>/skills/<targetId>/
  <repository root>/<plugin manifest>      ← one per plugin system, each in its own format
  <repository root>/<marketplace file>     ← only when the project publishes a marketplace
  ```

- Fits when: it should be versioned as a package, or carry more than skills.
- Costs: each plugin system keeps its own manifest and does not read the others'; keeping their names and versions in agreement is the project's discipline, with one of them the source the others copy, named in the project's current state.
- Also raises: whether the shared-`skills/` shape stays the template or the project wants its own, and whether to prepare room now for more than skills or for more agents.
- On this machine: install the plugin locally; publishing is a separate step the user asks for.

## D. A way of the project's own

Hosting, a package registry, or anything the user defines. Settle these with the user and record them in the project's current state:

- Shape: where the built skill goes and what structure it needs; it may differ from `skills/<targetId>/`.
- Frame: any files around it and who reads them.
- On this machine: how it is put in place for a test.
- Beyond this machine: how it is published, when the user asks.

## Walls

- Each shape above is the shape, not the names: file names and fields belong to the tool, so confirm its current rules as the first source before writing them, and validate the frame with that tool before claiming the route is in place.
- A frame that declares a component the project does not have is a promise the installer fails on: add manifests and fields only for what exists, and add no frame the user has not asked for.
- A route that rewrites bytes on the way, such as line-ending conversion, breaks the receipt: run `check` on the installed copy, not only on the build.

## Record

The chosen route or routes, whether the template was kept, and which frame files exist go where the project keeps its current state, beside the build root.
