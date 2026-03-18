// 

export function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  text: string
) {
  if (!textarea) return "";

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;

  const nextValue =
    currentValue.slice(0, start) + text + currentValue.slice(end);

  textarea.value = nextValue;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();

  return nextValue;
}

export function toInlineMath(str: string) {
  if (!str) return str;

  const parts = str.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/);

  for (let i = 0; i < parts.length; i += 2) {
    let t = parts[i];
    if (typeof t !== "string") continue;

    t = t.replace(/(\w)\^(\w+)/g, "\\($1^$2\\)");
    t = t.replace(/(\w)_(\w+)/g, "\\($1_$2\\)");
    parts[i] = t;
  }

  return parts.join("");
}