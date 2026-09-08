import { order_columns } from "./column_order";
import { strip_unused_attribution } from "./attribution_columns";

function array_to_csv(data) {
  // Attribution columns are only meaningful for the sources that supply them. A result set
  // with no iNaturalist rows would otherwise carry three permanently empty columns; where a
  // search mixes sources they stay, and the rows without them read NA like any other gap.
  data = strip_unused_attribution(data);
  // 1. Get all unique headers from all objects in the array, grouped so that columns
  //    describing the same thing sit together. The driver returns Cypher map keys in
  //    alphabetical order, which splits the taxonomic ranks across the whole table.
  const allHeaders = order_columns([...new Set(data.flatMap(obj => Object.keys(obj)))]);

  // 2. Format the headers for the CSV file
  const headerString = allHeaders.map(header => `"${header.replace(/"/g, '""')}"`).join(',');

  // 3. Map the data objects to CSV rows
  const rowStrings = data.map(obj => {
    // For each object, get the values in the same order as the headers
    const rowValues = allHeaders.map(header => {
      let value = obj[header];

      // Replace null or undefined with "NA"
      if (value === null || value === undefined) {
        value = 'NA';
      }
      
      // Handle commas or double quotes within values by enclosing in double quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        // Escape double quotes by replacing them with two double quotes
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });

    // Join the row values with a comma
    return rowValues.join(',');
  });

  // 4. Combine the header and rows
  return [headerString, ...rowStrings].join('\n');
};

export {array_to_csv}