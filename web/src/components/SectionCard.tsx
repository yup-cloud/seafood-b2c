import { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  id?: string;
  className?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionCard({ id, className, title, subtitle, action, children }: SectionCardProps) {
  return (
    <section id={id} className={`section-card${className ? ` ${className}` : ""}`}>
      <div className="section-card-head">
        <div>
          <h3 className="section-card-title">{title}</h3>
          {subtitle ? <p className="section-card-subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
