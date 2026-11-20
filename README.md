# Homebrew tap for AgentMux

Install AgentMux on an Apple Silicon Mac:

```
brew install --cask agentmuxai/tap/agentmux
```

AgentMux updates itself from inside the app, so `brew upgrade` leaves it alone unless you ask for it with `brew upgrade --cask --greedy agentmux`.

To remove it, and the data it keeps in `~/.agentmux`:

```
brew uninstall --cask --zap agentmux
```

The cask is generated from each release's signed manifest in [agentmuxai/agentmux](https://github.com/agentmuxai/agentmux); do not edit `Casks/agentmux.rb` by hand.

## How the cask is kept current

Each AgentMux release ends with a step that updates the cask: `scripts/bump.sh` reads the release's signed envelope, checks it against the pinned keys in `update-keys.json`, and renders `Casks/agentmux.rb` from the signed manifest; the person or agent cutting the release then opens an ordinary pull request from a branch named `bump-X.Y.Z`. Merging needs an approving review and three passing checks:

- `scripts`: the renderer's and the provenance rule's tests.
- `cask`: on a macOS runner, `brew style`, `brew audit --strict --online`, then install and uninstall.
- `provenance`: runs from `main`, so a pull request cannot change the rule that judges it, and it judges the commit it reports on. A pull request may change `Casks/agentmux.rb`, `.github/`, `scripts/`, `update-keys.json`, `README.md`, `.gitattributes` and `LICENSE`, and nothing else (a formula of the same name, another cask, `cmd/` and the migration files would change what `brew install` installs). A pull request that changes the cask must carry, byte for byte, what `main` renders from the signed release the cask names, at a version not lower than `main`'s. The cask is read as data and never run.

An hourly workflow (`stale.yml`) only watches: when the cask is behind the latest release it fails and opens (or updates) one issue saying so, and it closes the issue when the cask has caught up. It opens no pull request on purpose: the GitHub Actions setting that lets a workflow create pull requests also lets it approve them, and a workflow on any branch could use that to approve a pull request of its own, so that setting stays off.

`update-keys.json` is a copy of the update keys the app pins; when the app rotates its signing key, update it here in the same change.

To change the cask template, use two pull requests: first the renderer change in `scripts/render-cask.mjs` (the cask is untouched, so `provenance` passes), then a pull request with the cask re-rendered by the new renderer, which `main`'s new renderer then proves.
