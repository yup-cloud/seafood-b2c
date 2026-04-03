import { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionCard({ title, subtitle, action, children }: SectionCardProps) {
  return (
    <section className="section-card">
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
