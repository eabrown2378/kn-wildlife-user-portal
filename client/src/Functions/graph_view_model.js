// Chooses the part of the taxonomy the graph draws, and turns it into cytoscape elements.
//
// A search can resolve to thousands of taxa. Drawing all of them at once says nothing, so the
// graph opens at a shallow rank and grows where the user asks it to: a rank chosen from the
// toolbar sets the base, and expanding a node reaches past that base for that branch alone.
// Within one parent only the largest groups are drawn, with the remainder behind a node that
// says how many are left.

import { rank_depth, RANK_ORDER } from "./build_taxonomy_graph";

// How many children one parent draws before the rest go behind a "+n more" node.
const CHILD_CAP = 10;

// The most nodes worth drawing at once. Past this the layout is unreadable and slow, so the
// requested rank is stepped back until the graph fits and the view reports what it did.
const MAX_NODES = 1200;

// Labels are drawn for the upper ranks and for the largest nodes. Everything else shows its
// name on hover or when selected, which keeps a dense graph readable.
const ALWAYS_LABELLED_DEPTH = 2;
const LABELLED_BY_SIZE = 40;

const more_id = (parentId) => "more|" + parentId;

// Walks out from the roots, taking children where the chosen rank or an expanded node allows.
function collect_visible(model, depth, expanded, collapsed, revealed) {

    const visible = new Map();
    const capped = new Map();
    const queue = [];

    for (const id of model.roots) {
        const node = model.nodes.get(id);
        if (!node) continue;
        visible.set(id, node);
        queue.push(id);
    }

    while (queue.length) {
        const parentId = queue.shift();
        const children = model.childrenOf[parentId] || [];
        if (children.length === 0) continue;

        const childDepth = rank_depth(model.nodes.get(children[0]).rank);
        const wanted = expanded.has(parentId) || childDepth <= depth;
        if (!wanted || collapsed.has(parentId)) continue;

        const limit = revealed.has(parentId) ? children.length : CHILD_CAP;
        const shown = children.slice(0, limit);

        for (const childId of shown) {
            if (!visible.has(childId)) {
                visible.set(childId, model.nodes.get(childId));
                queue.push(childId);
            }
        }

        if (children.length > shown.length) {
            capped.set(parentId, children.length - shown.length);
        }
    }

    return { visible, capped };
}

function graph_view_model(model, { depth, expanded, collapsed, revealed }) {

    if (!model || model.nodes.size === 0) {
        return { elements: [], shown: 0, total: 0, effectiveDepth: depth, clamped: false };
    }

    // Step the rank back until the graph is a size worth drawing. An expanded branch is the
    // user's own choice and is kept whatever the rank ends up being.
    let effectiveDepth = depth;
    let picked = collect_visible(model, effectiveDepth, expanded, collapsed, revealed);
    while (picked.visible.size > MAX_NODES && effectiveDepth > 1) {
        effectiveDepth -= 1;
        picked = collect_visible(model, effectiveDepth, expanded, collapsed, revealed);
    }

    const { visible, capped } = picked;

    // Node area carries the number of observations. Counts run over orders of magnitude, so
    // the scale is logarithmic; without that the largest taxon flattens everything else.
    const counts = Array.from(visible.values(), (node) => node.count);
    const low = Math.log(Math.min(...counts) + 1);
    const high = Math.log(Math.max(...counts) + 1);
    const span = high - low;
    const sizeOf = (count) => {
        if (span <= 0) return 34;
        return 18 + 46 * ((Math.log(count + 1) - low) / span);
    };

    const bySize = Array.from(visible.values()).sort((a, b) => b.count - a.count);
    const labelled = new Set(bySize.slice(0, LABELLED_BY_SIZE).map((node) => node.id));

    const elements = [];

    for (const node of visible.values()) {
        const hidden = node.childCount - (model.childrenOf[node.id] || [])
            .filter((id) => visible.has(id)).length;

        elements.push({
            data: {
                id: node.id,
                kind: "taxon",
                rank: node.rank,
                name: node.name,
                count: node.count,
                childCount: node.childCount,
                hiddenChildren: Math.max(hidden, 0),
                label: hidden > 0 ? `${node.name} (${hidden})` : node.name,
                size: sizeOf(node.count),
                showLabel: rank_depth(node.rank) <= ALWAYS_LABELLED_DEPTH
                    || labelled.has(node.id) ? 1 : 0,
            },
        });
    }

    for (const [parentId, remaining] of capped) {
        const parent = model.nodes.get(parentId);
        const childRank = model.nodes.get(model.childrenOf[parentId][0]).rank;
        const id = more_id(parentId);

        elements.push({
            data: {
                id,
                kind: "more",
                rank: childRank,
                name: `${remaining} more ${childRank}`,
                parentId,
                label: `+${remaining} more`,
                // The pill is sized from its own text, so cytoscape is never asked to derive
                // a width from the label.
                size: Math.round(7.3 * `+${remaining} more`.length + 20),
                showLabel: 1,
                count: parent.count,
            },
        });
        elements.push({ data: { id: parentId + ">" + id, source: parentId, target: id, type: "MORE" } });
    }

    for (const edge of model.edges) {
        if (visible.has(edge.source) && visible.has(edge.target)) {
            elements.push({
                data: {
                    id: edge.id, source: edge.source, target: edge.target,
                    type: edge.type, count: edge.count,
                },
            });
        }
    }

    return {
        elements,
        shown: visible.size,
        total: model.nodes.size,
        effectiveDepth,
        clamped: effectiveDepth < depth,
        byRank: RANK_ORDER.map((rank) => ({
            rank,
            shown: Array.from(visible.values()).filter((n) => n.rank === rank).length,
            total: model.totals[rank] || 0,
        })),
    };
}

export { graph_view_model, more_id, CHILD_CAP, MAX_NODES };
