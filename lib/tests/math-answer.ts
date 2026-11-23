/**
 * Deterministic checks for the short-answer items (Q1b–Q1f): a number, or a
 * formula in one variable. Answers are plain text typed with the math keypad,
 * so they use readable tokens ("^2", "sqrt()", "*") plus whatever a person
 * might type by hand ("35x", "x(35 - x)", "−x² + 35x").
 */

/** Every number written in the text, in order ("1,250", "−16", "$45" → 45). */
export function extractNumbers(text: string): number[] {
  const normalized = String(text ?? "").replace(/[−–—]/g, "-");
  const matches =
    normalized.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d*\.\d+|-?\d+/g) ?? [];
  return matches
    .map((m) => Number(m.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
}

const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Whether the answer contains the expected value. Lenient on purpose, like the
 * pilot: the value may appear among other numbers ("at t = 6 the distance is
 * 324 cm"). The raw answer is always shown to reviewers alongside the score.
 */
export function valueMatches(answer: string, expected: number): boolean {
  return extractNumbers(answer).some((n) => close(n, expected));
}

/* ------------------------------------------------------------ formulas --- */

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

/** Hand-typed and keypad notation → one plain form the parser reads. */
function normalizeFormula(text: string): string {
  return String(text ?? "")
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([A-Za-z0-9.]+)/g, "sqrt($1)")
    .replace(/π/g, "pi")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\*\*/g, "^");
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      const v = Number(src.slice(i, j));
      if (!Number.isFinite(v)) throw new Error("bad number");
      tokens.push({ t: "num", v });
      i = j;
    } else if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z]/.test(src[j])) j += 1;
      tokens.push({ t: "id", v: src.slice(i, j).toLowerCase() });
      i = j;
    } else if ("+-*/^()".includes(c)) {
      tokens.push({ t: "op", v: c });
      i += 1;
    } else {
      throw new Error(`unexpected "${c}"`);
    }
  }
  return tokens;
}

type Fn = (x: number) => number;

/** Recursive-descent parser for one-variable formulas, with implicit products. */
function parse(tokens: Token[], variable: string): Fn {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const startsPrimary = () => {
    const tk = peek();
    return !!tk && (tk.t === "num" || tk.t === "id" || (tk.t === "op" && tk.v === "("));
  };

  // A variable name made of repeated letters ("xx") is not one we accept; a
  // letter run like "x" or a known name ("pi", "sqrt") is.
  const primary = (): Fn => {
    const tk = peek();
    if (!tk) throw new Error("unexpected end");
    if (tk.t === "num") {
      pos += 1;
      return () => tk.v;
    }
    if (tk.t === "id") {
      pos += 1;
      if (tk.v === variable) return (x) => x;
      if (tk.v === "pi") return () => Math.PI;
      if (tk.v === "sqrt") {
        if (!isOp("(")) throw new Error("sqrt needs (");
        pos += 1;
        const inner = expr();
        if (!isOp(")")) throw new Error("missing )");
        pos += 1;
        return (x) => Math.sqrt(inner(x));
      }
      throw new Error(`unknown name "${tk.v}"`);
    }
    if (tk.v === "(") {
      pos += 1;
      const inner = expr();
      if (!isOp(")")) throw new Error("missing )");
      pos += 1;
      return inner;
    }
    throw new Error(`unexpected "${tk.v}"`);
  };

  const power = (): Fn => {
    const base = primary();
    if (isOp("^")) {
      pos += 1;
      const exponent = unary(); // right-associative; allows x^-1
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  };

  // Unary minus binds looser than ^, so -x^2 is -(x^2).
  const unary = (): Fn => {
    if (isOp("-")) {
      pos += 1;
      const inner = unary();
      return (x) => -inner(x);
    }
    if (isOp("+")) {
      pos += 1;
      return unary();
    }
    return power();
  };

  const term = (): Fn => {
    let left = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = peek()!.v;
        pos += 1;
        const right = unary();
        const l = left;
        left = op === "*" ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
      } else if (startsPrimary()) {
        // Implicit product: 35x, 2(x + 1), x(35 - x).
        const right = power();
        const l = left;
        left = (x) => l(x) * right(x);
      } else {
        return left;
      }
    }
  };

  function expr(): Fn {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = peek()!.v;
      pos += 1;
      const right = term();
      const l = left;
      left = op === "+" ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }

  const fn = expr();
  if (pos !== tokens.length) throw new Error("trailing input");
  return fn;
}

/**
 * Parses a formula answer. Anything left of the last "=" is dropped, so
 * "A(x) = -x^2 + 35x" reads as "-x^2 + 35x". Returns null when it can't be read.
 */
export function parseFormula(text: string, variable = "x"): Fn | null {
  const normalized = normalizeFormula(text);
  const rhs = normalized.includes("=")
    ? normalized.slice(normalized.lastIndexOf("=") + 1)
    : normalized;
  if (!rhs.trim()) return null;
  try {
    return parse(tokenize(rhs), variable.toLowerCase());
  } catch {
    return null;
  }
}

/** Sample points where two formulas must agree to be called equivalent. */
const SAMPLES = [0.5, 1.7, 3.3, 7.1, 12.9, 24.6];

/** Whether the answer is the same formula as the expected one, in any form. */
export function formulaMatches(
  answer: string,
  expected: string,
  variable = "x"
): boolean {
  const a = parseFormula(answer, variable);
  const e = parseFormula(expected, variable);
  if (!a || !e) return false;
  return SAMPLES.every((x) => {
    const va = a(x);
    const ve = e(x);
    return Number.isFinite(va) && Number.isFinite(ve) && close(va, ve);
  });
}
