"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
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

export default function ScatterPlot({
  filePath,
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-slate-500">
        Loading graph...
      </div>
    );
  }

  if (error || !plot) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-red-600">
        {error || "Unable to render graph."}
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border-2 border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-center text-xl font-semibold text-slate-800">
        {plot.title}
      </h3>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              type="number"
              dataKey={plot.xKey}
              name={plot.xAxisLabel}
              label={{
                value: plot.xAxisLabel,
                position: "insideBottom",
                offset: -10,
              }}
            />

            <YAxis
              type="number"
              dataKey={plot.yKey}
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
                String(name) === plot.yKey ? plot.yAxisLabel : plot.xAxisLabel,
              ]}
              labelFormatter={(label) => `${plot.xAxisLabel}: ${label}`}
            />

            <Scatter data={plot.data} fill="#43a047" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}