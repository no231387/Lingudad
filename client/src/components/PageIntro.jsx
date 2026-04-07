function PageIntro({ eyebrow, title, description, actions, meta, className = '' }) {
  return (
    <section className={`page-intro card ${className}`.trim()}>
      <div className="page-intro-copy">
        {eyebrow ? <p className="eyebrow-label">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p className="page-intro-description">{description}</p> : null}
        {meta ? <div className="page-intro-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="page-intro-actions">{actions}</div> : null}
    </section>
  );
}

export default PageIntro;
