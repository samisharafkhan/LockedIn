export type SegmentedTabItem = {
  id: string;
  label: string;
};

type SegmentedTabsProps = {
  items: SegmentedTabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
};

/**
 * Rounded tab control for in-page sub-navigation (e.g. Social: Stories / Posts / Overlap).
 */
export function SegmentedTabs({ items, value, onChange, ariaLabel }: SegmentedTabsProps) {
  return (
    <div className="segmented-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const on = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="segmented-tabs__tab"
            aria-selected={on}
            data-on={on ? "1" : undefined}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
