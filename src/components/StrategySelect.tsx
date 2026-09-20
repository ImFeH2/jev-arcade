import { ActionButton } from "@/components/ActionButton";
import type { Strategy } from "@/lib/protocol";

export function StrategySelect({
  value,
  pending,
  onChange,
}: {
  value: Strategy;
  pending: boolean;
  onChange: (strategy: Strategy) => void;
}) {
  return (
    <div className="strategy-select">
      <div className="strategy-label">
        <span>Strategy</span>
        <span role="status">{pending ? "Next piece" : ""}</span>
      </div>
      <div className="strategy-options" role="group" aria-label="Jev strategy">
        {(["metrics", "lookahead"] as const).map((strategy) => (
          <ActionButton
            key={strategy}
            variant="soft"
            aria-pressed={value === strategy}
            onClick={() => onChange(strategy)}
          >
            {strategy === "metrics" ? "Metrics" : "Lookahead"}
          </ActionButton>
        ))}
      </div>
    </div>
  );
}
