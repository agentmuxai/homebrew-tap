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
