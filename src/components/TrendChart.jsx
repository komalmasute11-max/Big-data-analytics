
import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function TrendChart({ selectedYear }) {
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Papa.parse("/corrected_daily_energy_met_MU_2014_2024%20(1).csv", {
      download: true,
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        const yearlyData = {};

        results.data.forEach((row) => {
          if (!row.Date || !row.Total || row.Total.trim() === "") {
            return;
          }

          const year = Number(row.Date.slice(0, 4));

          // Exclude 2024 and later years
          if (!Number.isFinite(year) || year > 2023) {
            return;
          }

          const value = Number(row.Total.replace(/,/g, ""));

          if (!Number.isFinite(value)) {
            return;
          }

          if (!yearlyData[year]) {
            yearlyData[year] = 0;
          }

          yearlyData[year] += value;
        });

        const formattedData = Object.entries(yearlyData)
          .map(([year, total]) => ({
            year: Number(year),
            consumption: Number(total.toFixed(2)),
          }))
          .sort((a, b) => a.year - b.year);

        setTrendData(formattedData);
        setLoading(false);
      },

      error: () => {
        setError("CSV file load nahi hui. File ka naam aur path check karo.");
        setLoading(false);
      },
    });
  }, []);

  const filteredData = trendData.filter(
    (item) => item.year <= selectedYear && item.year <= 2023
  );

  if (loading) return <p style={{ color: "white" }}>Loading energy data...</p>;

  if (error) return <p style={{ color: "red" }}>{error}</p>;

  if (filteredData.length === 0) {
    return <p style={{ color: "white" }}>Is year ka data available nahi hai.</p>;
  }

  return (
    <div
      style={{
        background: "#0d1524",
        border: "1px solid #1c293c",
        borderRadius: "14px",
        padding: "25px",
        marginTop: "20px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ color: "#f1f5f9", fontSize: "18px" }}>
        Energy Consumption Trend
      </h2>

      <p style={{ color: "#8497b5", fontSize: "13px" }}>
        Year-wise electricity met (MU)
      </p>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#29364a" />

          <XAxis
            dataKey="year"
            stroke="#8497b5"
            tick={{ fill: "#8497b5", fontSize: 12 }}
          />

          <YAxis
            stroke="#8497b5"
            tick={{ fill: "#8497b5", fontSize: 12 }}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#0d1524",
              border: "1px solid #29364a",
              borderRadius: "8px",
              color: "#ffffff",
            }}
            labelStyle={{ color: "#f5a623" }}
            formatter={(value) => [
              value.toLocaleString("en-IN"),
              "Annual total (MU)",
            ]}
          />

          <Line
            type="monotone"
            dataKey="consumption"
            name="Consumption"
            stroke="#f5a623"
            strokeWidth={3}
            dot={{ fill: "#f5a623", r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TrendChart;
