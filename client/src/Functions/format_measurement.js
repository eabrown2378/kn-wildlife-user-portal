// Render a measured value so it stays readable across the range the data actually spans.
//
// Density values in these datasets cover many orders of magnitude: a common macroinvertebrate
// might be recorded at several hundred per square metre, a rare one at a few ten-thousandths.
// The popup used to render these with toFixed(2), which turns 0.0000123 into "0.00" and then
// Number() turns that into 0. The value did not merely look wrong, it was reported as absent:
// a real detection shown as zero.
//
// Fixed decimals cannot serve both ends of that range, so the format follows the magnitude.
// Values comfortably within human reading range keep ordinary decimal notation with
// thousands separators; values too small or too large for it switch to scientific notation,
// where the exponent carries the information the decimals cannot.

// Below this a fixed-decimal rendering starts losing significant digits.
const SMALL = 1e-3;
// Above this the digits stop being readable and the magnitude is the point.
const LARGE = 1e7;

/**
 * Format a numeric measurement for display.
 *
 * @param {number|string|null|undefined} value the measured value
 * @param {number} significantDigits digits to keep in scientific notation
 * @returns {string} the formatted value, or an empty string when there is nothing to show
 */
function format_measurement(value, significantDigits = 3) {
    if (value === null || value === undefined || value === "") return "";

    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (number === 0) return "0";

    const magnitude = Math.abs(number);

    if (magnitude < SMALL || magnitude >= LARGE) {
        // toExponential gives "1.23e-5"; render the exponent the way it is written rather
        // than leaving the bare "e", which reads as a typo in a popup
        const [mantissa, exponent] = number.toExponential(significantDigits - 1).split("e");
        const trimmed = mantissa.replace(/\.?0+$/, "");
        return `${trimmed} × 10^${Number(exponent)}`;
    }

    // Keep enough decimals to distinguish small values without printing noise on large ones.
    const decimals = magnitude >= 100 ? 1 : magnitude >= 1 ? 2 : 4;
    return Number(number.toFixed(decimals)).toLocaleString(undefined, {
        maximumFractionDigits: decimals,
    });
}

export { format_measurement };
