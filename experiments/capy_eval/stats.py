from __future__ import annotations

import math
from statistics import NormalDist
from typing import Iterable, Sequence


def two_proportion_sample_size(
    baseline: float,
    absolute_difference: float,
    alpha: float,
    power: float,
) -> int:
    """Normal-approximation sample size per independent group."""
    treatment = baseline + absolute_difference
    if not (0 < baseline < 1 and 0 < treatment < 1):
        raise ValueError("baseline and treatment probabilities must be inside (0, 1)")
    if not (0 < alpha < 1 and 0 < power < 1):
        raise ValueError("alpha and power must be inside (0, 1)")
    pooled = (baseline + treatment) / 2
    z_alpha = NormalDist().inv_cdf(1 - alpha / 2)
    z_power = NormalDist().inv_cdf(power)
    numerator = (
        z_alpha * math.sqrt(2 * pooled * (1 - pooled))
        + z_power
        * math.sqrt(
            baseline * (1 - baseline) + treatment * (1 - treatment)
        )
    ) ** 2
    return math.ceil(numerator / (absolute_difference**2))


def gain_ratio_contrast_sample_size(
    baseline: float,
    random_success: float,
    targeted_success: float,
    ratio_null: float,
    alpha: float,
    power: float,
) -> int:
    """Normal approximation for (pt-pb) - ratio_null * (pr-pb) > 0.

    This assumes equal cost and independent policy-level binomial proportions. It
    aligns with the registered gain-ratio gate, while remaining a planning
    approximation for the final paired/block-stratified design.
    """
    probabilities = (baseline, random_success, targeted_success)
    if not all(0 < value < 1 for value in probabilities):
        raise ValueError("success probabilities must be inside (0, 1)")
    if ratio_null <= 0 or not (0 < alpha < 1 and 0 < power < 1):
        raise ValueError("invalid ratio, alpha, or power")
    targeted_under_null = baseline + ratio_null * (random_success - baseline)
    if not 0 < targeted_under_null < 1:
        raise ValueError("null targeted probability must be inside (0, 1)")
    effect = (targeted_success - baseline) - ratio_null * (
        random_success - baseline
    )
    if effect <= 0:
        raise ValueError("alternative must exceed the null gain ratio")
    weights = (ratio_null - 1, -ratio_null, 1.0)

    def variance_component(targeted_probability: float) -> float:
        values = (baseline, random_success, targeted_probability)
        return sum(
            weight * weight * probability * (1 - probability)
            for weight, probability in zip(weights, values, strict=True)
        )

    z_alpha = NormalDist().inv_cdf(1 - alpha)
    z_power = NormalDist().inv_cdf(power)
    numerator = (
        z_alpha * math.sqrt(variance_component(targeted_under_null))
        + z_power * math.sqrt(variance_component(targeted_success))
    ) ** 2
    return math.ceil(numerator / (effect * effect))


def percentile(values: Sequence[float], probability: float) -> float:
    if not values:
        raise ValueError("cannot take percentile of an empty sequence")
    if not 0 <= probability <= 1:
        raise ValueError("probability must be inside [0, 1]")
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def interval(values: Sequence[float], confidence: float = 0.95) -> tuple[float, float]:
    tail = (1 - confidence) / 2
    return percentile(values, tail), percentile(values, 1 - tail)


def mean(values: Iterable[float]) -> float:
    items = list(values)
    if not items:
        raise ValueError("cannot take mean of an empty sequence")
    return sum(items) / len(items)


def _average_ranks(values: Sequence[float]) -> list[float]:
    ordered = sorted(enumerate(values), key=lambda item: item[1])
    ranks = [0.0] * len(values)
    cursor = 0
    while cursor < len(ordered):
        end = cursor + 1
        while end < len(ordered) and ordered[end][1] == ordered[cursor][1]:
            end += 1
        average_rank = ((cursor + 1) + end) / 2
        for index in range(cursor, end):
            ranks[ordered[index][0]] = average_rank
        cursor = end
    return ranks


def spearman(x: Sequence[float], y: Sequence[float]) -> float:
    if len(x) != len(y) or len(x) < 2:
        raise ValueError("spearman requires equal sequences with at least two values")
    x_ranks = _average_ranks(x)
    y_ranks = _average_ranks(y)
    x_mean = mean(x_ranks)
    y_mean = mean(y_ranks)
    numerator = sum(
        (left - x_mean) * (right - y_mean)
        for left, right in zip(x_ranks, y_ranks, strict=True)
    )
    x_ss = sum((value - x_mean) ** 2 for value in x_ranks)
    y_ss = sum((value - y_mean) ** 2 for value in y_ranks)
    if x_ss == 0 or y_ss == 0:
        raise ValueError("spearman is undefined for a constant sequence")
    return numerator / math.sqrt(x_ss * y_ss)


def wilson_interval(successes: int, total: int, confidence: float = 0.95) -> tuple[float, float]:
    if total <= 0 or not 0 <= successes <= total:
        raise ValueError("invalid binomial counts")
    z = NormalDist().inv_cdf(1 - (1 - confidence) / 2)
    rate = successes / total
    denominator = 1 + z * z / total
    centre = (rate + z * z / (2 * total)) / denominator
    radius = (
        z
        * math.sqrt(rate * (1 - rate) / total + z * z / (4 * total * total))
        / denominator
    )
    return max(0.0, centre - radius), min(1.0, centre + radius)
