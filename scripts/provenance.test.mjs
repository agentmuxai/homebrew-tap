// Tests for scripts/provenance.mjs.  Run:  node --test scripts/provenance.test.mjs
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { caskVersion, checkProvenance, compareVersions } from "./provenance.mjs";
import { renderCask } from "./render-cask.mjs";

const SCRIPT = fileURLToPath(new URL("./provenance.mjs", import.meta.url));

const manifest = (version = "0.60.26", hash = "a".repeat(64)) => ({
    format: 1,
    version,
    tag: `v${version}`,
    files: [{ name: `AgentMux_${version}_arm64.dmg`, size: 2, sha256: hash }],
});

function release(version = "0.60.26", hash) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const m = manifest(version, hash);
    const manifestBytes = Buffer.from(JSON.stringify(m));
    const envelopeBytes = Buffer.from(
        JSON.stringify({ format: 1, tag: m.tag, manifest_sha256: createHash("sha256").update(manifestBytes).digest("hex") }),
    );
    return {
        m,
        manifestBytes,
        envelopeBytes,
        sigText: `k1 ${sign(null, envelopeBytes, privateKey).toString("base64")}\n`,
        keys: { keys: [{ id: "k1", public_key: raw.toString("base64") }] },
    };
}

const args = (r, prCask, mainCask) => ({ prCask, mainCask, ...r });

test("the cask that is the render of the signed release passes, from an older main and from the same version", () => {
    const r = release();
    const older = renderCask(manifest("0.60.25", "b".repeat(64)));
    checkProvenance(args(r, renderCask(r.m), older));
    checkProvenance(args(r, renderCask(r.m), renderCask(r.m)));
});

test("a cask with another hash, an extra space or a changed line is refused", () => {
    const r = release();
    const good = renderCask(r.m);
    const older = renderCask(manifest("0.60.25", "b".repeat(64)));
    assert.throws(() => checkProvenance(args(r, good.replace("a".repeat(64), "f".repeat(64)), older)), /not the render/);
    assert.throws(() => checkProvenance(args(r, `${good} `, older)), /not the render/);
    assert.throws(() => checkProvenance(args(r, good.replace("zap trash", "zap delete"), older)), /not the render/);
    assert.throws(() => checkProvenance(args(r, good.replace('desc "', 'desc "x'), older)), /not the render/);
});

test("a cask older than main's is refused, even when it is genuine", () => {
    const r = release("0.60.24");
    const newer = renderCask(manifest("0.60.26"));
    assert.throws(() => checkProvenance(args(r, renderCask(r.m), newer)), /older than main/);
});

test("a cask naming one release while the signed release is another is refused", () => {
    const r = release("0.60.27");
    const named = renderCask(manifest("0.60.26"));
    const main = renderCask(manifest("0.60.25", "b".repeat(64)));
    assert.throws(() => checkProvenance(args(r, named, main)), /names 0\.60\.26/);
});

test("a release not signed by the pinned key is refused", () => {
    const r = release();
    const other = release();
    const older = renderCask(manifest("0.60.25", "b".repeat(64)));
    assert.throws(() => checkProvenance(args({ ...r, keys: other.keys }, renderCask(r.m), older)), /does not match a pinned key/);
});

test("only a strict x.y.z version is taken from a cask, so nothing can ride in it", () => {
    assert.equal(caskVersion('cask "agentmux" do\n  version "1.22.333"\n'), "1.22.333");
    for (const bad of ['  version "1.2.3; rm -rf /"', '  version "1.2.3$(id)"', '  version "v1.2.3"', '  version "1.2"', '   version "1.2.3"', "  version '1.2.3'", ""]) {
        assert.throws(() => caskVersion(bad), /no version line/, JSON.stringify(bad));
    }
});

test("versions compare by number, not by text", () => {
    assert.equal(compareVersions("0.60.9", "0.60.10"), -1);
    assert.equal(compareVersions("0.61.0", "0.60.99"), 1);
    assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
});

test("the command line prints a version, and exits 2 with a reason on a bad cask or a bad release", () => {
    const dir = mkdtempSync(join(tmpdir(), "prov-"));
    const good = join(dir, "good.rb");
    const bad = join(dir, "bad.rb");
    writeFileSync(good, renderCask(manifest()));
    writeFileSync(bad, 'cask "x" do\n  version "1.2.3; id"\nend\n');
    const ok = spawnSync(process.execPath, [SCRIPT, "version", good], { encoding: "utf8" });
    assert.equal(ok.status, 0);
    assert.equal(ok.stdout, "0.60.26\n");
    const no = spawnSync(process.execPath, [SCRIPT, "version", bad], { encoding: "utf8" });
    assert.equal(no.status, 2);
    assert.match(no.stderr, /no version line/);

    const r = release();
    const files = {
        manifest: join(dir, "m.json"),
        envelope: join(dir, "e.json"),
        sig: join(dir, "e.sig"),
        keys: join(dir, "k.json"),
    };
    writeFileSync(files.manifest, r.manifestBytes);
    writeFileSync(files.envelope, r.envelopeBytes);
    writeFileSync(files.sig, r.sigText);
    writeFileSync(files.keys, JSON.stringify(r.keys));
    const run = (pr) => spawnSync(process.execPath, [SCRIPT, "check", pr, good, files.manifest, files.envelope, files.sig, files.keys], { encoding: "utf8" });
    assert.equal(run(good).status, 0);
    const tampered = join(dir, "t.rb");
    writeFileSync(tampered, renderCask(manifest("0.60.26", "e".repeat(64))));
    const t = run(tampered);
    assert.equal(t.status, 2);
    assert.match(t.stderr, /not the render/);
});
