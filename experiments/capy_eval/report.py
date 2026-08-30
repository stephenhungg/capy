from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def _number(value: float) -> str:
    return f"{value:.3f}"


def render_markdown(result: dict[str, Any]) -> str:
    primary = result["primary_endpoint"]
    sim = result["simulation_to_real"]
    attribution = result["attribution"]
    collection = result["collection"]
    lines = [
        "# capy experiment report",
        "",
        "| field | value |",
        "|---|---|",
        f"| protocol | `{result['protocol_id']}` |",
        f"| task | `{result['task_id']}` |",
        f"| data class | `{result['data_class']}` |",
        f"| decision | `{result['overall_decision']}` |",
        f"| first-task signal | `{result['first_task_signal']}` |",
        "",
    ]
    if result["data_class"] == "synthetic":
        lines.extend(
            [
                "> warning: every number below is synthetic pipeline-fixture output. it is not hardware evidence and must not be quoted as capy performance.",
                "",
            ]
        )
    lines.extend(
        [
            "## primary endpoint",
            "",
            "| metric | estimate | stratified paired-bootstrap 95% interval |",
            "|---|---:|---:|",
            f"| random absolute gain over baseline | {_pct(primary['random_absolute_gain'])} | {_pct(primary['random_gain_95'][0])} to {_pct(primary['random_gain_95'][1])} |",
            f"| targeted absolute gain over baseline | {_pct(primary['targeted_absolute_gain'])} | {_pct(primary['targeted_gain_95'][0])} to {_pct(primary['targeted_gain_95'][1])} |",
            f"| targeted/random gain per dollar | {_number(primary['targeted_to_random_gain_per_dollar_ratio'])}x | not reported; bootstrap denominator crosses or approaches zero |",
            f"| gain/$1k contrast above the 1.25x gate | {_pct(primary['gain_per_dollar_threshold_contrast'] * 1000)} | {_pct(primary['gain_per_dollar_threshold_contrast_95'][0] * 1000)} to {_pct(primary['gain_per_dollar_threshold_contrast_95'][1] * 1000)} |",
            "",
            f"baseline held-out real success was {_pct(primary['baseline_success_rate'])}. both cohorts cost ${collection['cohorts']['random']['cost_usd']:.2f}; measured cost imbalance was {_pct(collection['cost_imbalance_fraction'])}.",
            f"each cohort includes {collection['cohorts']['random']['attempted_episodes']} paid attempts: {collection['cohorts']['random']['accepted_episodes']} accepted and {collection['cohorts']['random']['rejected_or_aborted_episodes']} rejected or aborted. all attempt cost is in the denominator.",
            "",
            "the inherited `1.25x` threshold is a proposed management gate, not a sourced scientific constant. its full criterion requires three tasks, so this one-task result remains `not_evaluated` even when the first-task signal passes.",
            "",
            "## prospective power and held-out real trials",
            "",
            f"the configured equal-cost gain-contrast approximation requires {result['power_analysis']['required_trials_per_policy']} trials per policy for the registered assumptions. this fixture has {result['power_analysis']['actual_real_trials_per_policy']} randomized, hidden real-domain trials per policy across {result['held_out_real']['scenario_blocks']} paired scenario blocks. this aligns the planning contrast with the 1.25x gate, but final power must be updated with hardware block correlation.",
            "",
            "| policy | cohort | seed | successes/trials | success rate |",
            "|---|---|---:|---:|---:|",
        ]
    )
    for policy_id, policy in result["held_out_real"]["policy_results"].items():
        lines.append(
            f"| `{policy_id}` | {policy['cohort_id']} | {policy['training_seed']} | {policy['successes']}/{policy['trials']} | {_pct(policy['success_rate'])} |"
        )
    lines.extend(
        [
            "",
            "## simulation-to-real ranking",
            "",
            f"spearman rank correlation across {sim['policy_count']} policies is `{sim['spearman_policy_rank']:.3f}` with a trial-bootstrap interval of `{sim['spearman_policy_rank_95'][0]:.3f}` to `{sim['spearman_policy_rank_95'][1]:.3f}`. the proposed settlement gate is `0.600`; seven related policies can be dominated by between-cohort separation, and passing the synthetic fixture does not validate a simulator.",
            "",
            "## safety regressions",
            "",
            "| cohort | risk difference vs baseline | paired-bootstrap 95% interval | catastrophic events | guardrail |",
            "|---|---:|---:|---:|---|",
        ]
    )
    for cohort, safety in result["safety"].items():
        lines.append(
            f"| {cohort} | {_pct(safety['risk_difference_vs_baseline'])} | {_pct(safety['risk_difference_95'][0])} to {_pct(safety['risk_difference_95'][1])} | {safety['catastrophic_event_count']} | {'pass' if safety['passes_guardrail'] else 'fail'} |"
        )
    lines.extend(
        [
            "",
            "| cohort | component | baseline rate | candidate rate |",
            "|---|---|---:|---:|",
        ]
    )
    for cohort, safety in result["safety"].items():
        for component, rates in safety["component_event_rates"].items():
            lines.append(
                f"| {cohort} | {component} | {_pct(rates['baseline'])} | {_pct(rates['candidate'])} |"
            )
    lines.extend(
        [
            "",
            "the `2 percentage point` upper risk-difference margin and zero-catastrophe rule are proposed management thresholds.",
            "",
            "## bootstrap attribution stability",
            "",
            f"consensus ordering is `{' > '.join(attribution['consensus_order'])}`. ordering stability across {attribution['replicates']} training-seed/bootstrap replicates is `{attribution['bootstrap_consensus_rank_stability']:.3f}` against the proposed `0.700` performance-pool gate.",
            "",
            "| cohort | mean marginal gain | 95% interval | probability ranked first |",
            "|---|---:|---:|---:|",
        ]
    )
    for cohort, summary in attribution["cohorts"].items():
        lines.append(
            f"| {cohort} | {_pct(summary['mean_marginal_gain'])} | {_pct(summary['marginal_gain_95'][0])} to {_pct(summary['marginal_gain_95'][1])} | {_pct(summary['probability_ranked_first'])} |"
        )
    lines.extend(
        [
            "",
            "this is cohort-level payout sensitivity, not exact causal credit for a person or episode.",
            "",
            "## sourced claims",
            "",
            "these narrow claims are tagged `sourced_claim`; none supplies a numeric capy gate.",
            "",
            "| id | claim | primary or official source |",
            "|---|---|---|",
        ]
    )
    for claim in result["evidence_registry"]:
        lines.append(
            f"| `{claim['id']}` | {claim['claim']} | [{claim['source_title']}]({claim['source_url']}) |"
        )
    lines.extend(
        [
            "",
            "## decision registry",
            "",
            "every numeric gate below is explicitly labeled `proposed_management_threshold`.",
            "",
            "| id | threshold | scope | status | action on failure |",
            "|---|---:|---|---|---|",
        ]
    )
    for decision in result["decision_registry"]:
        lines.append(
            f"| `{decision['id']}` | `{decision['operator']} {decision['value']}` | {decision['scope']} | `{decision['status']}` | {decision['action_on_failure']} |"
        )
    lines.extend(
        [
            "",
            "## provenance and limitations",
            "",
            "| artifact | sha256 |",
            "|---|---|",
            f"| config | `{result['provenance']['config_sha256']}` |",
            f"| metadata | `{result['provenance']['metadata_sha256']}` |",
            "",
        ]
    )
    for limitation in result["limitations"]:
        lines.append(f"- {limitation}")
    lines.extend(
        [
            "",
            "method and hardware facts with primary/official links are maintained separately in `experiments/claims_and_thresholds.md`; no cited work is presented as the source of capy's numeric gates.",
            "",
        ]
    )
    return "\n".join(lines)


def write_reports(result: dict[str, Any], report_dir: Path) -> None:
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "example_report.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (report_dir / "example_report.md").write_text(
        render_markdown(result), encoding="utf-8"
    )
