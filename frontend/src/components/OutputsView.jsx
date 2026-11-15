import React from "react";

export default function OutputsView({ outputs }) {
  const groups = [];
  outputs.forEach((o) => {
    let g = groups.find((x) => x.name === o.group);
    if (!g) groups.push((g = { name: o.group, items: [] }));
    g.items.push(o);
  });
  const images = outputs.filter((o) => o.name.endsWith(".png"));
  return (
    <section className="panel">
      <h2>Outputs written by this run</h2>
      <p className="lead">
        The required outputs come from the notebook's <code>run_pipeline</code>; the AI project writes to its own folder
        and leaves them untouched.
      </p>
      <div className="outgrid">
        {groups.map((g) => (
          <div key={g.name} className="outgroup">
            <h3>{g.name}</h3>
            <ul>
              {g.items.map((o) => (
                <li key={o.url}>
                  <a href={o.url} download={o.name}>
                    {o.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="gallery">
        {images.map((o) => (
          <figure key={o.url}>
            <img src={o.url} alt={o.name} loading="lazy" />
            <figcaption>{o.name}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
