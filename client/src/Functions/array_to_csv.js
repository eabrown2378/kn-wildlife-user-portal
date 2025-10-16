function array_to_csv(data) {
  // 1. Get all unique headers from all objects in the array
  const allHeaders = [...new Set(data.flatMap(obj => Object.keys(obj)))];

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