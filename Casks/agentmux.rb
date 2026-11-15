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
  # agentmux on PATH: a small script that asks macOS to open the app, as the code command does. A bare symlink
  # to the bundle's launcher does not work (the launcher looks for its runtime next to the link), and
  # running the launcher itself keeps the terminal busy for as long as the app runs.
  preflight do
    File.write "#{staged_path}/agentmux", <<~EOS
      #!/bin/sh
      exec /usr/bin/open -a "#{appdir}/AgentMux.app" --args "$@"
    EOS
    FileUtils.chmod "+x", "#{staged_path}/agentmux"
  end

  binary "#{staged_path}/agentmux"

  zap trash: "~/.agentmux"
end
