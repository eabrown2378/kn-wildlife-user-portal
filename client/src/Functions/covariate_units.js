// Units are stored spelled out, because a download header reads better with the full word.
// On screen the symbol is enough and keeps a long list of covariates scannable.
function unitSymbol(units) {
    const text = String(units).toLowerCase();
    if (text.includes("celsius")) return "°C";
    if (text.includes("millimetre") || text.includes("millimeter")) return "mm";
    if (text.includes("metre") || text.includes("meter")) return "m";
    if (text.includes("percent")) return "%";
    return units;
}

export { unitSymbol };
