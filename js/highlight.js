/** Syntax coloring for the read-only file explorer. */
import { escapeHtml } from "./format.js";

const WORDS = {
  js: "const|let|var|function|return|import|from|export|default|if|else|async|await|new|class|this",
  jsx: "const|let|function|return|import|from|export|default|if",
  ts: "import|from|export|class|const|return|this",
  java: "package|import|public|class|static|return|new",
  py: "from|import|def|return|class|if|async",
  yaml: "",
};

export function highlight(code, language = "text") {
  const lang = language === "jsx" ? "js" : language;
  let html = escapeHtml(code);
  html = html.replace(/(^|\s)(#(?![!])[^\n]*|\/\/[^\n]*)/g, '$1<span class="tok-c">$2</span>');
  html = html.replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;)/g, '<span class="tok-s">$1</span>');
  const words = WORDS[lang];
  if (words) html = html.replace(new RegExp(`\\b(${words})\\b`, "g"), '<span class="tok-k">$1</span>');
  return html;
}
