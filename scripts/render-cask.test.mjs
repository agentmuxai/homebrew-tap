// Tests for scripts/render-cask.mjs.  Run:  node --test scripts/render-cask.test.mjs
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isPlain, renderCask } from "./render-cask.mjs";

const SCRIPT = fileURLToPath(new URL("./render-cask.mjs", import.meta.url));
const SHA = "a".repeat(63) + "b";
const manifest = (over = {}) => ({
    format: 1,
    version: "0.60.26",
    tag: "v0.60.26",
    files: [
        { name: "AgentMux-0.60.26-x64-setup.exe", size: 1, sha256: "c".repeat(64) },
        { name: "AgentMux_0.60.26_arm64.dmg", size: 2, sha256: SHA },
        { name: "AgentMux_0.60.26_amd64.deb", size: 3, sha256: "d".repeat(64) },
    ],
    ...over,
});

test("the cask carries the version and the dmg's hash from the manifest, and nothing else's", () => {
    const cask = renderCask(manifest());
    assert.match(cask, /^cask "agentmux" do\n {2}version "0\.60\.26"\n {2}sha256 "a{63}b"\n/);
    assert.ok(!cask.includes("c".repeat(64)) && !cask.includes("d".repeat(64)));
    assert.ok(cask.includes('url "https://github.com/agentmuxai/agentmux/releases/download/v#{version}/AgentMux_#{version}_arm64.dmg"'));
    assert.ok(cask.includes("auto_updates true") && cask.includes("depends_on arch: :arm64"));
    assert.ok(cask.includes('app "AgentMux.app"') && cask.endsWith("end\n"));
});

test("the cask is plain ASCII with unix line ends, no smart quotes", () => {
    assert.ok(isPlain(renderCask(manifest())));
    assert.ok(!isPlain("it’s"));
    assert.ok(!isPlain("a\r\nb"));
});

test("a manifest that does not name exactly one arm64 dmg for its version is refused", () => {
    assert.throws(() => renderCask(manifest({ files: [] })), /exactly one arm64 dmg/);
    const two = manifest();
    two.files.push({ name: "AgentMux_0.60.25_arm64.dmg", size: 1, sha256: SHA });
    assert.throws(() => renderCask(two), /exactly one arm64 dmg/);
    const other = manifest({ files: [{ name: "AgentMux_0.60.25_arm64.dmg", size: 1, sha256: SHA }] });
    assert.throws(() => renderCask(other), /is not for version/);
});

test("a bad version, a tag for another version or a bad hash is refused", () => {
    assert.throws(() => renderCask(manifest({ version: "latest" })), /no usable version/);
    assert.throws(() => renderCask(manifest({ tag: "v0.60.25" })), /tag/);
    const bad = manifest();
    bad.files[1].sha256 = "xyz";
    assert.throws(() => renderCask(bad), /no sha256/);
});

test("the command line prints the cask, and exits 2 with a reason on a bad manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "cask-"));
    const good = join(dir, "good.json");
    writeFileSync(good, JSON.stringify(manifest()));
    assert.equal(execFileSync(process.execPath, [SCRIPT, good], { encoding: "utf8" }), renderCask(manifest()));
    const badFile = join(dir, "bad.json");
    writeFileSync(badFile, JSON.stringify(manifest({ files: [] })));
    const r = spawnSync(process.execPath, [SCRIPT, badFile], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /render-cask: expected exactly one arm64 dmg/);
});

// ── the signed path ──────────────────────────────────────────────────────────────────────────────────────────
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { checkSigned } from "./render-cask.mjs";

function signedRelease(over = {}) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const manifestBytes = Buffer.from(JSON.stringify(manifest(over.manifest)));
    const envelopeBytes = Buffer.from(
        JSON.stringify({
            format: 1,
            tag: "v0.60.26",
            manifest_sha256: createHash("sha256").update(manifestBytes).digest("hex"),
            ...over.envelope,
        }),
    );
    const sig = sign(null, over.signed ?? envelopeBytes, privateKey).toString("base64");
    return {
        manifestBytes,
        envelopeBytes,
        sigText: `k1 ${sig}\n`,
        keys: { keys: [{ id: "k1", public_key: raw.toString("base64") }] },
    };
}

test("a release signed by the pinned key renders; the manifest comes back parsed", () => {
    assert.equal(checkSigned(signedRelease()).version, "0.60.26");
});

test("a signature by another key, over other bytes, or for another id is refused", () => {
    const r = signedRelease();
    assert.throws(() => checkSigned({ ...r, keys: signedRelease().keys }), /does not match a pinned key/);
    assert.throws(() => checkSigned(signedRelease({ signed: Buffer.from("something else") })), /does not match a pinned key/);
    assert.throws(() => checkSigned({ ...r, sigText: r.sigText.replace(/^k1 /, "k2 ") }), /does not match a pinned key/);
    assert.throws(() => checkSigned({ ...r, keys: { keys: [] } }), /does not match a pinned key/);
});

test("a signed envelope for another tag, or one that names another manifest, is refused", () => {
    const wrongTag = signedRelease({ envelope: { tag: "v0.60.25" } });
    assert.throws(() => checkSigned(wrongTag), /another release/);
    const wrongHash = signedRelease({ envelope: { manifest_sha256: "0".repeat(64) } });
    assert.throws(() => checkSigned(wrongHash), /not the one the envelope names/);
});
