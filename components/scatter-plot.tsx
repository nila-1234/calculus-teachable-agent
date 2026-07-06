"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ScatterPoint = Record<string, number>;

type ScatterPlotFile = {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  data: ScatterPoint[];
};

type ScatterPlotProps = {
  filePath: string;
  equation?: string;
  showZeroLine?: boolean;
};

type LoadedPlot = {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  data: ScatterPoint[];
  xKey: string;
  yKey: string;
};

type ChartPoint = Record<string, number | null>;

// function normalizeEquation(equation: string) {
//   return equation
//     .trim()
//     .replace(/\s+/g, "")
//     .replace(/^[a-z]\([xt]\)=/i, "")
//     .replace(/^[a-z]=/i, "")
//     .replace(/\^/g, "**")
//     .replace(/(\d)([xt])/gi, "$1*$2")
//     .replace(/(\d)(sin\()/gi, "$1*$2")
//     .replace(/(\d)(exp\()/gi, "$1*$2")
//     .replace(/(\))([xt\d])/gi, "$1*$2")
//     .replace(/([xt])(\d)/gi, "$1*$2");
// }

function normalizeEquation(equation: string) {
  return equation
    .trim()
    .replace(/\\\(|\\\)/g, "")

    // \frac{a}{b}
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "(($1)/($2))")

    // e^{0.3x}
    .replace(/e\^\{([^{}]+)\}/g, "exp($1)")

    // absolute value |x|
    .replace(/\|([^|]+)\|/g, "abs($1)")

    // remove remaining latex braces
    .replace(/\{([^{}]+)\}/g, "$1")

    .replace(/\s+/g, "")

    // remove function name
    .replace(/^[a-z]\([xt]\)=/i, "")
    .replace(/^[a-z]=/i, "")

    // \sin, \cos → sin, cos
    .replace(/\\(sin|cos)/g, "$1")

    // x^2 → x**2
    .replace(/\^/g, "**")

    // implicit multiplication
    .replace(/(\d|\))(\()/g, "$1*$2")
    .replace(/(\d)([xt])/gi, "$1*$2")
    .replace(/([xt])\(/gi, "$1*(")
    .replace(/(\))([xt\d])/gi, "$1*$2")
    .replace(/(\d)(exp\()/gi, "$1*$2")
    .replace(/(\d)(abs\()/gi, "$1*$2")
    .replace(/(\d)((sin|cos)\()/gi, "$1*$2")

    // disambiguate unary minus before exponentiation: -x**2 → -(x**2)
    .replace(/(^|[-+*/(,])-([xt])(\*\*\d+)/gi, "$1-($2$3)");
}

function buildEquationEvaluator(equation: string) {
  const normalized = normalizeEquation(equation);

  if (!normalized) return null;

  const isSafe = /^[0-9xtXT+\-*/().,a-zA-Z*]+$/.test(normalized);
  if (!isSafe) {
    const offenders = normalized.match(/[^0-9xtXT+\-*/().,a-zA-Z*]/g);
    throw new Error(`Equation contains unsupported characters: ${offenders?.join(" ")}`);
  }

  const allowedFunctions = ["sin", "cos", "exp", "abs"];
  const identifiers = normalized.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];

  const invalidIdentifiers = identifiers.filter(
    (name) =>
      name !== "x" &&
      name !== "X" &&
      name !== "t" &&
      name !== "T" &&
      !allowedFunctions.includes(name)
  );

  if (invalidIdentifiers.length > 0) {
    throw new Error(`Equation contains unsupported functions or variables: ${invalidIdentifiers.join(", ")}`);
  }

  try {
    const jsExpression = normalized
      .replace(/\bsin\(/g, "Math.sin(")
      .replace(/\bcos\(/g, "Math.cos(")
      .replace(/\bexp\(/g, "Math.exp(")
      .replace(/\babs\(/g, "Math.abs(");

    const fn = new Function("x", "t", `return ${jsExpression};`) as (
      x: number,
      t: number
    ) => number;

    return (val: number) => {
      try {
        const y = fn(val, val);
        if (typeof y !== "number" || Number.isNaN(y) || !Number.isFinite(y)) {
          return null;
        }
        return y;
      } catch {
        return null;
      }
    };
  } catch {
    throw new Error("Invalid equation format.");
  }
}

function buildCombinedData(
  data: ScatterPoint[],
  xKey: string,
  yKey: string,
  equation: string
): ChartPoint[] {
  const xValues = data
    .map((point) => point[xKey])
    .filter(
      (value): value is number =>
        typeof value === "number" && !Number.isNaN(value)
    );

  if (xValues.length === 0) return [];

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);

  const scatterMap = new Map<number, number>();
  for (const point of data) {
    const x = point[xKey];
    const y = point[yKey];
    if (typeof x === "number" && typeof y === "number") {
      scatterMap.set(x, y);
    }
  }

  const evaluator = equation.trim() ? buildEquationEvaluator(equation) : null;

  // const combined: ChartPoint[] = xValues
  //   .sort((a, b) => a - b)
  //   .map((x) => ({
  //     [xKey]: x,
  //     scatterY: scatterMap.has(x) ? (scatterMap.get(x) ?? null) : null,
  //     equationY: evaluator ? evaluator(x) : null,
  //   }));

  const yValues = data
    .map((point) => point[yKey])
    .filter(
      (value): value is number =>
        typeof value === "number" && !Number.isNaN(value)
    );
  const maxAbsY = yValues.length > 0 ? Math.max(...yValues.map(Math.abs)) : 150;
  const MAX_Y = Math.max(maxAbsY * 2, 150);

  const step = (maxX - minX) / 200;

  const sampledX = Array.from(
    { length: 201 },
    (_, i) => minX + i * step
  );

  const allXValues = Array.from(new Set([...sampledX, ...xValues])).sort(
    (a, b) => a - b
  );

  const combined: ChartPoint[] = allXValues.map((x) => {
    const y = evaluator ? evaluator(x) : null;

    return {
      [xKey]: x,
      scatterY: scatterMap.has(x) ? scatterMap.get(x) ?? null : null,
      equationY:
        y === null || !Number.isFinite(y) || Math.abs(y) > MAX_Y ? null : y,
    };
  });

  return combined;
}

export default function ScatterPlot({
  filePath,
  equation = "",
  showZeroLine = true,
}: ScatterPlotProps) {
  const [plot, setPlot] = useState<LoadedPlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPlot = async () => {
      try {
        setLoading(true);
        setError("");
        setPlot(null);

        const res = await fetch(filePath);
        if (!res.ok) {
          throw new Error("Failed to load graph data.");
        }

        const json = (await res.json()) as ScatterPlotFile;

        if (
          !json ||
          typeof json.title !== "string" ||
          typeof json.xAxisLabel !== "string" ||
          typeof json.yAxisLabel !== "string" ||
          !Array.isArray(json.data) ||
          json.data.length === 0
        ) {
          throw new Error("Invalid graph JSON format.");
        }

        const firstPoint = json.data[0];
        const keys = Object.keys(firstPoint);

        if (keys.length < 2) {
          throw new Error(
            "Each data point must contain at least two numeric fields."
          );
        }

        const [xKey, yKey] = keys;

        const normalizedData = json.data.filter((point) => {
          return (
            typeof point[xKey] === "number" &&
            !Number.isNaN(point[xKey]) &&
            typeof point[yKey] === "number" &&
            !Number.isNaN(point[yKey])
          );
        });

        if (normalizedData.length === 0) {
          throw new Error("No valid numeric data points found.");
        }

        setPlot({
          title: json.title,
          xAxisLabel: json.xAxisLabel,
          yAxisLabel: json.yAxisLabel,
          data: normalizedData,
          xKey,
          yKey,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load graph.");
      } finally {
        setLoading(false);
      }
    };

    loadPlot();
  }, [filePath]);

  const chartError = useMemo(() => {
    if (!plot || !equation.trim()) return "";
    try {
      buildEquationEvaluator(equation);
      return "";
    } catch (err) {
      return err instanceof Error ? err.message : "Unable to parse equation.";
    }
  }, [plot, equation]);

  const combinedData = useMemo(() => {
    if (!plot || chartError) return [];
    return buildCombinedData(plot.data, plot.xKey, plot.yKey, equation);
  }, [plot, equation, chartError]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-slate-500">
        Loading graph...
      </div>
    );
  }

  if (error || chartError || !plot) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-red-600">
        {error || chartError || "Unable to render graph."}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 rounded-2xl border-2 border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-center text-xl font-semibold text-slate-800">
        {plot.title}
      </h3>

      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={300}>
          <ComposedChart
            data={combinedData}
            margin={{ top: 10, right: 20, bottom: 30, left: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              type="number"
              dataKey={plot.xKey}
              domain={["dataMin" + 5, "dataMax" + 5]}
              name={plot.xAxisLabel}
              label={{
                value: plot.xAxisLabel,
                position: "insideBottom",
                offset: -10,
              }}
            />

            <YAxis
              type="number"
              domain={["auto", "auto"]}
              name={plot.yAxisLabel}
              allowDataOverflow
              label={{
                value: plot.yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
            />

            {showZeroLine ? <ReferenceLine y={0} stroke="#444" /> : null}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;

                const x = payload[0]?.payload?.[plot.xKey];
                const xText = typeof x === "number" ? x.toFixed(2) : String(x);

                const scatterEntry = payload.find((item) => item.dataKey === "scatterY");
                const equationEntry = payload.find((item) => item.dataKey === "equationY");

                return (
                  <div className="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm">
                    {scatterEntry?.value != null ? (
                      <p className="text-pink-600">
                        Scatterplot: ({xText}, {Number(scatterEntry.value).toFixed(2)})
                      </p>
                    ) : null}

                    {equationEntry?.value != null ? (
                      <p className="text-lime-600">
                        Equation: ({xText}, {Number(equationEntry.value).toFixed(2)})
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />

            <Scatter dataKey="scatterY" name="Scatter" fill="#e70497" />

            {equation.trim() ? (
              <Line
                type="monotone"
                dataKey="equationY"
                name="Equation"
                stroke="#75c406"
                strokeWidth={3}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}