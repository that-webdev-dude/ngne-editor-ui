import { dirname, relative, resolve, sep } from "node:path";

// The import table of SPEC §1.1 as a lint rule: what a module of each layer under src/ may
// import. Relative imports are resolved and checked by the layer they reach; bare ones by
// package. No layer imports `@ngne/core`, an app or a CSS file.

/** The peers a UI module may import (BRIEF D4), with their subpaths. */
const PEERS = ["react", "react-dom", "radix-ui", "lucide-react", "zustand"];

/** Per layer: the layers its relative imports may reach, and whether it may import peers or `node:*`. */
const LAYERS = {
    model: { layers: ["model"], peers: false, node: false },
    colour: { layers: ["colour"], peers: false, node: false },
    ui: { layers: ["model", "colour", "ui"], peers: true, node: false },
    worker: { layers: ["worker", "model"], peers: false, node: false },
    build: { layers: ["build"], peers: false, node: true },
};

const isPeer = (source) => PEERS.some((peer) => source === peer || source.startsWith(`${peer}/`));

/** The layer folder of `file` under `srcDir`, or null outside it. */
function layerOf(file, srcDir) {
    const path = relative(srcDir, file);
    if (path.startsWith("..") || path === "") return null;
    return path.split(sep)[0];
}

/** Why `source`, imported by a module of `layer` at `file`, is not allowed, or null. */
function problem(source, layer, file, srcDir) {
    const rules = LAYERS[layer];
    if (/\.css(\?.*)?$/.test(source)) return "Package modules import no CSS (SPEC §4).";
    if (source === "@ngne/core" || source.startsWith("@ngne/core/")) {
        return "No layer imports @ngne/core (SPEC §1.1, BRIEF D2).";
    }
    if (source.startsWith("@ngne/") || source.startsWith("ngne-")) {
        return "No layer imports an app or another NGNE package (SPEC §1.1).";
    }
    if (source.startsWith(".")) {
        const target = layerOf(resolve(dirname(file), source), srcDir);
        if (target === null) return `src/${layer} imports nothing outside src/ (SPEC §1.1).`;
        if (!rules.layers.includes(target)) {
            return `src/${layer} may not import src/${target} (SPEC §1.1).`;
        }
        return null;
    }
    if (source.startsWith("node:")) {
        return rules.node ? null : `Only src/build imports node:* (SPEC §1.1).`;
    }
    if (isPeer(source)) {
        return rules.peers ? null : `Only src/ui imports ${source} (SPEC §1.1, BRIEF D4).`;
    }
    if (rules.node) return `src/build imports only node:* modules, not ${source} (SPEC §1.1).`;
    return `src/${layer} may not import ${source} (SPEC §1.1).`;
}

/** @type {import("eslint").Rule.RuleModule} */
export const layerImports = {
    meta: {
        type: "problem",
        docs: { description: "Enforces the layer import table of SPEC §1.1" },
        schema: [
            { type: "object", properties: { srcDir: { type: "string" } }, required: ["srcDir"] },
        ],
    },
    create(context) {
        const srcDir = resolve(context.options[0].srcDir);
        const file = resolve(context.filename);
        const layer = layerOf(file, srcDir);
        if (!layer || !(layer in LAYERS)) return {};
        const check = (node) => {
            const source = node.source;
            if (source?.type !== "Literal" || typeof source.value !== "string") return;
            const message = problem(source.value, layer, file, srcDir);
            if (message) context.report({ node: source, message });
        };
        return {
            ImportDeclaration: check,
            ExportNamedDeclaration: check,
            ExportAllDeclaration: check,
            ImportExpression: check,
            TSImportType(node) {
                const argument = node.argument;
                const literal = argument?.type === "TSLiteralType" ? argument.literal : argument;
                if (literal?.type === "Literal") check({ source: literal });
            },
            CallExpression(node) {
                if (node.callee.type === "Identifier" && node.callee.name === "require") {
                    check({ source: node.arguments[0] });
                }
            },
        };
    },
};
