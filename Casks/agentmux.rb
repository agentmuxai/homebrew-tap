cask "agentmux" do
  version "0.60.26"
  sha256 "9a42a0f4e7ccbe7925cabc09b57b977412cbf5a2e4b4ef7e8648077a529369c6"

  url "https://github.com/agentmuxai/agentmux/releases/download/v#{version}/AgentMux_#{version}_arm64.dmg"
  name "AgentMux"
  desc "Desktop workspace for AI coding agents"
  homepage "https://agentmux.ai"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on arch: :arm64
  depends_on macos: ">= :big_sur"

  app "AgentMux.app"

  zap trash: "~/.agentmux"
end
