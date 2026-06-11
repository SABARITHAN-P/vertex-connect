import { useState, useMemo } from "react";
import { marked } from "marked";
import { Check, Copy } from "lucide-react";
import { useTheme } from "@context/ThemeContext";

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
});

/* =========================================================
   CUSTOM CODE CARD COMPONENT
========================================================= */
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const displayLang = language ? language.toLowerCase() : "code";

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-app-border bg-[#0d1117] shadow-lg text-sm text-[#e6edf3]">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#21262d] select-none text-xs font-mono text-gray-400">
        <span className="capitalize">{displayLang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          title="Copy to Clipboard"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* CODE BODY */}
      <div className="overflow-x-auto p-4 font-mono leading-relaxed text-[13px] whitespace-pre">
        <code>{code.trim()}</code>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN MARKDOWN RENDERER
========================================================= */
export default function MarkdownRenderer({ content }) {
  const { theme } = useTheme();
  const renderedContent = useMemo(() => {
    if (!content) return null;

    // Regular expression to identify code blocks: ```lang\ncode\n```
    const parts = content.split(/(\`\`\`[a-zA-Z0-9#\-\+]*\n[\s\S]*?\n\`\`\`)/g);

    return parts.map((part, index) => {
      // Check if this part is a code block
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        // Extract language from first line (e.g. ```javascript -> javascript)
        const language = lines[0].replace("```", "").trim();
        // Extract code content by removing first and last line
        const codeContent = lines.slice(1, -1).join("\n");

        return <CodeBlock key={index} language={language} code={codeContent} />;
      } else {
        // Render regular markdown with marked
        try {
          const html = marked.parse(part);
          return (
            <div
              key={index}
              className={`prose ${theme === "dark" ? "prose-invert" : ""} max-w-none text-sm leading-relaxed text-app-text-primary space-y-2
                prose-headings:font-bold prose-headings:text-app-text-primary prose-headings:mt-3 prose-headings:mb-1
                prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                prose-p:mb-2
                prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-2
                prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-2
                prose-li:mb-1
                prose-a:text-emerald-400 prose-a:underline hover:prose-a:text-emerald-300
                prose-table:border-collapse prose-table:w-full prose-table:my-3
                prose-th:border prose-th:border-app-border prose-th:px-3 prose-th:py-2 prose-th:bg-app-hover prose-th:font-semibold prose-th:text-left
                prose-td:border prose-td:border-app-border prose-td:px-3 prose-td:py-2
                prose-code:bg-app-hover prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-emerald-400 prose-code:before:content-none prose-code:after:content-none`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (err) {
          console.error("Markdown parse error", err);
          return <span key={index}>{part}</span>;
        }
      }
    });
  }, [content]);

  return <div className="markdown-body space-y-2">{renderedContent}</div>;
}
