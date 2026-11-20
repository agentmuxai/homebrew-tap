#!/usr/bin/env bash
# bump.sh [X.Y.Z]: render Casks/agentmux.rb from a release's signed manifest.
#
# Run it from a clone of this repository, on a branch named bump-X.Y.Z. It downloads the release's manifest,
# envelope and signature, renders the cask with scripts/render-cask.mjs (which checks the envelope's signature
# against the pinned update-keys.json) and refuses a manifest that is for another version than the release
# asked for. With no argument it takes the latest release. It changes nothing but Casks/agentmux.rb and opens no
# pull request: commit that file, open the pull request as usual, and let the required checks and a review
# decide. GH names the GitHub CLI to use (default gh; an agent sets GH=gh-agent).
set -euo pipefail
cd "$(dirname "$0")/.."
GH="${GH:-gh}"

if [ "$#" -ge 1 ]; then
    ver="$1"
    tag="v$ver"
else
    tag="$($GH api repos/agentmuxai/agentmux/releases/latest --jq .tag_name)"
    ver="${tag#v}"
fi
# Strict x.y.z only: the value goes into file names and a release tag.
if ! [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "bump.sh: the release tag is not of the form vX.Y.Z: $tag" >&2
    exit 1
fi

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
$GH release download "$tag" -R agentmuxai/agentmux -D "$dir" \
    -p "AgentMux-$ver-manifest.json" \
    -p "AgentMux-$ver-envelope.json" \
    -p "AgentMux-$ver-envelope.json.sig"
node scripts/render-cask.mjs --signed \
    "$dir/AgentMux-$ver-manifest.json" \
    "$dir/AgentMux-$ver-envelope.json" \
    "$dir/AgentMux-$ver-envelope.json.sig" \
    update-keys.json > Casks/agentmux.rb.new
# The files must be the ones of the release asked for: old genuine files uploaded under a new release's names
# would otherwise render an old cask under a new title.
rendered="$(node scripts/provenance.mjs version Casks/agentmux.rb.new)"
if [ "$rendered" != "$ver" ]; then
    rm -f Casks/agentmux.rb.new
    echo "bump.sh: the signed manifest is for $rendered, not for the release $ver" >&2
    exit 1
fi
mv Casks/agentmux.rb.new Casks/agentmux.rb
echo "Casks/agentmux.rb is now at $ver. Next: git checkout -b bump-$ver; git add Casks/agentmux.rb; commit; open the pull request."
