
function YearFilter({ selectedYear, setSelectedYear }) {
  const years = Array.from(
    { length: 10 },
    (_, index) => 2023 - index
  );

  return (
    <div className="year-filter">
      <h2>Select Year</h2>

      <select
        value={selectedYear}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

export default YearFilter;
