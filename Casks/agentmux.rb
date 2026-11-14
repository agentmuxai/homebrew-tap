cask "agentmux" do
  version "0.60.27"
  sha256 "a4a95bb2a23162f5c1dcc16bf1ad53f7d1b145c34094334daac86b33de9b8281"

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

  zap trash: "~/.agentmux"
end
