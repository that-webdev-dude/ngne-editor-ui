import { Button } from "@ngne/editor-ui/primitives";
import { useState } from "react";

// The demo editor's bottom region slot (SPEC §8): a row of frames, as the sprite editor's
// timeline holds, and Fail to render, which makes the region's content throw while rendering,
// so the region's error boundary shows its message and Reload while the rest of the editor
// stays usable (DESIGN §5).

const FRAMES = [1, 2, 3, 4] as const;

/** Content that throws while it renders. */
function Failing(): never {
    throw new Error("The demo's bottom region failed to render, as asked.");
}

export function DemoBottom() {
    const [failing, setFailing] = useState(false);
    return (
        <div className="demo-bottom">
            <ol className="demo-bottom__frames" aria-label="Frames">
                {FRAMES.map((frame) => (
                    <li key={frame}>
                        <Button>{`Frame ${frame}`}</Button>
                    </li>
                ))}
            </ol>
            <Button onClick={() => setFailing(true)}>Fail to render</Button>
            {failing ? <Failing /> : null}
        </div>
    );
}
