// Colours and cytoscape styling for the knowledge graph view.
//
// The taxonomic ranks share one hue and step from dark to light as the rank gets finer, so
// depth in the hierarchy is readable without consulting the legend. Datasets sit outside that
// scale and take a warm colour, because they are a different kind of thing from a taxon.

const RANK_COLOURS = {
    dataset: "#b0651f",
    class: "#123f66",
    order: "#1b5c93",
    family: "#2f7fbf",
    genus: "#6aa8db",
    species: "#a9cdea",
};

const MORE_COLOUR = "#7d8b98";
const EDGE_COLOUR = "#c3d0da";

function graph_stylesheet() {

    const rankSelectors = Object.entries(RANK_COLOURS).map(([rank, colour]) => ({
        selector: `node[rank = "${rank}"]`,
        style: { "background-color": colour },
    }));

    return [
        {
            selector: "node",
            style: {
                width: "data(size)",
                height: "data(size)",
                "border-width": 2,
                "border-color": "rgba(255, 255, 255, 0.9)",
                label: "data(label)",
                "font-family": "Roboto, sans-serif",
                "font-size": 12,
                color: "#1d2b36",
                "text-valign": "bottom",
                "text-margin-y": 4,
                "text-outline-width": 3,
                "text-outline-color": "#ffffff",
                // Labels are opt-in. A dense graph with every name drawn is unreadable, so
                // only the upper ranks and the largest nodes carry one until they are hovered.
                "text-opacity": 0,
                "min-zoomed-font-size": 9,
            },
        },
        ...rankSelectors,
        {
            selector: "node[showLabel = 1]",
            style: { "text-opacity": 1 },
        },
        {
            // The remainder of a group that was capped. It is a control, so it is drawn as a
            // pill with its count inside.
            selector: 'node[kind = "more"]',
            style: {
                "background-color": MORE_COLOUR,
                shape: "round-rectangle",
                height: 20,
                "text-valign": "center",
                "text-margin-y": 0,
                color: "#ffffff",
                "text-outline-color": MORE_COLOUR,
                "text-outline-width": 2,
                "text-opacity": 1,
                "font-size": 11,
            },
        },
        {
            selector: "edge",
            style: {
                width: 1.5,
                "line-color": EDGE_COLOUR,
                "curve-style": "bezier",
                // Edges are drawn parent to child so the hierarchical layout walks downwards.
                // The arrowhead goes on the source end, so it points from the child up to its
                // parent, which is the direction BELONGS_TO reads.
                "source-arrow-shape": "triangle",
                "source-arrow-color": EDGE_COLOUR,
                "arrow-scale": 0.7,
                label: "data(type)",
                "font-family": "Roboto, sans-serif",
                "font-size": 10,
                color: "#5b6b78",
                "text-opacity": 0,
                "text-background-color": "#ffffff",
                "text-background-opacity": 0.85,
                "text-background-padding": 2,
            },
        },
        {
            selector: "node.trail, edge.trail",
            style: { "text-opacity": 1, "z-index": 20 },
        },
        {
            selector: "node.trail",
            style: { "border-color": "#1d2b36", "border-width": 3 },
        },
        {
            selector: "edge.trail",
            style: { "line-color": "#5b6b78", "source-arrow-color": "#5b6b78", width: 2.5 },
        },
        {
            selector: ".faded",
            style: { opacity: 0.12, "text-opacity": 0 },
        },
        {
            selector: "node:selected",
            style: {
                "border-color": "#1d2b36",
                "border-width": 4,
                "text-opacity": 1,
            },
        },
        {
            // Held while a layout runs. Drawing labels through a layout is the slowest part
            // of settling a large graph.
            selector: ".laying-out",
            style: { "text-opacity": 0 },
        },
    ];
}

export { RANK_COLOURS, MORE_COLOUR, graph_stylesheet };
