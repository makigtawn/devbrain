import { codeToHtml } from "shiki";

export async function CodeBlock({
  code,
  language = "text",
}: {
  code: string;
  language?: string;
}) {
  const html = await codeToHtml(code, {
    lang: normalizeLang(language),
    themes: { light: "github-light", dark: "github-dark" },
  });

  return (
    <div
      className="overflow-x-auto rounded-lg border text-sm [&_pre]:p-4 [&_pre]:!bg-transparent"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const SUPPORTED = new Set([
  "javascript", "typescript", "jsx", "tsx", "python", "go", "rust", "java",
  "c", "cpp", "csharp", "php", "ruby", "swift", "kotlin", "sql", "bash",
  "shell", "json", "yaml", "html", "css", "markdown", "text",
]);

function normalizeLang(language: string) {
  const lang = language.toLowerCase().trim();
  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    sh: "bash",
    yml: "yaml",
    "c++": "cpp",
    "c#": "csharp",
  };
  const normalized = aliases[lang] ?? lang;
  return SUPPORTED.has(normalized) ? normalized : "text";
}
