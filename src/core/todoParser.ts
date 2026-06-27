export interface ParsedTodo {
  marker: "-" | "*";
  checked: boolean;
  title: string;
}

const TODO_PATTERN = /^(\s*)([-*])\s+\[([ xX])\]\s+(.*)$/;

export function parseTodoMarkdown(markdown: string): ParsedTodo | null {
  const firstLine = markdown.split(/\r?\n/, 1)[0] ?? "";
  const match = firstLine.match(TODO_PATTERN);
  if (!match) {
    return null;
  }

  return {
    marker: match[2] as "-" | "*",
    checked: match[3].toLowerCase() === "x",
    title: match[4].trim()
  };
}

export function markTodoCompleted(markdown: string): string {
  return markdown.replace(TODO_PATTERN, "$1$2 [x] $4");
}
