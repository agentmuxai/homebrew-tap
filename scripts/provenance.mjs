#!/usr/bin/env node
// provenance.mjs: the rule behind the required "provenance" check.
//
// A pull request that changes Casks/agentmux.rb is only acceptable when the cask it carries is, byte for byte,
// the cask that THIS repository's main renders from the signed release the cask names, and its version is not
// lower than main's. The cask arrives as plain data (a file fetched from the pull request); it is never run.
// This script, the renderer and update-keys.json all come from main, never from the pull request.
//
// Usage:  node scripts/provenance.mjs paths [--bump] <files.tsv>
//             -> prints cask or nocask; exit 2 naming the path when a pull request changes one it may not
//         node scripts/provenance.mjs version <cask.rb>
//             -> prints the version the cask names (a strict x.y.z), exit 2 when it names anything else
//         node scripts/provenance.mjs check <pr-cask.rb> <main-cask.rb> <manifest.json> <envelope.json> <envelope.json.sig> <update-keys.json>
//             -> exit 0 when the pull request's cask is the render of the signed release and not older than main's
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkSigned, renderCask } from "./render-cask.mjs";

const VERSION_LINE = /^ {2}version "(\d+\.\d+\.\d+)"$/m;

/** The version a cask names, or throws. Nothing but x.y.z gets through, so it is safe to put in a file name or a tag. */
export function caskVersion(text) {
    const m = VERSION_LINE.exec(String(text));
    if (!m) throw new Error("the cask has no version line of the form  version \"x.y.z\"");
    return m[1];
}

/** -1, 0 or 1 for two strict x.y.z versions. */
export function compareVersions(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
    }
    return 0;
}

const CASK = "Casks/agentmux.rb";

// What a pull request may change besides the cask. Anything else could change what
// `brew install agentmuxai/tap/agentmux` installs (a formula of the same name wins over a cask, another
// cask, cmd/, tap_migrations.json and the renames files), so it is refused by name.
const ALLOWED = [/^\.github\//, /^scripts\//, /^update-keys\.json$/, /^README\.md$/, /^\.gitattributes$/, /^LICENSE$/];

/**
 * files: [{status, name, previous}] as the pull-request files API lists them. Returns "cask" when the pull
 * request touches Casks/agentmux.rb (it then needs the byte-for-byte proof) or "nocask". Throws, naming the
 * path, when it changes a path outside the allow-list, removes or renames the cask, or when bump is true
 * (a bump-* branch) and it changes anything but the cask.
 */
export function classifyPaths(files, { bump = false } = {}) {
    let touches = false;
    for (const f of files) {
        for (const p of [f.name, f.previous].filter(Boolean)) {
            if (p === CASK) {
                touches = true;
                if (f.status === "removed" || (f.status === "renamed" && f.previous === CASK)) {
                    throw new Error(`the cask is removed or renamed (${JSON.stringify(p)})`);
                }
            } else if (bump) {
                throw new Error(`a bump branch may change nothing but ${CASK}, not ${JSON.stringify(p)}`);
            } else if (!ALLOWED.some((re) => re.test(p))) {
                throw new Error(`a pull request may not change ${JSON.stringify(p)}`);
            }
        }
    }
    return touches ? "cask" : "nocask";
}

/** Parse the tab-separated lines the workflow writes: status, filename, previous filename (maybe empty). */
export function parseFiles(tsv) {
    return String(tsv)
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            const [status, name, previous] = line.split("\t");
            return { status, name, previous: previous || "" };
        });
}

/** Throws unless prCask is exactly the render of the signed release it names and is not older than mainCask. */
export function checkProvenance({ prCask, mainCask, manifestBytes, envelopeBytes, sigText, keys }) {
    const prVersion = caskVersion(prCask);
    const mainVersion = caskVersion(mainCask);
    if (compareVersions(prVersion, mainVersion) < 0) {
        throw new Error(`the cask is at ${prVersion}, older than main's ${mainVersion}`);
    }
    const manifest = checkSigned({ manifestBytes, envelopeBytes, sigText, keys });
    if (manifest.version !== prVersion) throw new Error(`the signed release is ${manifest.version}, the cask names ${prVersion}`);
    if (String(prCask) !== renderCask(manifest)) {
        throw new Error("the cask is not the render of the signed release it names");
    }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const [cmd, ...args] = process.argv.slice(2);
    try {
        if (cmd === "version") {
            process.stdout.write(`${caskVersion(readFileSync(args[0], "utf8"))}\n`);
            process.exit(0);
        }
        if (cmd === "paths") {
            const bump = args[0] === "--bump";
            const file = bump ? args[1] : args[0];
            process.stdout.write(`${classifyPaths(parseFiles(readFileSync(file, "utf8")), { bump })}\n`);
            process.exit(0);
        }
        if (cmd === "check") {
            const [pr, main, manifest, envelope, sig, keys] = args;
            if (!keys) throw new Error("usage: provenance.mjs check <pr-cask> <main-cask> <manifest> <envelope> <envelope.sig> <update-keys.json>");
            checkProvenance({
                prCask: readFileSync(pr, "utf8"),
                mainCask: readFileSync(main, "utf8"),
                manifestBytes: readFileSync(manifest),
                envelopeBytes: readFileSync(envelope),
                sigText: readFileSync(sig, "utf8"),
                keys: JSON.parse(readFileSync(keys, "utf8")),
            });
            console.log("provenance: the cask is the render of the signed release it names");
            process.exit(0);
        }
        throw new Error("usage: provenance.mjs paths [--bump] <files.tsv> | version <cask> | check <pr-cask> <main-cask> <manifest> <envelope> <sig> <keys>");
    } catch (e) {
        console.error(`provenance: ${e.message}`);
        process.exit(2);
    }
}
