import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import energyData from "../data/energyData";

function EnergyChart() {
  return (
    <div
      style={{
        background: "#0d1524",
        border: "1px solid #1c293c",
        marginTop: "30px",
        padding: "25px",
        borderRadius: "14px",
        // width: "100%",
        maxWidth: "700px",
        marginLeft: "auto",
        marginRight: "auto",
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          color: "#f1f5f9",
          fontSize: "18px",
          marginBottom: "20px",
        }}
      >
        Top Energy Consuming States
      </h2>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={energyData}
          margin={{
            top: 10,
            right: 20,
            left: 10,
            bottom: 10,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#29364a"
          />

          <XAxis
            dataKey="state"
            stroke="#8497b5"
            tick={{
              fill: "#8497b5",
              fontSize: 12,
            }}
          />

          <YAxis
            stroke="#8497b5"
            tick={{
              fill: "#8497b5",
              fontSize: 12,
            }}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#0d1524",
              border: "1px solid #29364a",
              borderRadius: "8px",
              color: "#ffffff",
            }}
            labelStyle={{
              color: "#a16f1d",
            }}
          />

          <Bar
            dataKey="consumption"
            fill="#f5a623"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EnergyChart;