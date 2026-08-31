/**
 * One appearance for every react-select dropdown in the search panel.
 *
 * The dropdowns arrived with react-select's default look: a white box with black text, sitting
 * in a dark panel beside the taxonomy and place browsers, which are dark and use blue chips.
 * This gives them the panel's own colours, so the Datasets and Covariates fields read as part
 * of the same interface as the fields above them.
 *
 * react-select renders through inline styles, so it cannot be reached from the stylesheet and
 * the values are repeated here. They are the same ones App.css uses: the accent #C2E5D3, the
 * field background rgb(58,58,58), and the chip blue #2f7fbf.
 */

const ACCENT = "#C2E5D3";
const FIELD = "rgb(58, 58, 58)";
const FIELD_BORDER = "#6d8b7c";
const PANEL = "rgb(42, 42, 42)";
const CHIP = "#2f7fbf";

const selectStyles = {
    control: (base, state) => ({
        ...base,
        backgroundColor: FIELD,
        borderColor: state.isFocused ? ACCENT : FIELD_BORDER,
        boxShadow: "none",
        minHeight: "34px",
        ":hover": { borderColor: ACCENT },
    }),
    valueContainer: (base) => ({ ...base, padding: "2px 6px" }),
    input: (base) => ({ ...base, color: "white", margin: 0, paddingTop: 0, paddingBottom: 0 }),
    singleValue: (base) => ({ ...base, color: "white" }),
    placeholder: (base) => ({ ...base, color: "rgba(255, 255, 255, 0.55)" }),

    // The menu sits above the panel below it, and above the leaflet map when the search
    // column overlaps it.
    menu: (base) => ({ ...base, backgroundColor: PANEL, zIndex: 20 }),
    menuPortal: (base) => ({ ...base, zIndex: 20 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? CHIP : state.isFocused ? FIELD : PANEL,
        color: "white",
        ":active": { backgroundColor: CHIP },
    }),
    noOptionsMessage: (base) => ({ ...base, color: "rgba(255, 255, 255, 0.6)" }),

    // Selections read as the same chips the taxonomy and place browsers use.
    multiValue: (base) => ({ ...base, backgroundColor: CHIP, borderRadius: "999px" }),
    multiValueLabel: (base) => ({ ...base, color: "white", fontSize: "0.88em" }),
    multiValueRemove: (base) => ({
        ...base,
        color: "white",
        borderRadius: "0 999px 999px 0",
        ":hover": { backgroundColor: "rgba(0, 0, 0, 0.25)", color: "white" },
    }),

    indicatorSeparator: (base) => ({ ...base, backgroundColor: FIELD_BORDER }),
    dropdownIndicator: (base) => ({
        ...base,
        color: "rgba(255, 255, 255, 0.6)",
        ":hover": { color: ACCENT },
    }),
    clearIndicator: (base) => ({
        ...base,
        color: "rgba(255, 255, 255, 0.6)",
        ":hover": { color: ACCENT },
    }),
};

export { selectStyles };
