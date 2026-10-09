import { useRef, useState, useEffect, useMemo } from "react";
import Paper from "@mui/material/Paper";
import { useVirtualizer } from "@tanstack/react-virtual";
import { display_value, result_columns } from "../Functions/array_to_csv";

function TableView({ data, columns }) {

  // Cells are read from the row objects as each row scrolls into view, with NA where a record
  // has no value, so only the visible rows are ever turned into text.
  const colnames = useMemo(() => result_columns(data || [], columns), [data, columns]);
  const rows = useMemo(() => data || [], [data]);

  const parentRef = useRef(null);

  // refs for header cells (to measure widths)
  const headerCellRefs = useRef([]);
  headerCellRefs.current = []; // reset on each render

  const addHeaderRef = (el) => {
    if (el && !headerCellRefs.current.includes(el)) headerCellRefs.current.push(el);
  };

  // ref for the hidden sample row (offscreen) to measure body cell widths
  const sampleRowRef = useRef(null);

  // measured widths in px for each column
  const [colWidths, setColWidths] = useState([]);

  // virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 6,
  });

  // Build a sample row for measurement. Prefer the widest sample available:
  // Use first non-empty row (or empty strings if none).
  const sampleRow = useMemo(() => {
    if (!rows || rows.length === 0) return colnames.map(() => "");
    return colnames.map((c) => display_value(rows[0][c]));
  }, [rows, colnames]);

  // measure function: reads header cell offsets and sample row cell offsets
  const measureColumns = () => {
    if (!colnames || colnames.length === 0) {
      setColWidths([]);
      return;
    }

    // Build arrays of widths
    const headerWidths = headerCellRefs.current.map((el) =>
      el ? Math.ceil(el.getBoundingClientRect().width) : 0
    );

    const sampleCells = sampleRowRef.current
      ? Array.from(sampleRowRef.current.children)
      : [];
    const sampleWidths = sampleCells.map((el) =>
      el ? Math.ceil(el.getBoundingClientRect().width) : 0
    );

    const newWidths = colnames.map((_, i) => {
      const hw = headerWidths[i] || 0;
      const sw = sampleWidths[i] || 0;
      // Add a small padding buffer (6px) to avoid clipping
      return Math.max(hw, sw) + 6;
    });

    // If widths are all zero (not rendered yet), skip setting
    const allZero = newWidths.every((w) => w === 6); // 6 = buffer only
    if (!allZero) setColWidths(newWidths);
  };

  // measure after initial render and whenever parsedData changes
  useEffect(() => {
    // measure after a tick to ensure DOM is painted
    const t = setTimeout(() => {
      measureColumns();
    }, 50);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, colnames.length]);

  // re-measure on window resize
  useEffect(() => {
    const onResize = () => {
      // debounce slightly
      clearTimeout(onResize._t);
      onResize._t = setTimeout(() => measureColumns(), 80);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // grid template string
  const gridTemplate = colWidths && colWidths.length === colnames.length
    ? colWidths.map((w) => `${w}px`).join(" ")
    : `repeat(${colnames.length}, max-content)`; // fallback

  return (
    <Paper ref={parentRef} className="tableView">
      {/* Header (grid whose columns are set by gridTemplate) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          position: "sticky",
          top: 0,
          background: "#fafafa",
          fontWeight: "bold",
          zIndex: 2,
        }}
      >
        {colnames.map((col, i) => (
          <div
            key={i}
            ref={addHeaderRef}
            style={{
              padding: "6px 12px",
              whiteSpace: "nowrap",
              textAlign: i === 0 ? "left" : "right",
              borderRight: "1px solid #eee",
              boxSizing: "border-box",
              borderBottom: "1px solid #ccc",
              backgroundColor: "white"
            }}
          >
            {col}
          </div>
        ))}
      </div>

      {/* Hidden sample row for measuring body cell widths (offscreen) */}
      <div
        ref={sampleRowRef}
        style={{
          position: "absolute",
          left: -99999,
          top: -99999,
          visibility: "hidden",
          display: "grid",
          gridTemplateColumns: gridTemplate,
        }}
      >
        {sampleRow.map((val, i) => (
          <div
            key={`sample-${i}`}
            style={{
              padding: "4px 12px",
              whiteSpace: "nowrap",
              textAlign: i === 0 ? "left" : "right",
              boxSizing: "border-box",
            }}
          >
            {val}
          </div>
        ))}
      </div>

      {/* Virtualized body */}
      <div
        style={{
          position: "relative",
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          const values = colnames.map((c) => display_value(row ? row[c] : null));

          return (
            <div
              key={virtualRow.key}
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                position: "absolute",
                top: 0,
                left: 0,
                transform: `translateY(${virtualRow.start}px)`,
                borderBottom: "1px solid #eee",
                background:
                  virtualRow.index % 2 === 0 ? "white" : "rgba(0,0,0,0.02)",
                boxSizing: "border-box",
              }}
            >
              {values.map((val, i) => (
                <div
                  key={`${i}-${virtualRow.index}`}
                  style={{
                    padding: "4px 12px",
                    textAlign: i === 0 ? "left" : "right",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    boxSizing: "border-box",
                    borderRight: "1px solid #f5f5f5",
                  }}
                >
                  {val}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Paper>
  );
}

export default TableView;