type SectionHeaderProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function SectionHeader({ id, eyebrow, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="section-header">
      {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className="section-header__title">
        {title}
      </h2>
      {subtitle ? <p className="section-header__subtitle">{subtitle}</p> : null}
    </div>
  );
}
