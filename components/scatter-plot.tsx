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

function normalizeEquation(equation: string) {
  return equation
    .trim()
    .replace(/\s+/g, "")
    .replace(/^y=/i, "")
    .replace(/\^/g, "**")
    .replace(/(\d)(x)/gi, "$1*$2")
    .replace(/(\d)(sin\()/gi, "$1*$2")
    .replace(/(\d)(exp\()/gi, "$1*$2")
    .replace(/(\))(x)/gi, "$1*$2")
    .replace(/(x)(\d)/gi, "$1*$2");
}

function buildEquationEvaluator(equation: string) {
  const normalized = normalizeEquation(equation);

  if (!normalized) return null;

  const isSafe = /^[0-9xX+\-*/().,a-zA-Z*]+$/.test(normalized);
  if (!isSafe) {
    throw new Error("Equation contains unsupported characters.");
  }

  const allowedFunctions = ["sin", "exp"];
  const identifiers =
    normalized.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];

  const invalidIdentifiers = identifiers.filter(
    (name) =>
      name !== "x" &&
      name !== "X" &&
      !allowedFunctions.includes(name)
  );

  if (invalidIdentifiers.length > 0) {
    throw new Error("Equation contains unsupported functions.");
  }

  try {
    const jsExpression = normalized
      .replace(/\bsin\(/g, "Math.sin(")
      .replace(/\bexp\(/g, "Math.exp(");

    const fn = new Function("x", `return ${jsExpression};`) as (
      x: number
    ) => number;

    return (x: number) => {
      const y = fn(x);
      if (typeof y !== "number" || Number.isNaN(y) || !Number.isFinite(y)) {
        return null;
      }
      return y;
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
    .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

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

  const combined: ChartPoint[] = [];
  for (let x = minX; x <= maxX; x += 1) {
    combined.push({
      [xKey]: x,
      scatterY: scatterMap.has(x) ? (scatterMap.get(x) ?? null) : null,
      equationY: evaluator ? evaluator(x) : null,
    });
  }

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
          throw new Error("Each data point must contain at least two numeric fields.");
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
              domain={["dataMin", "dataMax"]}
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
              label={{
                value: plot.yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
            />

            {showZeroLine ? <ReferenceLine y={0} stroke="#444" /> : null}

            <Tooltip
              formatter={(value, name) => [
                value ?? "",
                name === "scatterY"
                  ? plot.yAxisLabel
                  : name === "equationY"
                    ? "Equation"
                    : String(name),
              ]}
              labelFormatter={(label) => `${plot.xAxisLabel}: ${label}`}
            />

            <Scatter dataKey="scatterY" fill="#43a047" />

            {equation.trim() ? (
              <Line
                type="monotone"
                dataKey="equationY"
                stroke="red"
                strokeWidth={2}
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