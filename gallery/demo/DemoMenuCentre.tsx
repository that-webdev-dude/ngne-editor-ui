// The demo editor's `menuCentre` slot (SPEC §8): what an editor shows between its menus and the
// command palette trigger, the tab strip; the demo shows its document's name.

export function DemoMenuCentre() {
    return (
        <span className="demo-menu-centre" data-demo-menu-centre="">
            Untitled document
        </span>
    );
}
