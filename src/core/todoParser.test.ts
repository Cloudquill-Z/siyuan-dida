import { describe, expect, test } from "vitest";
import { markTodoCompleted, parseTodoMarkdown } from "./todoParser";

describe("parseTodoMarkdown", () => {
  test("parses an unchecked dash todo", () => {
    expect(parseTodoMarkdown("- [ ] 整理会议纪要")).toEqual({
      marker: "-",
      checked: false,
      title: "整理会议纪要"
    });
  });

  test("parses a checked star todo case-insensitively", () => {
    expect(parseTodoMarkdown("* [X] 跟进上线")).toEqual({
      marker: "*",
      checked: true,
      title: "跟进上线"
    });
  });

  test("returns null for non todo markdown", () => {
    expect(parseTodoMarkdown("普通段落")).toBeNull();
  });

  test("parses the first line of a multiline todo block", () => {
    expect(parseTodoMarkdown("- [ ] 每日消保工单处理\n\n  - [ ] 上午")).toEqual({
      marker: "-",
      checked: false,
      title: "每日消保工单处理"
    });
  });

  test("parses SiYuan kramdown todos with inline attrs before checkbox", () => {
    expect(parseTodoMarkdown('- {: custom-status="todo" id="20260623224013-tx3inum"}[ ] 思源笔记插件')).toEqual({
      marker: "-",
      checked: false,
      title: "思源笔记插件"
    });
  });
});

describe("markTodoCompleted", () => {
  test("rewrites an unchecked todo as completed", () => {
    expect(markTodoCompleted("- [ ] 整理会议纪要")).toBe("- [x] 整理会议纪要");
  });

  test("rewrites SiYuan kramdown todos with inline attrs before checkbox", () => {
    expect(markTodoCompleted('- {: custom-status="todo" id="20260623224013-tx3inum"}[ ] 思源笔记插件')).toBe(
      '- {: custom-status="todo" id="20260623224013-tx3inum"}[x] 思源笔记插件'
    );
  });

  test("keeps non todo markdown unchanged", () => {
    expect(markTodoCompleted("普通段落")).toBe("普通段落");
  });
});
