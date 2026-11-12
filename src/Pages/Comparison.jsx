import { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CSV_FILE =
  "/corrected_daily_energy_met_MU_2014_2024%20(1).csv";

const EXCLUDED_COLUMNS = [
  "Date",
  "Total",
  "AMNSIL",
  "Damodar Valley Corporation",
];

function Comparison() {
  const [rows, setRows] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedStates, setSelectedStates] = useState([
    "Punjab",
    "Haryana",
  ]);
  const [selectedYear, setSelectedYear] = useState(2023);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Papa.parse(CSV_FILE, {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),

      complete: (results) => {
        const fields = results.meta.fields || [];

        if (!fields.includes("Date")) {
          setError("CSV mein Date column nahi mila.");
          setLoading(false);
          return;
        }

        const stateColumns = fields.filter(
          (field) => !EXCLUDED_COLUMNS.includes(field.trim())
        );

        const validRows = results.data.filter((row) => {
          return row.Date && /^\d{4}/.test(row.Date.trim());
        });

        setStates(stateColumns);
        setRows(validRows);

        const initialStates = ["Punjab", "Haryana"].filter(
          (state) => stateColumns.includes(state)
        );

        setSelectedStates(
          initialStates.length > 0
            ? initialStates
            : stateColumns.slice(0, 2)
        );

        setLoading(false);
      },

      error: () => {
        setError("CSV load nahi hui. File ka path check karo.");
        setLoading(false);
      },
    });
  }, []);

  const years = [
    ...new Set(
      rows
        .map((row) => Number(row.Date.slice(0, 4)))
        .filter((year) => year >= 2014 && year <= 2023)
    ),
  ].sort((a, b) => a - b);


  const availableStates = useMemo(() => {
    return states.filter((state) =>
      rows.some((row) => {
        const year = Number(row.Date.slice(0, 4));

        if (year !== selectedYear) return false;

        const rawValue = String(row[state] ?? "").trim();
        if (!rawValue) return false;

        const value = Number(rawValue.replace(/,/g, ""));

        return Number.isFinite(value);
      })
    );
  }, [states, rows, selectedYear]);

  useEffect(() => {
    setSelectedStates((previous) => {
      const filtered = previous.filter((state) =>
        availableStates.includes(state)
      );

      if (filtered.length > 0) return filtered;

      return availableStates.slice(0, 2);
    });
  }, [availableStates]);

  // Calculate totals only from valid, non-empty values.
  const yearlyTotals = {};
  const validValueCounts = {};

  rows.forEach((row) => {
    const year = Number(row.Date.slice(0, 4));

    if (year > 2023 || year !== selectedYear) return;

    selectedStates.forEach((state) => {
      const rawValue = String(row[state] ?? "").trim();

      if (!rawValue) return;

      const value = Number(rawValue.replace(/,/g, ""));

      if (!Number.isFinite(value)) return;

      yearlyTotals[state] = (yearlyTotals[state] || 0) + value;
      validValueCounts[state] = (validValueCounts[state] || 0) + 1;
    });
  });

  const chartData = selectedStates.map((state) => ({
    state,
    consumption:
      validValueCounts[state] > 0
        ? Number(yearlyTotals[state].toFixed(2))
        : null,
    hasData: (validValueCounts[state] || 0) > 0,
  }));

  const missingStates = chartData
    .filter((item) => !item.hasData)
    .map((item) => item.state);

  return (
    <div
      style={{
        background: "#080d18",
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        padding: "20px",
        color: "#f1f5f9",
        overflowX: "hidden",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          margin: "0 0 8px",
        }}
      >
        State-wise Energy Comparison
      </h1>

      <p
        style={{
          color: "#8497b5",
          margin: "0 0 20px",
          fontSize: "14px",
        }}
      >
        Select states and year to compare electricity met.
      </p>

      {loading ? (
        <p>Loading energy data...</p>
      ) : error ? (
        <p style={{ color: "#f87171" }}>{error}</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              alignItems: "flex-start",
              marginTop: "20px",
            }}
          >
            <div>
              <label
                htmlFor="stateSelect"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                }}
              >
                Select states (Ctrl-click for multiple)
              </label>

              <select
                id="stateSelect"
                multiple
                value={selectedStates}
                onChange={(e) => {
                  setSelectedStates(
                    Array.from(
                      e.target.selectedOptions,
                      (option) => option.value
                    )
                  );
                }}
                style={{
                  background: "#0d1524",
                  color: "#f1f5f9",
                  border: "1px solid #29364a",
                  borderRadius: "8px",
                  padding: "8px",
                  width: "220px",
                  height: "120px",
                  boxSizing: "border-box",
                }}
              >
                {availableStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="yearSelect"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                }}
              >
                Select year
              </label>

              <select
                id="yearSelect"
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(Number(e.target.value))
                }
                style={{
                  background: "#0d1524",
                  color: "#f1f5f9",
                  border: "1px solid #29364a",
                  borderRadius: "8px",
                  padding: "9px 12px",
                }}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedStates.length === 0 ? (
            <p>Please select at least one state.</p>
          ) : (
            <div
              style={{
                background: "#0d1524",
                border: "1px solid #1c293c",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "24px",
                width: "100%",
                maxWidth: "1000px",
                marginLeft: "auto",
                marginRight: "auto",
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  margin: "0 0 16px",
                  fontWeight: 600,
                }}
              >
                Electricity Met Comparison — {selectedYear}
              </h2>

              <div
                style={{
                  width: "100%",
                  height: "320px",
                  minWidth: 0,
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 5,
                      bottom: 5,
                    }}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#29364a"
                    />

                    <XAxis
                      dataKey="state"
                      stroke="#8497b5"
                      tick={{
                        fill: "#cbd5e1",
                        fontSize: 11,
                      }}
                      interval={0}
                    />

                    <YAxis
                      stroke="#8497b5"
                      tick={{
                        fill: "#cbd5e1",
                        fontSize: 11,
                      }}
                      width={55}
                    />

                    <Tooltip
                      formatter={(value) => [
                        Number(value).toLocaleString("en-IN"),
                        "Annual total (MU)",
                      ]}
                      contentStyle={{
                        backgroundColor: "#0d1524",
                        border: "1px solid #29364a",
                        borderRadius: "8px",
                        color: "#ffffff",
                      }}
                      labelStyle={{
                        color: "#ffffff",
                      }}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: "12px",
                        paddingTop: "8px",
                      }}
                    />

                    <Bar
                      dataKey="consumption"
                      name="Electricity met"
                      fill="#f5a623"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={80}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {missingStates.length > 0 && (
                <p
                  style={{
                    color: "#fbbf24",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    margin: "12px 0 0",
                  }}
                >
                  No data available for {missingStates.join(", ")} in{" "}
                  {selectedYear}. Please check the source CSV.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Comparison;
