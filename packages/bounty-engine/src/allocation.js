export function allocateProRata(total, entries) {
  if (total < 0n) throw new RangeError("allocation total cannot be negative");
  const normalized = entries
    .map((entry) => ({ id: entry.id, weight: BigInt(entry.weight) }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (normalized.some((entry) => entry.weight < 0n)) {
    throw new RangeError("allocation weights cannot be negative");
  }
  const totalWeight = normalized.reduce((sum, entry) => sum + entry.weight, 0n);
  if (total === 0n || totalWeight === 0n) {
    return new Map(normalized.map((entry) => [entry.id, 0n]));
  }

  let distributed = 0n;
  const allocations = normalized.map((entry) => {
    const numerator = total * entry.weight;
    const amount = numerator / totalWeight;
    distributed += amount;
    return { ...entry, amount, remainder: numerator % totalWeight };
  });

  let remainder = total - distributed;
  allocations.sort(
    (left, right) =>
      (left.remainder > right.remainder ? -1 : left.remainder < right.remainder ? 1 : 0) ||
      left.id.localeCompare(right.id),
  );
  for (let index = 0; remainder > 0n; index += 1, remainder -= 1n) {
    allocations[index].amount += 1n;
  }

  return new Map(allocations.map((entry) => [entry.id, entry.amount]));
}
