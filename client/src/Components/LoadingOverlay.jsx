import CircularProgress from '@mui/material/CircularProgress';

// messages describing what is being built for the view the user is currently on
const viewportMessages = {
    leaflet: "Plotting observations on the map",
    cytoscape: "Building the knowledge graph",
    table: "Assembling the data table"
};

function LoadingOverlay({ viewport }) {

    return (
        <div className="loadingOverlay" role="status" aria-live="polite">
            <CircularProgress className="loadingOverlay--spinner" size="4vh" thickness={4} />
            <p className="loadingOverlay--message">
                {viewportMessages[viewport] || "Retrieving your results"}
            </p>
            <p className="loadingOverlay--subtext">
                Large searches can take a moment to come back from the database.
            </p>
            <div className="loadingOverlay--bar">
                <div className="loadingOverlay--barFill" />
            </div>
        </div>
    );
}

export default LoadingOverlay;
