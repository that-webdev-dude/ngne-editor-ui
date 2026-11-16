import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Every exported React component under src/ui declares its props `Readonly` (BRIEF D14, the
// tilemap editor's fix): the first parameter of an exported component, a function whose name
// starts with a capital, is typed `Readonly<…>`. A component that takes no props passes.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The `.tsx` modules under src/ui, relative to the repository, "/"-separated. */
function componentModules(): string[] {
    return readdirSync(join(ROOT, "src", "ui"), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

const isExported = (node: ts.Node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

const isComponentName = (name: string) => /^[A-Z]/.test(name);

/** The function a `const` component is: an arrow or function expression, or one wrapped in a call (`memo`). */
function functionOf(initializer: ts.Expression | undefined): ts.SignatureDeclaration | null {
    if (!initializer) return null;
    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return initializer;
    if (ts.isCallExpression(initializer)) {
        for (const argument of initializer.arguments) {
            const inner = functionOf(argument);
            if (inner) return inner;
        }
    }
    return null;
}

/** Whether the props parameter is typed `Readonly<…>`; true when there is none. */
function readonlyProps(fn: ts.SignatureDeclaration): boolean {
    const props = fn.parameters[0];
    if (!props) return true;
    const type = props.type;
    return (
        !!type &&
        ts.isTypeReferenceNode(type) &&
        ts.isIdentifier(type.typeName) &&
        type.typeName.text === "Readonly"
    );
}

/** The exported components of a module whose props are not `Readonly`, as "file: Name". */
function mutableProps(file: string, text: string): string[] {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: string[] = [];
    for (const statement of source.statements) {
        if (!isExported(statement)) continue;
        if (ts.isFunctionDeclaration(statement) && statement.name) {
            const name = statement.name.text;
            if (isComponentName(name) && !readonlyProps(statement)) found.push(`${file}: ${name}`);
        } else if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name)) continue;
                const name = declaration.name.text;
                const fn = functionOf(declaration.initializer);
                if (fn && isComponentName(name) && !readonlyProps(fn)) {
                    found.push(`${file}: ${name}`);
                }
            }
        }
    }
    return found;
}

describe("Readonly props", () => {
    const modules = componentModules();

    it("finds the components under src/ui", () => {
        expect(modules).toEqual(
            expect.arrayContaining([
                "src/ui/gallery/Gallery.tsx",
                "src/ui/primitives/Button.tsx",
                "src/ui/primitives/Splitter.tsx",
            ]),
        );
    });

    it("are declared by every exported component under src/ui", () => {
        const found = modules.flatMap((file) =>
            mutableProps(file, readFileSync(join(ROOT, file), "utf8")),
        );
        expect(found).toEqual([]);
    });

    it("fail a fixture component with mutable props", () => {
        const text = [
            'import type { ReactNode } from "react";',
            "interface Props { label: string }",
            "export function Mutable({ label }: Props) { return <b>{label}</b>; }",
            "export function Inline(props: { label: string }) { return <b>{props.label}</b>; }",
            "export const Arrow = ({ label }: Props) => <b>{label}</b>;",
            "export const Memo = memo(function Memo({ label }: Props) { return <b>{label}</b>; });",
            "export function Untyped(props) { return <b>{props.label}</b>; }",
            "export function Good({ label }: Readonly<Props>) { return <b>{label}</b>; }",
            "export const GoodArrow = ({ label }: Readonly<Props>) => <b>{label}</b>;",
            "export function NoProps() { return <b />; }",
            "export function helper(props: Props) { return props.label; }",
            "function Local({ label }: Props) { return <b>{label}</b>; }",
            "export const Slot = ({ children }: { children: ReactNode }) => <>{children}</>;",
        ].join("\n");
        expect(mutableProps("fixture.tsx", text)).toEqual([
            "fixture.tsx: Mutable",
            "fixture.tsx: Inline",
            "fixture.tsx: Arrow",
            "fixture.tsx: Memo",
            "fixture.tsx: Untyped",
            "fixture.tsx: Slot",
        ]);
    });
});
