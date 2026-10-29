// Mise en forme simple des pages éditées dans l'Admin, sans HTML :
//   # Titre        -> grand intertitre
//   ## Sous-titre  -> petit intertitre
//   - élément      -> liste à puces
//   **gras**       -> texte en gras
//   ligne vide     -> nouveau paragraphe

function inline(text, key) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4
      ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>
      : <span key={`${key}-${i}`}>{p}</span>
  );
}

export default function RichText({ text = "" }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [];
  let list = [];

  const flushPara = () => {
    if (!para.length) return;
    const k = out.length;
    out.push(<p key={`p${k}`}>{para.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l, `${k}-${i}`)}</span>)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const k = out.length;
    out.push(<ul key={`u${k}`}>{list.map((l, i) => <li key={i}>{inline(l, `${k}-${i}`)}</li>)}</ul>);
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (line.startsWith("## ")) { flushPara(); flushList(); out.push(<h3 key={`h${out.length}`}>{line.slice(3)}</h3>); continue; }
    if (line.startsWith("# ")) { flushPara(); flushList(); out.push(<h2 key={`h${out.length}`}>{line.slice(2)}</h2>); continue; }
    if (/^[-*] /.test(line.trim())) { flushPara(); list.push(line.trim().slice(2)); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return <div className="rich">{out}</div>;
}
