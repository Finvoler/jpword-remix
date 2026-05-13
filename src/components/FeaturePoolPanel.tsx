import { featurePool } from "../data/featurePool";

export function FeaturePoolPanel() {
  return (
    <section className="feature-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">功能池</p>
          <h2>已实现接口与枚举号</h2>
        </div>
      </div>

      <div className="feature-grid">
        {featurePool.map((feature) => (
          <article className="feature-card" key={feature.id}>
            <div className="feature-card__meta">
              <span>#{feature.id}</span>
              <span>{feature.status}</span>
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <code>{feature.interfaceName}</code>
          </article>
        ))}
      </div>
    </section>
  );
}
