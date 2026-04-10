import { memo } from 'react';

function DisclosurePanel({ title, description, defaultOpen = false, children, className = '', actions = null }) {
  return (
    <details className={`compact-disclosure disclosure-panel ${className}`.trim()} open={defaultOpen}>
      <summary className="disclosure-summary">
        <div className="disclosure-copy">
          <strong className="disclosure-title">{title}</strong>
          {description ? <span className="muted-text">{description}</span> : null}
        </div>
        {actions ? <div className="disclosure-actions">{actions}</div> : null}
      </summary>
      <div className="compact-disclosure-content">{children}</div>
    </details>
  );
}

export default memo(DisclosurePanel);
