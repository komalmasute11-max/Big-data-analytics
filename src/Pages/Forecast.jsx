import RandomForestLivePrediction from "../components/RandomForestLivePrediction";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import ActualVsPredicted from "../components/ActualVsPredicted";
import {
  LineChart,
  Line,
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

// Holt's linear exponential smoothing: models both level and trend.
function holtForecast(data, horizon = 1, alpha = 0.8, beta = 0.2) {
  if (!data || data.length < 2) return null;
  let level = data[0].consumption;
  let trend = data[1].consumption - data[0].consumption;

  for (let i = 1; i < data.length; i++) {
    const previousLevel = level;
    level = alpha * data[i].consumption + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }
  return Math.max(0, Number((level + horizon * trend).toFixed(2)));
}

function linearForecast(data, targetYear) {
  if (!data || data.length < 2) return null;
  const meanX = data.reduce((sum, item) => sum + item.year, 0) / data.length;
  const meanY = data.reduce((sum, item) => sum + item.consumption, 0) / data.length;
  let numerator = 0;
  let denominator = 0;
  data.forEach((item) => {
    numerator += (item.year - meanX) * (item.consumption - meanY);
    denominator += (item.year - meanX) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  return Math.max(0, Number((slope * targetYear + intercept).toFixed(2)));
}

function Forecast() {
  const [rows, setRows] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState("");
  const [forecastYears, setForecastYears] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load CSV data
  useEffect(() => {
    Papa.parse(CSV_FILE, {
      download: true,
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        const fields = results.meta.fields || [];

        if (!fields.includes("Date")) {
          setError("CSV mein Date column nahi mila.");
          setLoading(false);
          return;
        }

        const stateColumns = fields.filter(
          (field) =>
            !EXCLUDED_COLUMNS.includes(field.trim())
        );

        const validRows = results.data.filter((row) => {
          return (
            row.Date &&
            /^\d{4}/.test(row.Date.trim())
          );
        });

        setRows(validRows);
        setStates(stateColumns);

        const initialState = stateColumns.includes("Punjab")
          ? "Punjab"
          : stateColumns[0] || "";

        setSelectedState(initialState);
        setLoading(false);
      },

      error: () => {
        setError(
          "CSV load nahi hui. File ka path check karo."
        );
        setLoading(false);
      },
    });
  }, []);

  // Calculate annual totals and identify complete calendar years.
  const yearlyData = useMemo(() => {
    const totals = {};
    const lastDates = {};

    rows.forEach((row) => {
      if (!selectedState || !row.Date) return;
      const date = row.Date.trim();
      const year = Number(date.slice(0, 4));
      const rawValue = String(row[selectedState] ?? "").trim();
      if (!rawValue) return;
      const value = Number(rawValue.replace(/,/g, ""));
      if (!Number.isFinite(value)) return;

      totals[year] = (totals[year] || 0) + value;
      if (!lastDates[year] || date > lastDates[year]) lastDates[year] = date;
    });

    return Object.entries(totals)
      .map(([year, consumption]) => ({
        year: Number(year),
        consumption: Number(consumption.toFixed(2)),
        lastDate: lastDates[year],
        complete: lastDates[year] >= `${year}-12-31`,
      }))
      .sort((a, b) => a.year - b.year);
  }, [rows, selectedState]);

  // Use complete calendar years only to fit the trend. Partial years
  // are excluded so they do not artificially lower the forecast.
  const completeYearlyData = useMemo(
    () => yearlyData.filter(
      (item) => item.complete && item.year <= 2023
    ),
    [yearlyData]
  );

  const latestSourceYear = completeYearlyData.length
    ? completeYearlyData[completeYearlyData.length - 1].year
    : null;

  // Compare linear regression and Holt's trend smoothing. Both models use
  // complete calendar years only; partial years are displayed for context.
  const forecastData = useMemo(() => {
    if (completeYearlyData.length < 3 || latestSourceYear == null) return [];

    const lastCompleteYear = completeYearlyData[completeYearlyData.length - 1].year;
    const history = completeYearlyData.map((item) => ({
      year: String(item.year), actual: item.consumption, linear: null, holt: null,
    }));

    // Backtest points are generated by fitting only years before each target.
    // This avoids evaluating a model on years it has already seen.
    // const partialYears = yearlyData.filter((item) => !item.complete);
    // partialYears.forEach((item) => history.push({
    //   year: `${item.year}*`, actual: item.consumption, linear: null, holt: null,
    // }));

    const future = [];

    for (let i = 1; i <= forecastYears; i++) {
      const year = lastCompleteYear + i;
      const horizon = i;

      future.push({
        year: String(year),
        actual: null,
        linear: linearForecast(completeYearlyData, year),
        holt: holtForecast(completeYearlyData, horizon),
      });
    }
    return [...history, ...future];
  }, [completeYearlyData, yearlyData, latestSourceYear, forecastYears]);

  // Expanding-window rolling-origin validation across all eligible complete years.
  // Each fold trains only on earlier years, then predicts the next unseen year.
  // Start with 3 training years so both methods have enough history to initialize.
  const modelComparison = useMemo(() => {
    const data = completeYearlyData;
    const minimumTrainingYears = 3;
    if (data.length <= minimumTrainingYears) return null;

    const errors = { linear: [], holt: [] };
    const testYears = [];

    for (let i = minimumTrainingYears; i < data.length; i++) {
      const training = data.slice(0, i);
      const target = data[i];
      const linear = linearForecast(training, target.year);
      const holt = holtForecast(training, 1);

      if (linear != null && Number.isFinite(linear)) {
        errors.linear.push(Math.abs(target.consumption - linear));
      }
      if (holt != null && Number.isFinite(holt)) {
        errors.holt.push(Math.abs(target.consumption - holt));
      }
      testYears.push(target.year);
    }

    const mae = (values) => values.length
      ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
      : null;

    return {
      linearMAE: mae(errors.linear),
      holtMAE: mae(errors.holt),
      testYears,
      validationFolds: testYears.length,
    };
  }, [completeYearlyData]);
  
  const lastHistorical = completeYearlyData.length
    ? completeYearlyData[completeYearlyData.length - 1]
    : null;

  const nextForecast = latestSourceYear != null && completeYearlyData.length >= 2
    ? forecastData.find((item) => Number(item.year) === latestSourceYear + 1)?.linear
    : null;

  const finalForecast = latestSourceYear != null && completeYearlyData.length >= 2
    ? forecastData.find((item) => Number(item.year) === latestSourceYear + forecastYears)?.linear
    : null;

  const percentageChange = nextForecast != null && lastHistorical && lastHistorical.consumption !== 0
    ? ((nextForecast - lastHistorical.consumption) / lastHistorical.consumption) * 100
    : null;

  const formatNumber = (value) =>
    Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });

  const cardStyle = {
    background: "#0d1524",
    border: "1px solid #1c293c",
    borderRadius: "12px",
    padding: "20px",
    boxSizing: "border-box",
  };

  const selectStyle = {
    background: "#080d18",
    color: "#f1f5f9",
    border: "1px solid #29364a",
    borderRadius: "8px",
    padding: "10px 12px",
    minWidth: "180px",
    outline: "none",
  };

  return (
    <div
      style={{
        background: "#080d18",
        color: "#f1f5f9",
        minHeight: "100vh",
        width: "100%",
        padding: "24px",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      {/* Page heading */}
      <h1
        style={{
          fontSize: "28px",
          margin: "0 0 8px",
        }}
      >
        Energy Consumption Forecast
      </h1>

      <p
        style={{
          color: "#8497b5",
          fontSize: "14px",
          margin: "0 0 24px",
        }}
      >
        Analyze historical electricity consumption and
        estimate future energy demand.
      </p>

      {loading ? (
        <p>Loading energy data...</p>
      ) : error ? (
        <p style={{ color: "#f87171" }}>{error}</p>
      ) : states.length === 0 ? (
        <p>No state data found in the CSV file.</p>
      ) : (
        <>
          {/* Filters */}
          <div
            style={{
              ...cardStyle,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            <div>
              <label
                htmlFor="forecastState"
                style={{
                  display: "block",
                  fontSize: "14px",
                  marginBottom: "8px",
                }}
              >
                Select State
              </label>

              <select
                id="forecastState"
                value={selectedState}
                onChange={(e) =>
                  setSelectedState(e.target.value)
                }
                style={selectStyle}
              >
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="forecastPeriod"
                style={{
                  display: "block",
                  fontSize: "14px",
                  marginBottom: "8px",
                }}
              >
                Forecast Period
              </label>

              <select
                id="forecastPeriod"
                value={forecastYears}
                onChange={(e) =>
                  setForecastYears(Number(e.target.value))
                }
                style={selectStyle}
              >
                <option value={1}>Next 1 Year</option>
                <option value={2}>Next 2 Years</option>
                <option value={3}>Next 3 Years</option>
                <option value={4}>Next 4 Years</option>
              </select>
            </div>
          </div>

          {yearlyData.length < 2 ? (
            <div style={cardStyle}>
              At least two complete calendar years are required to calculate a forecast for {selectedState}.
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div style={cardStyle}>
                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "13px",
                      margin: "0 0 12px",
                    }}
                  >
                    Latest Complete-Year Consumption
                  </p>

                  <h2
                    style={{
                      fontSize: "24px",
                      margin: 0,
                    }}
                  >
                    {formatNumber(
                      lastHistorical.consumption
                    )}
                  </h2>

                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "12px",
                      marginBottom: 0,
                    }}
                  >
                    MU · {lastHistorical.year} (complete year)
                  </p>
                </div>

                <div style={cardStyle}>
                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "13px",
                      margin: "0 0 12px",
                    }}
                  >
                    Next Year Forecast
                  </p>

                  <h2
                    style={{
                      fontSize: "24px",
                      margin: 0,
                      color: "#f5a623",
                    }}
                  >
                    {nextForecast != null
                      ? formatNumber(nextForecast)
                      : "N/A"}
                  </h2>

                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "12px",
                      marginBottom: 0,
                    }}
                  >
                    MU · {latestSourceYear + 1}
                  </p>
                </div>
                
                <div style={cardStyle}>
                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "13px",
                      margin: "0 0 12px",
                    }}
                  >
                    Estimated Annual Change
                  </p>

                  <h2
                    style={{
                      fontSize: "24px",
                      margin: 0,
                      color:
                        percentageChange == null
                          ? "#f1f5f9"
                          : percentageChange >= 0
                            ? "#34d399"
                            : "#f87171",
                    }}
                  >
                    {percentageChange != null
                      ? `${percentageChange >= 0 ? "+" : ""
                      }${percentageChange.toFixed(2)}%`
                      : "N/A"}
                  </h2>

                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "12px",
                      marginBottom: 0,
                    }}
                  >
                    Compared with latest year
                  </p>
                </div>

                <div style={cardStyle}>
                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "13px",
                      margin: "0 0 12px",
                    }}
                  >
                    Forecast at Selected Horizon
                  </p>

                  <h2
                    style={{
                      fontSize: "24px",
                      margin: 0,
                      color: "#38bdf8",
                    }}
                  >
                    {finalForecast != null
                      ? formatNumber(finalForecast)
                      : "N/A"}
                  </h2>

                  <p
                    style={{
                      color: "#8497b5",
                      fontSize: "12px",
                      marginBottom: 0,
                    }}
                  >
                    MU ·{" "}
                    {latestSourceYear + forecastYears}
                  </p>
                </div>
              </div>

              {/* Forecast graph */}
              <div
                style={{
                  ...cardStyle,
                  width: "100%",
                  maxWidth: "1100px",
                  margin: "0 auto 24px",
                }}
              >
                <h2
                  style={{
                    fontSize: "18px",
                    margin: "0 0 20px",
                  }}
                >
                  Historical vs Forecast — {selectedState}
                </h2>

                <div
                  style={{
                    width: "100%",
                    height: "350px",
                    minWidth: 0,
                  }}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={forecastData}
                      margin={{
                        top: 10,
                        right: 15,
                        left: 10,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#29364a"
                      />

                      <XAxis
                        dataKey="year"
                        stroke="#8497b5"
                        tick={{
                          fill: "#cbd5e1",
                          fontSize: 12,
                        }}
                      />

                      <YAxis
                        stroke="#8497b5"
                        tick={{
                          fill: "#cbd5e1",
                          fontSize: 11,
                        }}
                        width={65}
                      />

                      <Tooltip
                        formatter={(value, name) => [
                          value == null
                            ? "N/A"
                            : `${formatNumber(value)} MU`,
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: "#0d1524",
                          border: "1px solid #29364a",
                          borderRadius: "8px",
                          color: "#ffffff",
                        }}
                      />

                      <Legend />

                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Historical Consumption"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />

                      <Line
                        type="monotone"
                        dataKey="linear"
                        name="Linear Regression"
                        stroke="#f5a623"
                        strokeWidth={3}
                        strokeDasharray="7 5"
                        dot={{ r: 5 }}
                        connectNulls={false}
                      />

                      <Line
                        type="monotone"
                        dataKey="holt"
                        name="Holt Exponential Smoothing"
                        stroke="#a78bfa"
                        strokeWidth={3}
                        strokeDasharray="3 4"
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Forecast table */}
              <div
                style={{
                  ...cardStyle,
                  width: "100%",
                  maxWidth: "1100px",
                  margin: "0 auto",
                  overflowX: "auto",
                }}
              >
                <h2
                  style={{
                    fontSize: "18px",
                    margin: "0 0 16px",
                  }}
                >
                  Forecast Details
                </h2>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: "14px",
                  }}
                >
                  <thead>
                    <tr style={{ color: "#8497b5" }}>
                      <th style={{ padding: "12px 8px" }}>
                        Year
                      </th>

                      <th style={{ padding: "12px 8px" }}>
                        Type
                      </th>

                      <th style={{ padding: "12px 8px" }}>
                        Consumption (MU)
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {forecastData
                      .filter((item) => item.actual == null)
                      .map((item) => (
                        <>
                          <tr
                            key={`${item.year}-linear`}
                            style={{
                              borderTop:
                                "1px solid #29364a",
                            }}
                          >
                            <td
                              style={{ padding: "12px 8px" }}
                            >
                              {item.year}
                            </td>

                            <td
                              style={{
                                padding: "12px 8px",
                                color: "#f5a623",
                              }}
                            >
                              Forecast
                            </td>

                            <td
                              style={{ padding: "12px 8px" }}
                            >
                              {formatNumber(item.linear)}
                            </td>
                          </tr>
                          <tr key={`${item.year}-holt`} style={{ borderTop: "1px solid #29364a" }}>
                            <td style={{ padding: "12px 8px" }}>{item.year}</td>
                            <td style={{ padding: "12px 8px", color: "#a78bfa" }}>Holt Smoothing</td>
                            <td style={{ padding: "12px 8px" }}>{formatNumber(item.holt)}</td>
                          </tr>
                        </>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Model comparison based on held-out complete years */}
              <div style={{ ...cardStyle, width: "100%", maxWidth: "1100px", margin: "24px auto" }}>
                <h2 style={{ fontSize: "20px", margin: "0 0 8px" }}>Forecast Model Comparison</h2>
                <p style={{ color: "#8497b5", fontSize: "13px", lineHeight: 1.6 }}>
                  Models are compared using expanding-window rolling-origin validation. Each fold trains on earlier complete years and predicts the next unseen complete year. Lower average MAE means lower absolute error across these validation folds; it does not guarantee future accuracy.
                </p>
                {modelComparison ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                    <div style={{ border: "1px solid #29364a", borderRadius: "8px", padding: "16px" }}>
                      <div style={{ color: "#f5a623", marginBottom: "8px" }}>Linear Regression MAE</div>
                      <strong style={{ fontSize: "24px" }}>{formatNumber(modelComparison.linearMAE)} MU</strong>
                    </div>
                    <div style={{ border: "1px solid #29364a", borderRadius: "8px", padding: "16px" }}>
                      <div style={{ color: "#a78bfa", marginBottom: "8px" }}>Holt Smoothing MAE</div>
                      <strong style={{ fontSize: "24px" }}>{formatNumber(modelComparison.holtMAE)} MU</strong>
                    </div>
                  </div>
                ) : (
                  <p>At least four complete years are needed: three for initial training and one for validation.</p>
                )}
                {modelComparison && (
                  <p style={{ color: "#cbd5e1", fontSize: "13px", marginBottom: 0 }}>
                    Rolling-origin folds: {modelComparison.validationFolds}. Validation years: {modelComparison.testYears.join(", ")}. {modelComparison.linearMAE < modelComparison.holtMAE ? "Linear Regression has lower MAE on this small validation set." : modelComparison.holtMAE < modelComparison.linearMAE ? "Holt Smoothing has lower MAE on this small validation set." : "Both models have equal MAE on this validation set."}
                  </p>
                )}
              </div>
              <RandomForestLivePrediction />
              {/* Disclaimer */}
              <p
                style={{
                  color: "#8497b5",
                  fontSize: "12px",
                  lineHeight: 1.7,
                  marginTop: "18px",
                }}
              >
                Note: Forecast values are estimates from linear regression fitted only to complete calendar years. Partial years (marked with *) are shown for context but excluded from the trend calculation. In this dataset, 2024 is incomplete, so its total must not be compared directly with full-year totals. Forecasts are not guaranteed future demand and do not account for weather, seasonal variation, policy, or other external factors.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Forecast;

