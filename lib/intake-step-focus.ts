export const INTAKE_STEP_HEADING_ID = "intake-step-heading";

/** Smooth scroll, unless the user asked for reduced motion. */
export function intakeStepScrollBehavior(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? "auto" : "smooth";
}

/**
 * Put the progress bar and the step heading at the top of the viewport,
 * then move focus to the heading without scrolling it away from the bar.
 */
export function scrollIntakeStepIntoView(options: {
  reducedMotion: boolean;
  scrollTo?: (opts: ScrollToOptions) => void;
  heading?: { focus: (opts?: FocusOptions) => void } | null;
}): void {
  const scrollTo = options.scrollTo ?? ((opts: ScrollToOptions) => window.scrollTo(opts));
  scrollTo({
    top: 0,
    left: 0,
    behavior: intakeStepScrollBehavior(options.reducedMotion),
  });
  options.heading?.focus({ preventScroll: true });
}
