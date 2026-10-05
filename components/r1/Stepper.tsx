import { Check } from "lucide-react";
import { Fragment } from "react";

import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * Steps: done, current, to do. On a phone only the current step keeps its
 * name on screen; screen readers hear every name and its state.
 */
export function Stepper({ steps, current, label, className }: { steps: string[]; current: number; label: string; className?: string }) {
    return (
        <ol className={cx("t-steps", className)} aria-label={label}>
            {steps.map((name, i) => {
                const state = i < current ? "done" : i === current ? "current" : "todo";
                return (
                    <Fragment key={name}>
                        <li className={cx("t-step", `is-${state}`)} aria-current={state === "current" ? "step" : undefined}>
                            <span className="t-step-dot">{state === "done" ? <Icon icon={Check} size={14} /> : i + 1}</span>
                            <span className="t-step-name">
                                {name}
                                <span className="sr-only"> ({state === "done" ? "done" : state === "current" ? "current step" : "to do"})</span>
                            </span>
                        </li>
                        {i < steps.length - 1 && <li className={cx("t-step-line", i < current && "is-done")} role="presentation" aria-hidden="true" />}
                    </Fragment>
                );
            })}
        </ol>
    );
}
