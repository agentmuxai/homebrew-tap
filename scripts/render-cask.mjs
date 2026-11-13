#!/usr/bin/env node
// render-cask.mjs: print the Homebrew cask for a release, from that release's signed manifest.
//
// The hash in the cask is the one in AgentMux-<version>-manifest.json (the file the release signs and the
// in-app updater trusts), never the hash of a fresh download, so the cask can only name bytes the release
// signed. The spec is agentmuxai/agentmux docs/specs/SPEC_ONE_COMMAND_INSTALL_ALL_PLATFORMS_2026_11_01.md, section 4.2.
//
// Usage:  node scripts/render-cask.mjs <manifest.json>      -> the cask on stdout (no signature check)
//         node scripts/render-cask.mjs --signed <manifest.json> <envelope.json> <envelope.json.sig> <update-keys.json>
//                                                                   -> the same, after checking the envelope's
//                                                                      Ed25519 signature against the pinned keys,
//                                                                      its tag, and that it names this manifest
//         node scripts/render-cask.mjs --check <cask.rb>    -> exit 0 if the file is plain ASCII with no CR
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DMG = /^AgentMux_(\d+\.\d+\.\d+)_arm64\.dmg$/;

export function renderCask(manifest) {
    const version = String(manifest?.version ?? "");
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`the manifest has no usable version: ${JSON.stringify(manifest?.version)}`);
    if (manifest.tag !== `v${version}`) throw new Error(`the manifest's tag ${JSON.stringify(manifest.tag)} is not v${version}`);
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const dmgs = files.filter((f) => DMG.test(String(f?.name ?? "")));
    if (dmgs.length !== 1) throw new Error(`expected exactly one arm64 dmg in the manifest, found ${dmgs.length}`);
    const [dmg] = dmgs;
    if (dmg.name !== `AgentMux_${version}_arm64.dmg`) throw new Error(`the dmg ${dmg.name} is not for version ${version}`);
    if (!/^[0-9a-f]{64}$/.test(String(dmg.sha256 ?? ""))) throw new Error("the dmg has no sha256 in the manifest");

    return `cask "agentmux" do
  version "${version}"
  sha256 "${dmg.sha256}"

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
`;
}

// The 12 bytes that turn 32 raw Ed25519 key bytes into a DER (SPKI) public key.
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Check a release's signed envelope the way the app and install.sh do: the signature file has one line per key,
 * "<key id> <base64 signature>", and the envelope (its exact bytes) is signed by the pinned key with that id.
 * Then the envelope must be for the manifest's tag and name this manifest's sha256. Throws when anything is off.
 */
export function checkSigned({ manifestBytes, envelopeBytes, sigText, keys }) {
    const pinned = Array.isArray(keys?.keys) ? keys.keys : [];
    const lines = String(sigText).split(/\r?\n/).filter(Boolean);
    let good = false;
    for (const key of pinned) {
        const line = lines.find((l) => l.startsWith(`${key.id} `));
        if (!line) continue;
        const raw = Buffer.from(String(key.public_key), "base64");
        if (raw.length !== 32) continue;
        const pub = createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: "der", type: "spki" });
        const sig = Buffer.from(line.slice(key.id.length + 1).trim(), "base64");
        good = verify(null, envelopeBytes, pub, sig);
        break;
    }
    if (!good) throw new Error("the envelope's signature does not match a pinned key");
    const envelope = JSON.parse(envelopeBytes.toString("utf8"));
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    if (envelope.tag !== manifest.tag) throw new Error("the envelope is for another release");
    if (envelope.manifest_sha256 !== createHash("sha256").update(manifestBytes).digest("hex")) {
        throw new Error("the manifest is not the one the envelope names");
    }
    return manifest;
}

export function isPlain(text) {
    return /^[\x0a\x20-\x7e]*$/.test(text);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const [a, b] = process.argv.slice(2);
    try {
        if (a === "--check") {
            process.exit(isPlain(readFileSync(b, "utf8")) ? 0 : 1);
        }
        if (a === "--signed") {
            const [manifestPath, envelopePath, sigPath, keysPath] = process.argv.slice(3);
            if (!keysPath) throw new Error("usage: render-cask.mjs --signed <manifest> <envelope> <envelope.sig> <update-keys.json>");
            const manifestBytes = readFileSync(manifestPath);
            const manifest = checkSigned({
                manifestBytes,
                envelopeBytes: readFileSync(envelopePath),
                sigText: readFileSync(sigPath, "utf8"),
                keys: JSON.parse(readFileSync(keysPath, "utf8")),
            });
            process.stdout.write(renderCask(manifest));
            process.exit(0);
        }
        if (!a) throw new Error("usage: render-cask.mjs <manifest.json>");
        process.stdout.write(renderCask(JSON.parse(readFileSync(a, "utf8"))));
    } catch (e) {
        console.error(`render-cask: ${e.message}`);
        process.exit(2);
    }
}
