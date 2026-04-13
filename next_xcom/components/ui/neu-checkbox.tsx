"use client";

export type NeuCheckboxProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * App-standard neumorphic checkbox (green when checked), same interaction model as XPoster entry cards.
 */
export function NeuCheckbox({
  checked,
  onCheckedChange,
  disabled,
  id,
  className = "",
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: NeuCheckboxProps) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      title={title ?? (checked ? "Deselect" : "Select")}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={`neu-checkbox${checked ? " checked" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked);
      }}
    >
      <span className="neu-checkbox-inner">
        {checked ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}
