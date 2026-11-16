import type { PackageCommandModule } from "../editorUi/packageCommands.js";
import { setBottomRegionVisible } from "./bottomRegion.js";

// The bottom region's toggle (SPEC §8, DESIGN §2): Tab shows or hides the region while the
// viewport itself has focus (a native key acts in `canvas` only there; elsewhere Tab moves the
// focus). An editor without a bottom region has no such command. Its id is `view.` and the
// region's id in camel case, the id each editor gave it (`view.timeline`, `view.bottomPanel`),
// so recent commands and the View menu item an editor plans for it carry over (SPEC §5). As the
// other View toggles, it is titled by what it will do.

/** The id of the command that toggles the bottom region with the id `regionId`. */
export function bottomRegionCommand(regionId: string): string {
    const words = regionId.split("-").filter((word) => word !== "");
    const camel = words
        .map((word, index) => (index === 0 ? word : word[0]!.toUpperCase() + word.slice(1)))
        .join("");
    return `view.${camel}`;
}

export const bottomRegionCommands: PackageCommandModule = ({ bottomRegion }) => {
    if (bottomRegion === null) return { commands: [] };
    const { region, editorUi } = bottomRegion;
    const visible = () => editorUi.bottomRegion.getState().visible;
    return {
        commands: [
            {
                id: bottomRegionCommand(region.id),
                title: () => `${visible() ? "Hide" : "Show"} ${region.label}`,
                shortcut: "Tab",
                context: "canvas",
                run: () => setBottomRegionVisible(editorUi, !visible()),
            },
        ],
    };
};
