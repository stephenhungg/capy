export type DemoLifecycleStep = {
  label: string;
  state: "complete" | "current" | "locked";
};

export function getPublicDemoPresentation({
  evaluationPassed,
  contributorEligible,
  payoutState,
}: {
  evaluationPassed: boolean;
  contributorEligible: boolean;
  payoutState: string;
}) {
  if (!evaluationPassed) {
    return {
      headline: "your submission needs review.",
      reviewState: "review needed",
      payoutVisible: false,
      lifecycle: [
        { label: "submitted", state: "complete" },
        { label: "integrity verified", state: "complete" },
        { label: "evaluation needs review", state: "current" },
        { label: "attribution locked", state: "locked" },
        { label: "payout locked", state: "locked" },
      ] satisfies DemoLifecycleStep[],
    } as const;
  }

  if (!contributorEligible) {
    return {
      headline: "your submission passed review.",
      reviewState: "attribution review",
      payoutVisible: false,
      lifecycle: [
        { label: "submitted", state: "complete" },
        { label: "integrity verified", state: "complete" },
        { label: "evaluation passed", state: "complete" },
        { label: "attribution needs review", state: "current" },
        { label: "payout locked", state: "locked" },
      ] satisfies DemoLifecycleStep[],
    } as const;
  }

  return {
    headline: "your submission passed review.",
    reviewState: "review complete",
    payoutVisible: true,
    lifecycle: [
      { label: "submitted", state: "complete" },
      { label: "integrity verified", state: "complete" },
      { label: "evaluation passed", state: "complete" },
      { label: "attribution calculated", state: "complete" },
      { label: `payout ${payoutState.replaceAll("_", " ")}`, state: "current" },
    ] satisfies DemoLifecycleStep[],
  } as const;
}
