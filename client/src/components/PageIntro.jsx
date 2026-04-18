import { memo } from 'react';

function PageIntro({ eyebrow, title, description, actions, meta, className = '' }) {
  const hasAside = Boolean(meta || actions);

  return (
    <section className={`page-intro-shell ${className}`.trim()}>
      <div className={`page-intro card surface-primary ${hasAside ? 'page-intro--has-aside' : ''}`.trim()}>
        <div className="page-intro-lead">
          {eyebrow ? <p className="eyebrow-label">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="page-intro-description">{description}</p> : null}
        </div>
        {hasAside ? (
          <div className="page-intro-aside">
            {meta ? <div className="page-intro-aside-block">{meta}</div> : null}
            {actions ? <div className="page-intro-aside-block page-intro-actions">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default memo(PageIntro);
