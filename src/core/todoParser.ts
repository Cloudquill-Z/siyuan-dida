export interface ParsedTodo {
  marker: "-" | "*";
  checked: boolean;
  title: string;
}

const TODO_PATTERN = /^(\s*[-*](?:\s+\{:[^}]*\})?\s*)\[([ xX])\]\s+([^\r\n]*)/;

export function parseTodoMarkdown(markdown: string): ParsedTodo | null {
  const firstLine = markdown.split(/\r?\n/, 1)[0] ?? "";
  const match = firstLine.match(TODO_PATTERN);
  if (!match) {
    return null;
  }

  return {
    marker: match[1].trim().startsWith("*") ? "*" : "-",
    checked: match[2].toLowerCase() === "x",
    title: match[3].trim()
  };
}

export function markTodoCompleted(markdown: string): string {
  return markdown.replace(TODO_PATTERN, "$1[x] $3");
}
