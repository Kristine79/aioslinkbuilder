/**
 * Help Center — in-app documentation for AI Backlink OS.
 * Left anchor navigation on desktop, horizontal scrollable chips on narrow
 * screens. Content is presentation-only and describes the actual application
 * behavior (see src/help/sections.tsx).
 */

import { useEffect } from 'react';

import { HELP_SECTIONS } from '../help/sections';

export function HelpScreen() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div>
      <div className="help-header">
        <h1 className="page-title">Справка AI Backlink OS</h1>
        <p className="page-subtitle">
          Как находить, оценивать и получать качественные backlink-размещения с помощью AI
        </p>
      </div>

      <nav className="help-nav" aria-label="Разделы справки">
        {HELP_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="help-nav-link">
            <span className="help-nav-num">{section.num}</span>
            {section.title}
          </a>
        ))}
      </nav>

      <div className="help-layout">
        <aside className="help-toc">
          <div className="help-toc-heading">Разделы</div>
          {HELP_SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="help-toc-link">
              <span className="help-toc-num">{section.num}</span>
              {section.title}
            </a>
          ))}
        </aside>

        <div className="help-sections">
          {HELP_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="card help-section">
              <div className="card-header help-section-header">
                <span className="help-num">{section.num}</span>
                <div className="card-title help-section-title">{section.title}</div>
              </div>
              <div className="card-body help-section-body">{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
