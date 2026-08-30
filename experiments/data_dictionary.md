# data dictionary

all csv files are utf-8 with one header row. ids are opaque strings. booleans are `0` or `1`. rates and outcomes are not rounded during analysis.

## `baseline_candidates.csv`

one row per pre-treatment baseline candidate: `policy_id`, `policy_family`, `validation_success`, `safety_event_rate`, `catastrophic_events`, `compute_complete`, `schema_match`, `eligible_for_selection`, `code_hash`, `base_data_hash`.

## `capture_manifest.json`

freezes `data_origin`, protocol/task ids, fixture geometry hash, calibration hash, reset-procedure hash, controller hash, camera-stream count, commanded-action availability, and measured signal names. observed registration fails if this manifest still says `synthetic`.

## `collection_episodes.csv`

one row per paid collection attempt, including rejected and aborted attempts: `episode_id`, `cohort_id`, `operator_id`, `session_id`, `assignment_block`, `assignment_order`, `failure_mode`, `accepted`, `duration_minutes`, `loaded_rate_per_minute`, `cost_usd`, `rights_complete`, `randomization_seed`, plus aggregate camera-free telemetry fields `joint_tracking_rmse_rad`, `peak_joint_effort_nm`, `gripper_effort_nm`, `command_samples`, and `measured_state_samples`. all rows count toward strategy cost; only accepted rows enter training.

raw hardware exports should preserve time-series commanded actions and measured state outside this summary table; the aggregate columns are analysis checks, not a replacement for MCAP/LeRobot episodes.

## `evaluation_trials.csv`

one row per policy execution: `trial_id`, `domain`, `split`, `scenario_id`, `failure_mode`, `condition_order`, `condition_seed`, `policy_id`, `cohort_id`, `training_seed`, `policy_order`, `success`, `completion_time_s`, `safety_event`, `protective_stop`, `limit_violation`, `contact_force_proxy_breach`, `catastrophic_event`, `intervention`, `excluded`, `exclusion_reason`, `replacement_scenario_id`, `policy_control_started`, `incident_timestamp_ns`, `outcome_reviewer_blinded`, `scenario_hidden_from_training`, `trial_seed`. the analyzer reconstructs the sealed condition schedule and policy order from fixed seeds. exclusions must cover a full policy block, assert that policy control never started, carry one incident timestamp and allowed pre-control infrastructure reason, identify one same-condition replacement block, and set every post-control outcome plus completion time to zero.

## required metadata

`metadata.json` declares `data_class` (`synthetic` or `observed`), task/protocol ids, generator version, seeds, and file hashes. the analyzer verifies hashes and cross-checks `data_class` against the capture manifest before reading results. synthetic directories also contain a hashed `SYNTHETIC_FIXTURE_DO_NOT_USE_AS_OBSERVED` sentinel; observed registration refuses any directory containing it. attribution rows are never accepted as input; the analyzer recomputes them from held-out real trials.
