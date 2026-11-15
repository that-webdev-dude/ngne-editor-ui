import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// The layer import table of SPEC §1.1, as lint enforces it (eslint/layer-imports.js): fixture
// modules that break it fail lint at their place in the tree; the real tree passes.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const eslint = new ESLint({ cwd: ROOT });

/** The layer-rule messages of `code` linted as the module at `path`. */
async function layerProblems(path: string, code: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath: `${ROOT}${path}` });
    return result!.messages
        .filter((message) => message.ruleId === "ngne/layer-imports")
        .map((message) => message.message);
}

describe("layer imports", () => {
    it("fails an import of @ngne/core, from any layer", async () => {
        expect(
            await layerProblems("src/ui/fixture.ts", 'export { x } from "@ngne/core";\n'),
        ).toEqual(["No layer imports @ngne/core (SPEC §1.1, BRIEF D2)."]);
        expect(
            await layerProblems("src/model/fixture.ts", 'import "@ngne/core/viewport";\n'),
        ).toHaveLength(1);
    });

    it("fails React imported from src/model", async () => {
        expect(
            await layerProblems(
                "src/model/fixture.ts",
                'import { useState } from "react";\nexport const hook = useState;\n',
            ),
        ).toEqual(["Only src/ui imports react (SPEC §1.1, BRIEF D4)."]);
    });

    it("fails src/ui imported from src/worker", async () => {
        expect(
            await layerProblems(
                "src/worker/fixture.ts",
                'import { x } from "../ui/index.js";\nexport const y = x;\n',
            ),
        ).toEqual(["src/worker may not import src/ui (SPEC §1.1)."]);
    });

    it("fails a module other than node:* imported from src/build", async () => {
        expect(
            await layerProblems(
                "src/build/fixture.ts",
                'import { readFileSync } from "fs";\nexport const read = readFileSync;\n',
            ),
        ).toEqual(["src/build imports only node:* modules, not fs (SPEC §1.1)."]);
        expect(
            await layerProblems("src/build/fixture.ts", 'import "../model/overlay/index.js";\n'),
        ).toEqual(["src/build may not import src/model (SPEC §1.1)."]);
    });

    it("fails a CSS import and an import from outside src/", async () => {
        expect(await layerProblems("src/ui/fixture.ts", 'import "../styles/base.css";\n')).toEqual([
            "Package modules import no CSS (SPEC §4).",
        ]);
        expect(
            await layerProblems("src/colour/fixture.ts", 'import "../../tests/unit/x.js";\n'),
        ).toEqual(["src/colour imports nothing outside src/ (SPEC §1.1)."]);
    });

    it("allows what the table allows", async () => {
        const allowed: [string, string][] = [
            ["src/ui/fixture.tsx", 'import { useState } from "react";\nimport "radix-ui";\n'],
            [
                "src/ui/fixture.ts",
                'import "../model/overlay/index.js";\nimport "../colour/index.js";\n',
            ],
            ["src/worker/fixture.ts", 'import "../model/overlay/index.js";\n'],
            ["src/build/fixture.ts", 'import { join } from "node:path";\nexport const j = join;\n'],
            ["src/model/overlay/fixture.ts", 'import "./index.js";\nimport "../other.js";\n'],
        ];
        for (const [path, code] of allowed)
            expect(await layerProblems(path, code), path).toEqual([]);
    });

    it("passes the real tree", async () => {
        const results = await eslint.lintFiles(["src"]);
        const problems = results.flatMap((result) =>
            result.messages.map((message) => `${result.filePath}: ${message.message}`),
        );
        expect(problems).toEqual([]);
    }, 60_000);
});
