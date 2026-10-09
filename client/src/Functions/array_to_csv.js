import { order_columns } from "./column_order";

/**
 * The columns to show for a result, in reading order.
 *
 * The server names them from the datasets the result drew on, so a column appears when a
 * returned dataset carries it and reads NA on the rows of any other dataset. A server that sends
 * no list gets every key the rows hold.
 *
 * @param {Array} data result rows, as objects
 * @param {string[]|null|undefined} columns the column names the server sent
 * @returns {string[]} the ordered column names
 */
function result_columns(data, columns) {
  const names = Array.isArray(columns) && columns.length !== 0
    ? columns
    : [...new Set((data || []).flatMap((row) => Object.keys(row)))];
  return order_columns(names);
}

/** A value as it is shown and written: NA when the record has none. */
function display_value(value) {
  return value === null || value === undefined ? "NA" : String(value);
}

function array_to_csv(data, columns) {
  const headers = result_columns(data, columns);
  const quote = (text) => (text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text);

  const headerString = headers.map((header) => `"${header.replace(/"/g, '""')}"`).join(",");
  const rowStrings = (data || []).map((row) =>
    headers.map((header) => quote(display_value(row[header]))).join(","));

  return [headerString, ...rowStrings].join("\n");
}

export { array_to_csv, result_columns, display_value };
