cask "agentmux" do
  version "0.60.36"
  sha256 "489eaa3cad80172178181665c40f81c78ccf0fa3bf5f10287aebafae136f6de7"

  url "https://github.com/agentmuxai/agentmux/releases/download/v#{version}/AgentMux_#{version}_arm64.dmg"
  name "AgentMux"
  desc "Desktop workspace for AI coding agents"
  homepage "https://agentmux.ai/"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on arch: :arm64
  depends_on :macos

  app "AgentMux.app"
  # agentmux on PATH: a small script that asks macOS to open the app, as the code command does. A bare
  # symlink to the bundle's launcher does not work (the launcher looks for its runtime next to the link),
  # and running the launcher itself keeps the terminal busy for as long as the app runs.
  generated_script "agentmux", content: <<~SH
    #!/bin/sh
    exec /usr/bin/open -a AgentMux --args "$@"
  SH
  binary "agentmux"

  zap trash: "~/.agentmux"
end
