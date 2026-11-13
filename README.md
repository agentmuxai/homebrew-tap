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

An hourly workflow (`bump.yml`) reads the latest AgentMux release, checks that release's signed envelope against the pinned keys in `update-keys.json`, renders `Casks/agentmux.rb` from the signed manifest and opens a pull request. Merging needs an approving review and three passing checks:

- `scripts`: the renderer's and the provenance rule's tests.
- `cask`: on a macOS runner, `brew style`, `brew audit --strict --online`, then install and uninstall.
- `provenance`: runs from `main`, so a pull request cannot change the rule that judges it. A pull request that changes the cask must carry, byte for byte, what `main` renders from the signed release the cask names, at a version not lower than `main`'s. The cask is read as data and never run.

`update-keys.json` is a copy of the update keys the app pins; when the app rotates its signing key, update it here in the same change. A change to the cask template itself changes the cask without a new release, so `provenance` refuses it by design: it needs a repository admin.
