import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import LoadingOverlay from './LoadingOverlay';
import {
    build_taxonomy_graph, rank_depth, RANK_LABELS, RANK_ORDER,
} from '../Functions/build_taxonomy_graph';
import { graph_view_model } from '../Functions/graph_view_model';
import { graph_stylesheet, RANK_COLOURS } from '../Functions/graph_style';

cytoscape.use(fcose);

// The rank the graph opens at: the datasets, the classes in them, and the orders under those.
// Deep enough to show the shape of a search, small enough to read.
const DEFAULT_DEPTH = 2;

const LAYOUTS = {
    hierarchy: {
        label: 'Hierarchy',
        options: (roots) => ({
            name: 'breadthfirst', directed: true, roots,
            spacingFactor: 1.15, padding: 40, avoidOverlap: true, grid: true, animate: false,
        }),
    },
    spread: {
        label: 'Spread',
        options: () => ({
            name: 'fcose', quality: 'default', animate: false, padding: 40,
            nodeRepulsion: 9000, idealEdgeLength: 95, nodeSeparation: 120,
        }),
    },
};

const EMPTY_OPEN_STATE = {
    // branches opened past the chosen rank
    expanded: new Set(),
    // branches closed inside the chosen rank
    collapsed: new Set(),
    // groups whose capped remainder the user asked to see
    revealed: new Set(),
};

const CytoscapeGraph = ({ data }) => {

    const containerRef = useRef(null);
    const cyRef = useRef(null);

    // How far down the ranks the graph draws before anything is opened by hand.
    const [depth, setDepth] = useState(DEFAULT_DEPTH);
    const [layoutName, setLayoutName] = useState('hierarchy');
    const [openState, setOpenState] = useState(EMPTY_OPEN_STATE);

    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');
    const [searchNote, setSearchNote] = useState('');
    const pendingFocus = useRef(null);

    const model = useMemo(() => build_taxonomy_graph(data), [data]);

    const view = useMemo(
        () => graph_view_model(model, { depth, ...openState }),
        [model, depth, openState]
    );

    // The graph on screen is out of date while it is being rebuilt, so the overlay belongs up.
    const [rendered, setRendered] = useState(null);
    const hasResults = Boolean(data) && data.length > 0;
    const isRendering = hasResults && rendered !== view.elements;

    // Handlers run inside cytoscape and read the model and rank from here, so each one sees
    // whatever the current search produced.
    const latest = useRef({ model, depth });
    latest.current = { model, depth };

    // A new search starts the view over, so an expansion from the previous one does not
    // decide what is drawn for the next.
    useEffect(() => {
        setOpenState(EMPTY_OPEN_STATE);
        setSelectedId(null);
        setSearchNote('');
    }, [data]);

    const toggleNode = useCallback((id) => {
        setOpenState((previous) => {
            const { model: current, depth: rank } = latest.current;
            const children = current.childrenOf[id] || [];
            if (children.length === 0) return previous;

            const childDepth = rank_depth(current.nodes.get(children[0]).rank);
            const isOpen = !previous.collapsed.has(id)
                && (previous.expanded.has(id) || childDepth <= rank);

            const expanded = new Set(previous.expanded);
            const collapsed = new Set(previous.collapsed);

            if (isOpen) {
                collapsed.add(id);
                expanded.delete(id);
            } else {
                expanded.add(id);
                collapsed.delete(id);
            }

            return { ...previous, expanded, collapsed };
        });
    }, []);

    const revealGroup = useCallback((parentId) => {
        setOpenState((previous) => ({
            ...previous,
            revealed: new Set(previous.revealed).add(parentId),
        }));
    }, []);

    // Opens every branch above a node, so a node found by name is actually drawn.
    const focusOn = useCallback((nodeId) => {
        setOpenState((previous) => {
            const { model: current } = latest.current;
            const ancestors = new Set();
            const stack = [nodeId];

            while (stack.length) {
                const id = stack.pop();
                for (const parent of current.parentsOf[id] || []) {
                    if (ancestors.has(parent)) continue;
                    ancestors.add(parent);
                    stack.push(parent);
                }
            }

            return {
                expanded: new Set([...previous.expanded, ...ancestors]),
                collapsed: new Set(),
                revealed: new Set([...previous.revealed, ...ancestors]),
            };
        });
        pendingFocus.current = nodeId;
    }, []);

    const runSearch = useCallback((event) => {
        event.preventDefault();
        const term = search.trim().toLowerCase();
        if (!term) return;

        const match = Array.from(latest.current.model.nodes.values())
            .filter((node) => node.name.toLowerCase().includes(term))
            .sort((a, b) => rank_depth(a.rank) - rank_depth(b.rank) || b.count - a.count)[0];

        if (!match) {
            setSearchNote(`Nothing in this search matches "${search.trim()}"`);
            return;
        }

        setSearchNote(`${match.name} - ${RANK_LABELS[match.rank]}`);
        setSelectedId(match.id);
        focusOn(match.id);
    }, [search, focusOn]);

    const resetView = useCallback(() => {
        setOpenState(EMPTY_OPEN_STATE);
        setDepth(DEFAULT_DEPTH);
        setSelectedId(null);
        setSearch('');
        setSearchNote('');
        if (cyRef.current) cyRef.current.fit(undefined, 40);
    }, []);

    const exportImage = useCallback(() => {
        const cy = cyRef.current;
        if (!cy || cy.elements().length === 0) return;

        const blob = cy.png({ output: 'blob', full: true, scale: 2, bg: '#ffffff' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'kn-wildlife-knowledge-graph.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }, []);

    // One cytoscape instance for the life of the component.
    useEffect(() => {
        if (cyRef.current || !containerRef.current) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: [],
            style: graph_stylesheet(),
            wheelSensitivity: 0.2,
            // keep panning and zooming responsive once the graph is more than a few hundred
            // elements
            textureOnViewport: true,
            hideEdgesOnViewport: true,
            motionBlur: false,
        });

        let lastTap = { id: null, at: 0 };

        cy.on('tap', 'node', (event) => {
            const node = event.target;
            const id = node.id();

            if (node.data('kind') === 'more') {
                revealGroup(node.data('parentId'));
                return;
            }

            const now = Date.now();
            if (lastTap.id === id && now - lastTap.at < 350) {
                lastTap = { id: null, at: 0 };
                toggleNode(id);
                return;
            }

            lastTap = { id, at: now };
            setSelectedId(id);
        });

        cy.on('tap', (event) => {
            if (event.target === cy) setSelectedId(null);
        });

        // Hovering traces the path back to the root, which is what a hierarchy is usually
        // asked: what is this one inside of.
        cy.on('mouseover', 'node', (event) => {
            const node = event.target;
            const trail = node.union(node.predecessors());
            cy.elements().not(trail).addClass('faded');
            trail.addClass('trail');
        });

        cy.on('mouseout', 'node', () => {
            cy.elements().removeClass('faded').removeClass('trail');
        });

        cyRef.current = cy;

        return () => {
            cy.destroy();
            cyRef.current = null;
        };
    }, [revealGroup, toggleNode]);

    // Redraw whenever the chosen slice of the graph changes.
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        const wasEmpty = cy.elements().length === 0;

        cy.batch(() => {
            cy.elements().remove();
            cy.add(view.elements);
        });

        if (view.elements.length === 0) {
            setRendered(view.elements);
            return;
        }

        cy.nodes().addClass('laying-out');

        const roots = view.elements
            .filter((element) => !element.data.source && model.roots.includes(element.data.id))
            .map((element) => element.data.id);

        const layout = cy.layout(LAYOUTS[layoutName].options(roots));

        layout.one('layoutstop', () => {
            cy.nodes().removeClass('laying-out');

            const focus = pendingFocus.current;
            pendingFocus.current = null;

            if (focus && cy.getElementById(focus).nonempty()) {
                cy.animate(
                    { center: { eles: cy.getElementById(focus) }, zoom: 1.1 },
                    { duration: 250 }
                );
            } else if (wasEmpty) {
                cy.fit(undefined, 40);
            }

            setRendered(view.elements);
        });

        layout.run();
    }, [view, layoutName, model]);

    // Mark the selected node so it reads as chosen on the canvas as well as in the panel.
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        cy.nodes().unselect();
        if (!selectedId) return;

        const node = cy.getElementById(selectedId);
        if (node.nonempty()) node.select();
    }, [selectedId, rendered]);

    const selected = selectedId ? model.nodes.get(selectedId) : null;
    const selectedChildren = selected ? (model.childrenOf[selected.id] || []) : [];
    const childRank = selectedChildren.length > 0
        ? model.nodes.get(selectedChildren[0]).rank
        : null;
    const selectedIsOpen = Boolean(selected)
        && !openState.collapsed.has(selected.id)
        && (openState.expanded.has(selected.id)
            || (childRank !== null && rank_depth(childRank) <= depth));

    return (
        <div className="graphView">

            <div ref={containerRef} className="cytoscapeGraph"/>

            {hasResults && (
                <div className="graphToolbar">
                    <label className="graphToolbar--field">
                        <span>Show to</span>
                        <select value={depth}
                                onChange={(event) => setDepth(Number(event.target.value))}>
                            {RANK_ORDER.map((rank, index) => (
                                <option key={rank} value={index}>{RANK_LABELS[rank]}</option>
                            ))}
                        </select>
                    </label>

                    <label className="graphToolbar--field">
                        <span>Layout</span>
                        <select value={layoutName}
                                onChange={(event) => setLayoutName(event.target.value)}>
                            {Object.entries(LAYOUTS).map(([key, entry]) => (
                                <option key={key} value={key}>{entry.label}</option>
                            ))}
                        </select>
                    </label>

                    <form className="graphToolbar--search" onSubmit={runSearch}>
                        <input type="text" value={search} placeholder="Find a taxon"
                               onChange={(event) => {
                                   setSearch(event.target.value);
                                   setSearchNote('');
                               }}/>
                        <button type="submit" className="graphToolbar--button">Find</button>
                    </form>

                    <button type="button" className="graphToolbar--button"
                            onClick={() => cyRef.current && cyRef.current.fit(undefined, 40)}>
                        Fit
                    </button>
                    <button type="button" className="graphToolbar--button" onClick={resetView}>
                        Reset
                    </button>
                    <button type="button" className="graphToolbar--button" onClick={exportImage}>
                        PNG
                    </button>
                </div>
            )}

            {hasResults && (
                <div className="graphSummary">
                    <span>
                        {view.shown.toLocaleString()} of {view.total.toLocaleString()} nodes shown
                    </span>
                    {view.clamped && (
                        <span className="graphSummary--note">
                            {RANK_LABELS[RANK_ORDER[depth]]} would draw more than can be read.
                            Showing to {RANK_LABELS[RANK_ORDER[view.effectiveDepth]].toLowerCase()}.
                        </span>
                    )}
                    {searchNote && <span className="graphSummary--note">{searchNote}</span>}
                </div>
            )}

            {hasResults && (
                <div className="graphLegend">
                    {view.byRank.filter((entry) => entry.total > 0).map((entry) => (
                        <div key={entry.rank} className="graphLegend--row">
                            <span className="graphLegend--swatch"
                                  style={{ backgroundColor: RANK_COLOURS[entry.rank] }}/>
                            <span className="graphLegend--name">{RANK_LABELS[entry.rank]}</span>
                            <span className="graphLegend--count">
                                {entry.shown} / {entry.total}
                            </span>
                        </div>
                    ))}
                    <p className="graphLegend--hint">
                        Circle size is how many records a node covers. Double-click one to open
                        or close it.
                    </p>
                </div>
            )}

            {selected && (
                <aside className="graphDetails">
                    <div className="graphDetails--head">
                        <span className="graphDetails--rank"
                              style={{ backgroundColor: RANK_COLOURS[selected.rank] }}>
                            {RANK_LABELS[selected.rank]}
                        </span>
                        <button type="button" className="graphDetails--close"
                                onClick={() => setSelectedId(null)}
                                aria-label="Close details">
                            &times;
                        </button>
                    </div>

                    <h3 className="graphDetails--name">{selected.name}</h3>

                    <dl className="graphDetails--facts">
                        <dt>Records</dt>
                        <dd>{selected.count.toLocaleString()}</dd>

                        <dt>Share of search</dt>
                        <dd>
                            {model.rowCount
                                ? ((selected.count / model.rowCount) * 100).toFixed(1)
                                : '0.0'}%
                        </dd>

                        {selected.childCount > 0 && (
                            <>
                                <dt>Directly below</dt>
                                <dd>
                                    {selected.childCount.toLocaleString()}
                                    {' '}
                                    {RANK_LABELS[childRank].toLowerCase()}
                                    {selected.childCount === 1 ? '' : 's'}
                                </dd>
                            </>
                        )}
                    </dl>

                    {selected.childCount > 0 && (
                        <button type="button" className="graphDetails--action"
                                onClick={() => toggleNode(selected.id)}>
                            {selectedIsOpen
                                ? 'Collapse'
                                : `Expand ${selected.childCount.toLocaleString()}`}
                        </button>
                    )}
                </aside>
            )}

            {!hasResults && (
                <p className="graphEmpty">Run a search to build the knowledge graph.</p>
            )}

            {isRendering && <LoadingOverlay viewport="cytoscape"/>}
        </div>
    );
};

export default CytoscapeGraph;
