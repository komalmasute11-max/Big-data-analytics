
import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function ActualVsPredicted() {
  const [data, setData] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState("Punjab");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Papa.parse("/model_predictions.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,

      complete: (result) => {
        const rows = result.data
          .filter(
            (row) =>
              row.Date &&
              row.State &&
              row.Actual !== "" &&
              row.Predicted !== "" &&
              Number.isFinite(Number(row.Actual)) &&
              Number.isFinite(Number(row.Predicted))
          )
          .map((row) => ({
            Date: row.Date,
            State: row.State.trim(),
            Actual: Number(row.Actual),
            Predicted: Number(row.Predicted),
          }));

        const stateNames = [
          ...new Set(rows.map((row) => row.State)),
        ].sort();

        setData(rows);
        setStates(stateNames);

        if (!stateNames.includes("Punjab") && stateNames.length > 0) {
          setSelectedState(stateNames[0]);
        }

        setLoading(false);
      },

      error: () => {
        setError(
          "Could not load model_predictions.csv. Check the file location."
        );
        setLoading(false);
      },
    });
  }, []);

  // Filter data for the selected state
  const chartData = data
    .filter((row) => row.State === selectedState)
    .sort((a, b) => a.Date.localeCompare(b.Date));

  // Calculate MAE and RMSE
  const metrics =
    chartData.length > 0
      ? {
          mae:
            chartData.reduce(
              (sum, row) =>
                sum + Math.abs(row.Actual - row.Predicted),
              0
            ) / chartData.length,

          rmse: Math.sqrt(
            chartData.reduce(
              (sum, row) =>
                sum + (row.Actual - row.Predicted) ** 2,
              0
            ) / chartData.length
          ),
        }
      : null;

  if (loading) {
    return <p>Loading prediction data...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Actual vs Predicted Electricity Consumption</h2>

      <label htmlFor="state-select">Select State: </label>

      <select
        id="state-select"
        value={selectedState}
        onChange={(e) => setSelectedState(e.target.value)}
        style={{
          padding: "8px",
          marginBottom: "20px",
          borderRadius: "6px",
        }}
      >
        {states.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </select>

      <p>
        Comparing actual electricity consumption with the
        machine learning model's predictions for {selectedState}.
      </p>

      {chartData.length === 0 ? (
        <p>No prediction data available for this state.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 25,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="Date"
                tick={{ fontSize: 11 }}
                minTickGap={30}
              />

              <YAxis
                label={{
                  value: "Electricity Consumption",
                  angle: -90,
                  position: "insideLeft",
                }}
              />

              <Tooltip />
              <Legend />

              <Line
                type="monotone"
                dataKey="Actual"
                stroke="#2563eb"
                name="Actual Consumption"
                dot={false}
                strokeWidth={2}
              />

              <Line
                type="monotone"
                dataKey="Predicted"
                stroke="#f59e0b"
                name="Predicted Consumption"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Evaluation Metrics */}
          <h2 style={{ marginTop: "30px" }}>
            Model Evaluation Metrics
          </h2>

          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              marginTop: "15px",
            }}
          >
            {/* MAE Card */}
            <div
              style={{
                background: "#111827",
                border: "1px solid #263449",
                padding: "20px",
                borderRadius: "10px",
                flex: "1",
                minWidth: "200px",
                color: "#ffffff",
              }}
            >
              <h3 style={{ color: "#60a5fa" }}>
                Mean Absolute Error (MAE)
              </h3>

              <h2>{metrics.mae.toFixed(3)}</h2>

              <p>
                Average absolute difference between actual
                and predicted consumption.
              </p>
            </div>

            {/* RMSE Card */}
            <div
              style={{
                background: "#111827",
                border: "1px solid #263449",
                padding: "20px",
                borderRadius: "10px",
                flex: "1",
                minWidth: "200px",
                color: "#ffffff",
              }}
            >
              <h3 style={{ color: "#fbbf24" }}>
                Root Mean Squared Error (RMSE)
              </h3>

              <h2>{metrics.rmse.toFixed(3)}</h2>

              <p>
                Gives more weight to larger prediction errors.
              </p>
            </div>
          </div>

          <p style={{ marginTop: "20px" }}>
            Test records for {selectedState}: {chartData.length}
          </p>
        </>
      )}
    </div>
  );
}

export default ActualVsPredicted;
