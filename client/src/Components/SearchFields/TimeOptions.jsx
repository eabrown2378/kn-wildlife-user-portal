import Information from "../Information";



function TimeOptions({ handleChange, query, isLoading }) {

    // define date options
    const yearOptions = Array(27).fill().map((e, index) => {
        return (
            <option value={String(1993 + index)}>{String(1993 + index)}</option>
        );
    });

    const monthOptions = ['01', '02', '03', '04', '05', '06', 
                          '07', '08', '09', '10', '11', '12'].map((m) => {
                            return (
                                <option value={m}>{m}</option>
                            )
                          });

    const dayOptions = {
        jan: Array(31).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        feb: Array(28).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        febLeap: Array(29).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        mar: Array(31).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        apr: Array(30).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        may: Array(31).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        jun: Array(30).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        jul: Array(31).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        aug: Array(31).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        sep: Array(30).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        oct: Array(31).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        nov: Array(30).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
        dec: Array(31).fill().map((e, index) => <option value={index + 1}>{index + 1}</option>),
    };

    return (  
        <fieldset>
            <legend style={{color:"white", display:"flex", gap:"6px"}}>Time Range<Information blurb="timeRange"/></legend>
            <label className="query--label" htmlFor="fromTime">From:</label>
            <div id="fromTime">
                <select name="fromYear" id="fromYear" value={query.fromYear} onChange={handleChange} disabled={isLoading}>
                    <option value="">yyyy</option>
                    {yearOptions}
                </select>
                <select name="fromMonth" id="fromMonth" value={query.fromMonth} onChange={handleChange} disabled={isLoading}>
                    <option value="">mm</option>
                    {monthOptions}
                </select>
                <select name="fromDay" id="fromDay" value={query.fromDay} onChange={handleChange} disabled={isLoading}>
                    <option value="">dd</option>
                    {query.fromMonth === '01' && dayOptions.jan}
                    {query.fromMonth === '02' && query.fromYear%4 !== 0 && dayOptions.feb}
                    {query.fromMonth === '02' && query.fromYear%4 === 0 && dayOptions.febLeap}
                    {query.fromMonth === '03' && dayOptions.mar}
                    {query.fromMonth === '04' && dayOptions.apr}
                    {query.fromMonth === '05' && dayOptions.may}
                    {query.fromMonth === '06' && dayOptions.jun}
                    {query.fromMonth === '07' && dayOptions.jul}
                    {query.fromMonth === '08' && dayOptions.aug}
                    {query.fromMonth === '09' && dayOptions.sep}
                    {query.fromMonth === '10' && dayOptions.oct}
                    {query.fromMonth === '11' && dayOptions.nov}
                    {query.fromMonth === '12' && dayOptions.dec}
                </select>
            </div>
            <label className="query--label" htmlFor="toTime">To:</label>
            <div id="toTime">
                <select name="toYear" id="toYear" value={query.toYear} onChange={handleChange} disabled={isLoading}>
                    <option value="">yyyy</option>
                    {yearOptions}
                </select>
                <select name="toMonth" id="toMonth" value={query.toMonth} onChange={handleChange} disabled={isLoading}>
                    <option value="">mm</option>
                    {monthOptions}
                </select>
                <select name="toDay" id="toDay" value={query.toDay} onChange={handleChange} disabled={isLoading}>
                    <option value="">dd</option>
                    {query.toMonth === '01' && dayOptions.jan}
                    {query.toMonth === '02' && query.toYear%4 !== 0 && dayOptions.feb}
                    {query.toMonth === '02' && query.toYear%4 === 0 && dayOptions.febLeap}
                    {query.toMonth === '03' && dayOptions.mar}
                    {query.toMonth === '04' && dayOptions.apr}
                    {query.toMonth === '05' && dayOptions.may}
                    {query.toMonth === '06' && dayOptions.jun}
                    {query.toMonth === '07' && dayOptions.jul}
                    {query.toMonth === '08' && dayOptions.aug}
                    {query.toMonth === '09' && dayOptions.sep}
                    {query.toMonth === '10' && dayOptions.oct}
                    {query.toMonth === '11' && dayOptions.nov}
                    {query.toMonth === '12' && dayOptions.dec}
                </select>
            </div>
        </fieldset>
    );
}

export default TimeOptions;