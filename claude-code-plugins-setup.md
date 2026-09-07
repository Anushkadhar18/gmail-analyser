# Setting up Ponytail, Caveman, Superpowers and Frontend Design in Claude Code

Four plugins that do different jobs and stack cleanly.

| Plugin | Changes |
|---|---|
| Ponytail | *what* the agent builds — less code, no over-engineering |
| Caveman | *how it talks* — terser replies, fewer tokens |
| Superpowers | *how it works* — brainstorm before building, reproduce before fixing, verify before claiming done |
| Frontend Design | *how UI looks* — distinctive visual choices instead of generic AI aesthetics |

That's the setup I run.

- Ponytail — https://github.com/DietrichGebert/ponytail
- Caveman — https://github.com/JuliusBrussee/caveman
- Superpowers — https://github.com/obra/superpowers
- Frontend Design — https://github.com/anthropics/claude-plugins-official (ships in Anthropic's official marketplace)

---

## 0. Prerequisites

| Need | Why | Check |
|---|---|---|
| Claude Code installed | obviously | `claude --version` |
| Node.js ≥ 18 on PATH | Ponytail and Caveman run small Node lifecycle hooks | `node --version` |

Node must be on the **non-interactive** shell's PATH too. If you use `nvm` or Nix, that's the common failure: the hooks run in a shell that never sources `.zshrc`, so `node` isn't found. Test it with:

```bash
zsh -c 'node --version'      # if this fails, the hooks will be silent
```

Fix for nvm users — symlink the node you use into a system path:

```bash
sudo ln -sf "$(which node)" /usr/local/bin/node
```

If Node genuinely isn't available, the skills still work — you just lose the always-on activation and have to type `/ponytail` each session.

Don't have Claude Code yet:

```bash
npm install -g @anthropic-ai/claude-code
claude          # first run walks through login
```

---

## 1. Install Ponytail

Open Claude Code in any directory, then send these as **two separate prompts** (it doesn't work if you paste them as one message):

```
/plugin marketplace add DietrichGebert/ponytail
```

then

```
/plugin install ponytail@ponytail
```

Restart Claude Code (`Ctrl+C`, then `claude` again). On startup you should see a line like:

```
PONYTAIL MODE ACTIVE — level: full
```

That line is the confirmation it's live. If it's missing, see Troubleshooting.

### Non-interactive alternative

From a plain terminal, without opening Claude Code:

```bash
claude plugin marketplace add DietrichGebert/ponytail
claude plugin install ponytail@ponytail
```

---

## 2. Install Caveman

Same pattern, one line:

```bash
claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman
```

Or from inside Claude Code, again as two separate prompts:

```
/plugin marketplace add JuliusBrussee/caveman
```

```
/plugin install caveman@caveman
```

Caveman also ships a one-command installer that detects every AI agent on the machine (Cursor, Codex, Gemini CLI, etc.) and installs for all of them:

```bash
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex
```

Only run that if she wants it everywhere — the plugin command above is enough for Claude Code alone.

---

## 3. Install Superpowers

Superpowers ships on Anthropic's official marketplace, which Claude Code already has registered — so it's one command, no `marketplace add` step:

```
/plugin install superpowers@claude-plugins-official
```

From a plain terminal:

```bash
claude plugin install superpowers@claude-plugins-official
```

Restart Claude Code. Nothing prints on startup the way Ponytail does — instead the agent starts announcing which skill it's using ("Using superpowers:brainstorming to ..."), which is the confirmation it took.

Upstream mirror, if the official marketplace ever lags behind a release:

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

(Again — two separate prompts inside the interactive session.)

---

## 4. Install Frontend Design

Also on the official marketplace, so again one command:

```
/plugin install frontend-design@claude-plugins-official
```

From a plain terminal:

```bash
claude plugin install frontend-design@claude-plugins-official
```

Restart Claude Code. Like Superpowers it prints nothing at startup — it's a skill the agent pulls in automatically whenever the task is building or reshaping UI.

---

## 5. Verify

```
/plugin
```

`ponytail@ponytail`, `caveman@caveman`, `superpowers@claude-plugins-official` and `frontend-design@claude-plugins-official` should all be listed as installed and enabled.

Then a real test — ask for something an agent normally over-builds:

> add a date picker to this form

Without Ponytail you get flatpickr, a wrapper component, a stylesheet, and a discussion about timezones. With it you get:

```html
<!-- ponytail: browser has one -->
<input type="date">
```

---

## 6. Daily use

### Ponytail

| Command | What it does |
|---|---|
| `/ponytail lite\|full\|ultra` | intensity. `full` is the default and the right one |
| `/ponytail-review` | reviews a diff *only* for over-engineering — what to delete |
| `/ponytail-audit` | same, but scans the whole repo. Ranked list of bloat |
| `/ponytail-debt` | collects every `ponytail:` comment into a ledger of deliberate shortcuts |
| `/ponytail-help` | the full card |

Turn it off for a session: say `stop ponytail` or `normal mode`.

The ladder it follows, in order — it stops at the first rung that holds:

1. Does this need to exist at all? (YAGNI)
2. Already in this codebase? Reuse it.
3. Standard library does it? Use it.
4. Native platform feature covers it? (`<input type="date">` over a picker library, CSS over JS, a DB constraint over app code.)
5. Already-installed dependency solves it? Use it.
6. Can it be one line? One line.
7. Only then: the minimum code that works.

What it will *never* cut: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, or anything you explicitly asked for. Lazy, not negligent.

### Caveman

| Command | What it does |
|---|---|
| `/caveman lite\|full\|ultra\|wenyan` | compression level |
| `/caveman-commit` | Conventional Commit messages, ≤50-char subject |
| `/caveman-review` | one-line PR comments: `L42: 🔴 bug: user null. Add guard.` |
| `/caveman-compress <file>` | rewrites a memory file (like `CLAUDE.md`) into caveman-speak — cuts roughly 46% of input tokens every session after |
| `/caveman-stats` | actual token usage and dollars saved |

Off: `stop caveman` or `normal mode`.

It keeps her language — writes Portuguese, gets Portuguese caveman. It compresses style, never translates. Code, API names, commands and error strings stay verbatim.

### Superpowers

No level switches and mostly no commands — it's a library of skills the agent invokes on its own when the task matches. What she'll notice is the agent announcing `Using superpowers:brainstorming to ...` and then behaving differently.

The ones that fire most:

| Skill | Fires when | What changes |
|---|---|---|
| `brainstorming` | "let's build X", any new feature | asks about intent and requirements *before* writing code, instead of guessing |
| `systematic-debugging` | any bug, test failure, weird behavior | reproduces and isolates before proposing a fix — no shotgun patching |
| `test-driven-development` | implementing a feature or bugfix | test first, then implementation |
| `verification-before-completion` | before "done", "fixed", "passing" | must actually run the command and show output before claiming success |
| `writing-plans` | multi-step work | a written plan before touching code |
| `using-git-worktrees` | feature work needing isolation | sets up an isolated workspace |
| `requesting-code-review` / `receiving-code-review` | before merging, or when given feedback | verifies the feedback instead of agreeing performatively |

She can also name one directly: `use superpowers:systematic-debugging on this`.

**How it interacts with the other two.** Superpowers sets the *process*, Ponytail sets the *scope of the solution*, Caveman sets the *prose*. Order of operations is brainstorm → understand → then climb Ponytail's ladder → then report tersely. No conflict, but expect more up-front questions than bare Claude Code. If that's not wanted for a quick one-off, tell it to skip the skill for that task.

Worth knowing: Superpowers is deliberately insistent — if a skill applies, the agent is told it doesn't get a choice. That's the point, but it's a real behavior change from vanilla, so it's the plugin most worth trying alone first before stacking the rest.

### Frontend Design

No commands either. It fires on its own whenever the task is building or reshaping an interface — a landing page, a dashboard, a settings panel, a component restyle.

What it changes: instead of the default AI look (Inter, `rounded-lg` on everything, a purple-to-blue gradient hero, emoji section markers, everything centered), the agent commits to an actual aesthetic direction first — a palette of named hex values, a display face paired with a body face, a stated layout concept — then builds to it. It also grounds the design in the subject: a dashboard for logistics operators and a landing page for a kids' toy end up looking genuinely different.

To get the most out of it, give it a real brief. `"build a settings page"` gets a generic one; `"settings page for a warehouse robotics console, operators on shift, dark control-room environment"` gets something specific. If the brief doesn't say what the product is, it will ask.

It pairs oddly with Ponytail on purpose, and that's fine — Ponytail keeps the *code* minimal, Frontend Design keeps the *design* considered. Minimal code, deliberate design. Neither one asks for the other's territory.

Related but separate, if she wants a guided workflow rather than an automatic skill: `frontend-design-pro` adds `/design`, `/analyze-site` (pull palette and type off a site she likes) and `/review` (check output against anti-patterns and accessibility). Optional — the official plugin above is the one to start with.

---

## 7. Troubleshooting

**No `PONYTAIL MODE ACTIVE` line on startup.** The Node hook isn't running. Check `zsh -c 'node --version'` works (see Prerequisites). Then fully restart Claude Code — plugin hooks only load at session start.

**"Marketplace already exists".** Harmless, it's already added. Skip to the install step.

**Install seemed to do nothing.** In the interactive prompt the two `/plugin` commands must be sent as separate messages. Pasted together, only the first runs.

**Want to see what a plugin actually injects.** Run `/context` — the ruleset shows up in the session context.

**Update later:**

```bash
claude plugin marketplace update ponytail
claude plugin update ponytail@ponytail
claude plugin update superpowers@claude-plugins-official
claude plugin update frontend-design@claude-plugins-official
```

**Uninstall:**

```bash
claude plugin uninstall ponytail@ponytail
claude plugin uninstall caveman@caveman
claude plugin uninstall superpowers@claude-plugins-official
claude plugin uninstall frontend-design@claude-plugins-official
```

---

## 8. Optional: pin it per-repo

Both read `AGENTS.md` from a repo root as always-on context. So for a shared project, the rules can travel with the repo instead of depending on everyone having the plugin installed:

```
/caveman-init
```

drops the caveman activation rule into the current repo for every IDE agent. Ponytail's equivalent is copying its `AGENTS.md` section into the project's own `AGENTS.md`.

Superpowers reads `AGENTS.md` / `CLAUDE.md` too, so its process rules can ride along in the repo the same way.

Worth doing only if the whole team wants it. For one person, the user-scope plugin installs in steps 1–4 are the whole job.
