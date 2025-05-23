import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Papa from 'papaparse';



function TableView({data}) {


    const parsedData = data ? Papa.parse(data).data : null

    const colnames = parsedData ? parsedData[0] : null;

    function createData(dat, colnames) {

        let row = {};

        colnames.map((key, i) => {
            row[key] = dat[i];
        });

        console.log(row)

        return { ...row };
    }

    const rows = parsedData ? parsedData.map((item, i) => {
        return i !== 0 ? createData(item, colnames) : null
    }).filter(item => item !== null) : null;

    if (data) {
        console.log(colnames)
        console.log(rows)
    }

  return (
    <TableContainer component={Paper} style={{overflow:"scroll", width: "84%", maxHeight:"80vh", position:"absolute", border: "3px solid black", borderRadius:"5px"}}>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
        <TableHead>
          <TableRow>
             {data && colnames.map((item, i) => {
                return i === 0 ? <TableCell key={`columnhead${i}`} style={{fontWeight:"bold"}}>{item}</TableCell> : <TableCell key={`column${i}`} style={{fontWeight:"bold"}} align='right'>{item}</TableCell>
             })}
          </TableRow>
        </TableHead>
        <TableBody>
          {data && rows.map((row,j) => (
            <TableRow
              key={`row${j}`}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
             {data && colnames.map((item, i) => {
                return i === 0 ? <TableCell key={`column${i}row${j}`}>{row[item]}</TableCell> : <TableCell key={`column${i}row${j}`} align='right'>{row[item]}</TableCell>
             })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};



export default TableView;