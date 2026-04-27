import type { ReactNode } from "react";

type PageIntroProps = {
  id?: string;
  label: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * One primary heading block per page: section label, page title, optional subtitle.
 */
export function PageIntro({ id, label, title, subtitle, children, className = "" }: PageIntroProps) {
  return (
    <div className={`page-intro ${className}`.trim()}>
      <p className="page-intro__label">{label}</p>
      <h1 id={id} className="page-intro__title">
        {title}
      </h1>
      {subtitle ? <p className="page-intro__subtitle">{subtitle}</p> : null}
      {children}
    </div>
  );
}
