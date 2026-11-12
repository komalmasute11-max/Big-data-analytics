
const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const router = express.Router();

const csvPath = path.join(
  __dirname,
  "..",
  "data",
  "corrected_daily_energy_met_MU_2014_2024 (1).csv"
);

// GET /api/energy
router.get("/", (req, res) => {
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({
      success: false,
      message: "Energy CSV file not found. Check Backend/data/"
    });
  }

  const energyData = [];

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on("data", (row) => {
      energyData.push(row);
    })
    .on("end", () => {
      res.json({
        success: true,
        count: energyData.length,
        data: energyData
      });
    })
    .on("error", (error) => {
      console.error("CSV read error:", error.message);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to read energy data"
        });
      }
    });
});

module.exports = router;