import { Menubar } from "radix-ui";
import type { ReactNode } from "react";
import { CommandPaletteTrigger } from "../commands/CommandPaletteTrigger.js";
import { useEditorUi } from "../editorUi/context.js";
import { MenubarItems } from "./MenubarItems.js";

export interface MenuBarProps {
    /** The `menuCentre` slot of `AppShell`: the tab strip, or nothing. */
    centre?: ReactNode;
}

/**
 * The menu bar's content (SPEC §8, DESIGN §2, §4): the menus of the configuration in its order,
 * each generated from the instance's command registry (Radix Menubar), then the centre slot,
 * then the command palette trigger at the right. The dialogs the menus open are shown by the
 * dialog host and the surface host.
 */
export function MenuBar({ centre }: Readonly<MenuBarProps>) {
    const { menus } = useEditorUi().config;
    return (
        <>
            <Menubar.Root className="menubar" aria-label="Main menu" loop>
                {menus.map((menu) => (
                    <Menubar.Menu key={menu} value={menu}>
                        <Menubar.Trigger className="menubar__trigger">{menu}</Menubar.Trigger>
                        <Menubar.Portal>
                            <Menubar.Content
                                className="ui-menu"
                                align="start"
                                sideOffset={6}
                                collisionPadding={8}
                            >
                                <MenubarItems menu={menu} />
                            </Menubar.Content>
                        </Menubar.Portal>
                    </Menubar.Menu>
                ))}
            </Menubar.Root>
            <div className="shell-menubar__centre">{centre}</div>
            <CommandPaletteTrigger />
        </>
    );
}
