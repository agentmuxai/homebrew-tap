cask "agentmux" do
  version "0.60.28"
  sha256 "c261483000b27d597beb95486ba83fa0e17dbf8a2cbf3d1e4b07beaa82c2cf15"

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
