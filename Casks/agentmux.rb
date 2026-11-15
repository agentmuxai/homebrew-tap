cask "agentmux" do
  version "0.60.29"
  sha256 "47271f3612765be36a7e3958a5803556795d42844c0fff92cd13db03ee84ddec"

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
