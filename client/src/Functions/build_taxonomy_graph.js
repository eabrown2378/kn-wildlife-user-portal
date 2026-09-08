// Builds the knowledge graph the graph view draws, from the same observation rows the table
// and the download are made of.
//
// Each row is one observation of one organism. It names every rank that was resolved for that
// identification and the dataset the record came from, so the rows already hold the whole
// backbone; nothing extra has to be asked of the database, and the counts here agree with the
// table exactly. An identification that stopped at a higher rank leaves the ranks below it
// empty, so a chain ends wherever the identification ended.

const TAXON_RANKS = ["class", "order", "family", "genus", "species"];

// Datasets sit above the taxonomy, so a root of the graph is the dataset a record came from.
const RANK_ORDER = ["dataset", ...TAXON_RANKS];

const RANK_LABELS = {
    dataset: "Dataset",
    class: "Class",
    order: "Order",
    family: "Family",
    genus: "Genus",
    species: "Species",
};

const rank_depth = (rank) => RANK_ORDER.indexOf(rank);

const node_id = (rank, name) => rank + "|" + name;

function build_taxonomy_graph(rows) {

    const nodes = new Map();
    const edges = new Map();
    const childIds = new Map();
    const parentIds = new Map();
    const hasParent = new Set();

    const countNode = (rank, name) => {
        const id = node_id(rank, name);
        let node = nodes.get(id);
        if (!node) {
            node = { id, rank, name, count: 0 };
            nodes.set(id, node);
        }
        node.count += 1;
        return node;
    };

    // Edges run from parent to child, which is the direction the hierarchical layout walks.
    // The arrowhead is drawn at the source end so it still points from the child to its
    // parent, the way BELONGS_TO reads.
    const countEdge = (parentId, childId, type) => {
        const id = parentId + ">" + childId;
        let edge = edges.get(id);
        if (!edge) {
            edge = { id, source: parentId, target: childId, type, count: 0 };
            edges.set(id, edge);
            if (!childIds.has(parentId)) childIds.set(parentId, new Set());
            childIds.get(parentId).add(childId);
            if (!parentIds.has(childId)) parentIds.set(childId, new Set());
            parentIds.get(childId).add(parentId);
            hasParent.add(childId);
        }
        edge.count += 1;
    };

    for (const row of rows || []) {

        const chain = [];
        for (const rank of TAXON_RANKS) {
            const name = row[rank];
            if (name === null || name === undefined || name === "") break;
            chain.push(countNode(rank, name));
        }

        if (chain.length === 0) continue;

        for (let i = 1; i < chain.length; i += 1) {
            countEdge(chain[i - 1].id, chain[i].id, "BELONGS_TO");
        }

        if (row.dataset) {
            const dataset = countNode("dataset", row.dataset);
            countEdge(dataset.id, chain[0].id, "FROM_DATASET");
        }
    }

    // Children are ordered by how many observations they carry, so a group that is capped
    // shows the taxa the search is mostly made of.
    const childrenOf = {};
    for (const [parentId, ids] of childIds) {
        childrenOf[parentId] = Array.from(ids).sort((a, b) => {
            const left = nodes.get(a);
            const right = nodes.get(b);
            return right.count - left.count || left.name.localeCompare(right.name);
        });
    }

    for (const node of nodes.values()) {
        node.childCount = (childrenOf[node.id] || []).length;
    }

    // Every way up from a node, so opening a search result can open the branches above it.
    const parentsOf = {};
    for (const [childId, ids] of parentIds) parentsOf[childId] = Array.from(ids);

    const totals = {};
    for (const rank of RANK_ORDER) totals[rank] = 0;
    for (const node of nodes.values()) totals[node.rank] += 1;

    const roots = Array.from(nodes.values())
        .filter((node) => !hasParent.has(node.id))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map((node) => node.id);

    return {
        nodes,
        edges: Array.from(edges.values()),
        childrenOf,
        parentsOf,
        roots,
        totals,
        rowCount: (rows || []).length,
    };
}

export { build_taxonomy_graph, RANK_ORDER, RANK_LABELS, TAXON_RANKS, rank_depth, node_id };
