import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Every exported React component under src/ui declares its props `Readonly` (BRIEF D14, the
// tilemap editor's fix), and so does every one of the gallery site (gallery/), whose entries
// are passed to the gallery as an app's are (SPEC §12): the first parameter of an exported
// component, a function whose name starts with a capital, is typed `Readonly<…>`, and so is the
// props type an exported class component gives `Component`. A component that takes no props
// passes.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The `.tsx` modules under `dir`, relative to the repository, "/"-separated. */
function tsxModules(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
        .filter((file) => !file.includes("/dist/"));
}

/** The `.tsx` modules under src/ui and of the gallery site. */
function componentModules(): string[] {
    return [...tsxModules(join("src", "ui")), ...tsxModules("gallery")];
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

/** Whether `type` is written `Readonly<…>`. */
const isReadonlyType = (type: ts.TypeNode | undefined) =>
    !!type &&
    ts.isTypeReferenceNode(type) &&
    ts.isIdentifier(type.typeName) &&
    type.typeName.text === "Readonly";

/** Whether the props parameter is typed `Readonly<…>`; true when there is none. */
function readonlyProps(fn: ts.SignatureDeclaration): boolean {
    const props = fn.parameters[0];
    return !props || isReadonlyType(props.type);
}

/**
 * The props type a class component declares: the first type argument of the `Component` or
 * `PureComponent` it extends (bare or `React.`), or null for another class. A class component
 * that gives no props type has `undefined` here.
 */
function classProps(node: ts.ClassDeclaration): ts.TypeNode | undefined | null {
    for (const clause of node.heritageClauses ?? []) {
        if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
        for (const base of clause.types) {
            const name = ts.isPropertyAccessExpression(base.expression)
                ? base.expression.name.text
                : base.expression.getText();
            if (name === "Component" || name === "PureComponent") return base.typeArguments?.[0];
        }
    }
    return null;
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
        } else if (ts.isClassDeclaration(statement) && statement.name) {
            const props = classProps(statement);
            if (props !== null && props !== undefined && !isReadonlyType(props)) {
                found.push(`${file}: ${statement.name.text}`);
            }
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

    it("finds the components under src/ui and of the gallery site", () => {
        expect(modules).toEqual(
            expect.arrayContaining([
                "gallery/DemoEditorEntry.tsx",
                "gallery/demo/DemoMenuCentre.tsx",
                "gallery/main.tsx",
                "src/ui/commands/Chord.tsx",
                "src/ui/gallery/Gallery.tsx",
                "src/ui/gallery/entries/LicencesEntry.tsx",
                "src/ui/gallery/entries/ShellEntry.tsx",
                "src/ui/messages/DialogHost.tsx",
                "src/ui/messages/RegionBoundary.tsx",
                "src/ui/primitives/Button.tsx",
                "src/ui/primitives/Splitter.tsx",
            ]),
        );
    });

    it("are declared by every exported component under src/ui and of the gallery site", () => {
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
            "export class Boundary extends Component<Props, State> {}",
            "export class Pure extends React.PureComponent<{ label: string }> {}",
            "export class GoodBoundary extends Component<Readonly<Props>, State> {}",
            "export class NoPropsBoundary extends Component {}",
            "export class Store extends Map<string, Props> {}",
            "class LocalBoundary extends Component<Props> {}",
        ].join("\n");
        expect(mutableProps("fixture.tsx", text)).toEqual([
            "fixture.tsx: Mutable",
            "fixture.tsx: Inline",
            "fixture.tsx: Arrow",
            "fixture.tsx: Memo",
            "fixture.tsx: Untyped",
            "fixture.tsx: Slot",
            "fixture.tsx: Boundary",
            "fixture.tsx: Pure",
        ]);
    });
});
