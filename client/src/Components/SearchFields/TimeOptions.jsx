import { useContext, useMemo } from "react";
import Information from "../Information";
import { SearchOptionsContext } from "../../Context/SearchOptionsContext";

/**
 * The time range, as a two-handle bar over the years the data covers.
 *
 * The span comes from the graph rather than a fixed list, so every year holding observations
 * can be selected. Months and days are available for narrowing to a season, folded away so the
 * common case is one drag.
 */
function TimeOptions({ handleChange, query, isLoading }) {

    const searchOptions = useContext(SearchOptionsContext);

    // The fallback applies only before the search options have loaded, or against a server
    // that does not send a range.
    const bounds = useMemo(() => {
        const range = searchOptions?.yearRange;
        const min = Number.isFinite(range?.min) ? range.min : 1893;
        const max = Number.isFinite(range?.max) ? range.max : new Date().getFullYear();
        return { min, max: Math.max(max, min) };
    }, [searchOptions]);

    const from = query.fromYear === "" ? bounds.min : Number(query.fromYear);
    const to = query.toYear === "" ? bounds.max : Number(query.toYear);
    const refining = query.fromMonth !== "" || query.toMonth !== "";

    const setYear = (name, value) => {
        handleChange({ target: { name, value: String(value) } });
    };

    // Handles cannot cross; dragging one past the other pushes it.
    const onFrom = (event) => setYear("fromYear", Math.min(Number(event.target.value), to));
    const onTo = (event) => setYear("toYear", Math.max(Number(event.target.value), from));

    const span = Math.max(bounds.max - bounds.min, 1);
    const leftPct = ((from - bounds.min) / span) * 100;
    const rightPct = ((to - bounds.min) / span) * 100;

    const clearRefinement = () => {
        ["fromMonth", "fromDay", "toMonth", "toDay"].forEach((name) =>
            handleChange({ target: { name, value: "" } }));
    };

    const reset = () => {
        ["fromYear", "toYear", "fromMonth", "fromDay", "toMonth", "toDay"].forEach((name) =>
            handleChange({ target: { name, value: "" } }));
    };

    return (
        <fieldset>
            <legend style={{color:"white", display:"flex", gap:"6px"}}>
                Time Range<Information blurb="timeRange"/>
            </legend>

            <div className="yearRange">
                <div className="yearRangeReadout">
                    <span className="yearRangeValue">{from}</span>
                    <span className="yearRangeTo">to</span>
                    <span className="yearRangeValue">{to}</span>
                    {(query.fromYear !== "" || query.toYear !== "") && (
                        <button type="button" className="yearRangeReset"
                                onClick={reset} disabled={isLoading}>reset</button>
                    )}
                </div>

                <div className="yearRangeTrack">
                    <div className="yearRangeFill"
                         style={{ left: `${leftPct}%`, width: `${Math.max(rightPct - leftPct, 0)}%` }} />
                    <input
                        type="range" className="yearRangeInput yearRangeFrom"
                        min={bounds.min} max={bounds.max} value={from}
                        onChange={onFrom} disabled={isLoading}
                        aria-label="Earliest year"
                    />
                    <input
                        type="range" className="yearRangeInput yearRangeToInput"
                        min={bounds.min} max={bounds.max} value={to}
                        onChange={onTo} disabled={isLoading}
                        aria-label="Latest year"
                    />
                </div>

                <div className="yearRangeBounds">
                    <span>{bounds.min}</span>
                    <span>{bounds.max}</span>
                </div>
            </div>

            <details className="timeRefine" open={refining}>
                <summary>Narrow to particular months or days</summary>
                <div className="timeRefineRow">
                    <label className="query--label" htmlFor="fromMonth">From</label>
                    <MonthSelect name="fromMonth" value={query.fromMonth}
                                 onChange={handleChange} disabled={isLoading} />
                    <DaySelect name="fromDay" value={query.fromDay} year={from}
                               month={query.fromMonth} onChange={handleChange} disabled={isLoading} />
                </div>
                <div className="timeRefineRow">
                    <label className="query--label" htmlFor="toMonth">To</label>
                    <MonthSelect name="toMonth" value={query.toMonth}
                                 onChange={handleChange} disabled={isLoading} />
                    <DaySelect name="toDay" value={query.toDay} year={to}
                               month={query.toMonth} onChange={handleChange} disabled={isLoading} />
                </div>
                {refining && (
                    <button type="button" className="yearRangeReset"
                            onClick={clearRefinement} disabled={isLoading}>
                        clear months and days
                    </button>
                )}
            </details>
        </fieldset>
    );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

function MonthSelect({ name, value, onChange, disabled }) {
    return (
        <select name={name} id={name} value={value} onChange={onChange} disabled={disabled}>
            <option value="">any month</option>
            {MONTH_NAMES.map((label, index) => {
                const month = String(index + 1).padStart(2, "0");
                return <option key={month} value={month}>{label}</option>;
            })}
        </select>
    );
}

/**
 * Days for the month chosen, or nothing to choose until one is.
 *
 * Day 0 of the following month is the last day of this one, which is leap-year correct for
 * century years where a `year % 4` test is not.
 */
function DaySelect({ name, value, year, month, onChange, disabled }) {
    const days = useMemo(() => {
        if (!month) return 0;
        return new Date(Number(year), Number(month), 0).getDate();
    }, [year, month]);

    return (
        <select name={name} id={name} value={value} onChange={onChange}
                disabled={disabled || !month}>
            <option value="">any day</option>
            {Array.from({ length: days }, (_, index) => index + 1).map((day) => (
                <option key={day} value={String(day).padStart(2, "0")}>{day}</option>
            ))}
        </select>
    );
}

export default TimeOptions;
