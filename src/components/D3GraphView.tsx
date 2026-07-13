import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Standard } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

interface D3GraphViewProps {
  standards: (Standard & { isGreyedOut?: boolean })[];
  selectedNode: Standard | null;
  onSelectNode: (standard: Standard) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  relationType: 'activity' | 'process' | 'task';
  standard: Standard & { isGreyedOut?: boolean };
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export default function D3GraphView({ standards, selectedNode, onSelectNode }: D3GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<Standard | null>(null);

  // Parse nodes and links
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    
    // Create nodes
    standards.forEach(s => {
      nodeMap.set(s.id, {
        id: s.id,
        name: s.name,
        relationType: s.relationType || 'task',
        standard: s,
      });
    });

    const parsedNodes = Array.from(nodeMap.values());
    const parsedLinks: GraphLink[] = [];
    const addedPairs = new Set<string>();

    // Create links
    standards.forEach(s => {
      if (s.relatedStandardIds) {
        s.relatedStandardIds.forEach(targetId => {
          if (nodeMap.has(s.id) && nodeMap.has(targetId)) {
            // Undirected connection deduplication key
            const pairKey = [s.id, targetId].sort().join('-');
            if (!addedPairs.has(pairKey)) {
              addedPairs.add(pairKey);
              parsedLinks.push({
                source: s.id,
                target: targetId,
              });
            }
          }
        });
      }
    });

    return { nodes: parsedNodes, links: parsedLinks };
  }, [standards]);

  // Handle D3 force directed graph simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;

    // Reset SVG content
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create a main container group that can zoom and pan
    const g = svg.append('g').attr('class', 'graph-content');

    // Create arrows for directed relationship indicator (optional, but nice)
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow-head')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22) // Place arrow head at edge of node circle
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#94a3b8');

    // Set up D3 Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom as any);

    // Initial center fit
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(width / 2, height / 2).scale(1.2));

    // Force simulation with fine-tuned parameters for Obsidian-like fluid inertial movement
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(110)
        .strength(0.8)
      )
      .force('charge', d3.forceManyBody().strength(-240))
      .force('collision', d3.forceCollide().radius(35).strength(0.6))
      .force('x', d3.forceX(0).strength(0.06))
      .force('y', d3.forceY(0).strength(0.06))
      .velocityDecay(0.35); // Lower values make movement feel slidey and fluid (inertia)

    // Build lists of direct connections for focus/dimming effects
    const connectionMap = new Map<string, Set<string>>();
    nodes.forEach(n => {
      connectionMap.set(n.id, new Set<string>([n.id]));
    });
    links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : (l.source as string);
      const targetId = typeof l.target === 'object' ? l.target.id : (l.target as string);
      
      connectionMap.get(sourceId)?.add(targetId);
      connectionMap.get(targetId)?.add(sourceId);
    });

    // Node degree (for scaling node sizes)
    const degreeMap = new Map<string, number>();
    nodes.forEach(n => degreeMap.set(n.id, 1));
    links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : (l.source as string);
      const targetId = typeof l.target === 'object' ? l.target.id : (l.target as string);
      degreeMap.set(sourceId, (degreeMap.get(sourceId) || 0) + 1);
      degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
    });

    // Render Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.75)
      .attr('stroke-dasharray', '3,3');

    // Create Node Containers
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Inner shadow or outer pulse rings for selection
    const halo = node.append('circle')
      .attr('class', 'halo')
      .attr('r', d => Math.max(14, 11 + (degreeMap.get(d.id) || 1) * 1.5))
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0)
      .attr('class', 'transition-all duration-300');

    // Render Node Circles
    const circle = node.append('circle')
      .attr('r', d => Math.max(9, 7 + (degreeMap.get(d.id) || 1) * 1.2))
      .attr('class', 'node-circle')
      .attr('fill', d => {
        if (d.standard.isGreyedOut) return '#cbd5e1'; // Slate-300 grey for greyed out
        if (d.relationType === 'activity') return '#f59e0b'; // Amber
        if (d.relationType === 'process') return '#8b5cf6'; // Purple
        return '#3b82f6'; // Blue
      })
      .attr('stroke', d => {
        if (d.standard.isGreyedOut) return '#94a3b8'; // Slate-400 grey stroke
        if (d.relationType === 'activity') return '#b45309';
        if (d.relationType === 'process') return '#6d28d9';
        return '#1d4ed8';
      })
      .attr('stroke-width', 2.5);

    // Node Type Initials (Inside the circle)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('fill', d => d.standard.isGreyedOut ? '#64748b' : '#ffffff')
      .attr('font-size', d => Math.max(8, 7 + (degreeMap.get(d.id) || 1) * 0.4) + 'px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text(d => d.relationType === 'activity' ? 'A' : d.relationType === 'process' ? 'P' : 'T');

    // Render Text Labels
    const label = node.append('text')
      .attr('dx', 14)
      .attr('dy', '.35em')
      .attr('font-family', 'sans-serif')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', d => d.standard.isGreyedOut ? '#94a3b8' : '#1e293b')
      .attr('class', 'node-label')
      .style('pointer-events', 'none')
      .style('opacity', 0) // Hidden by default
      .style('transition', 'opacity 0.2s ease, transform 0.2s ease')
      .text(d => d.name.length > 28 ? `${d.name.substring(0, 25)}...` : d.name);

    // Define interactive focus/dimming state updater
    const updateFocusStates = (activeId: string | null) => {
      if (activeId) {
        const allowed = connectionMap.get(activeId) || new Set<string>();
        
        // Dim un-connected nodes and links
        circle.style('opacity', d => {
          if (!allowed.has(d.id)) return 0.15;
          return d.standard.isGreyedOut ? 0.4 : 1.0;
        });
        node.selectAll('text').style('opacity', function(d: any) {
          const isLabel = d3.select(this as any).classed('node-label');
          if (isLabel) {
            return d.id === activeId || allowed.has(d.id) ? (d.standard.isGreyedOut ? 0.5 : 1.0) : 0.0;
          }
          if (!allowed.has(d.id)) return 0.15;
          return d.standard.isGreyedOut ? 0.5 : 1.0;
        });
        
        halo.style('stroke-opacity', d => d.id === activeId ? 0.6 : 0);
        link
          .attr('stroke-opacity', d => {
            const srcId = typeof d.source === 'object' ? d.source.id : (d.source as string);
            const dstId = typeof d.target === 'object' ? d.target.id : (d.target as string);
            const isRelated = srcId === activeId || dstId === activeId;
            if (!isRelated) return 0.05;
            
            const src = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
            const dst = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
            if (src?.standard?.isGreyedOut || dst?.standard?.isGreyedOut) {
              return 0.4;
            }
            return 0.95;
          })
          .attr('stroke', d => {
            const srcId = typeof d.source === 'object' ? d.source.id : (d.source as string);
            const dstId = typeof d.target === 'object' ? d.target.id : (d.target as string);
            return (srcId === activeId || dstId === activeId) ? '#3b82f6' : '#94a3b8';
          })
          .attr('stroke-width', d => {
            const srcId = typeof d.source === 'object' ? d.source.id : (d.source as string);
            const dstId = typeof d.target === 'object' ? d.target.id : (d.target as string);
            return (srcId === activeId || dstId === activeId) ? 3.0 : 1.5;
          });
      } else {
        // Reset state
        circle.style('opacity', d => d.standard.isGreyedOut ? 0.4 : 1.0);
        node.selectAll('text').style('opacity', function(d: any) {
          if (d3.select(this as any).classed('node-label')) {
            return selectedNode?.id === d.id ? (d.standard.isGreyedOut ? 0.5 : 1.0) : 0.0;
          }
          return d.standard.isGreyedOut ? 0.5 : 1.0;
        });
        halo.style('stroke-opacity', d => selectedNode?.id === d.id ? 0.6 : 0);
        link
          .attr('stroke-opacity', d => {
            const src = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
            const dst = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
            if (src?.standard?.isGreyedOut || dst?.standard?.isGreyedOut) {
              return 0.25;
            }
            return 0.75;
          })
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5);
      }
    };

    // Hover events
    node.on('mouseenter', (event, d) => {
      setHoveredNode(d.standard);
      updateFocusStates(d.id);
    });

    node.on('mouseleave', () => {
      setHoveredNode(null);
      // Revert focus state back to selectedNode if any, or default
      updateFocusStates(selectedNode?.id || null);
    });

    // Click event
    node.on('click', (event, d) => {
      event.stopPropagation();
      onSelectNode(d.standard);
    });

    // SVG background click resets selection
    svg.on('click', () => {
      // Just deselect if background is clicked
    });

    // Drag behavior with smooth inertia injection
    const drag = d3.drag<any, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        // Prevent nodes from being dragged outside of sensible logic boundaries
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; // Re-enables D3 forces upon release (inertia effect)
        d.fy = null;
      });

    node.call(drag as any);

    // Simulation tick logic
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Initialize/sync default selected standard view
    updateFocusStates(selectedNode?.id || null);

    return () => {
      simulation.stop();
    };
  }, [nodes, links, selectedNode]);

  // Direct actions helper
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.75);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth || 800;
      const height = containerRef.current.clientHeight || 500;
      d3.select(svgRef.current).transition().duration(350).call(
        zoomBehaviorRef.current.transform, 
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1.2)
      );
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[460px] relative">
      {/* Quick info toolbar */}
      <div className="absolute top-3 left-3 z-10 flex gap-1.5">
        <button
          onClick={handleZoomIn}
          className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg shadow-sm transition-all cursor-pointer"
          title="Acercar"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg shadow-sm transition-all cursor-pointer"
          title="Alejar"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg shadow-sm transition-all cursor-pointer"
          title="Centrar Grafo"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm border border-gray-150 px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold pointer-events-none">
        <HelpCircle size={13} className="text-blue-500" />
        <span>Usa Scroll / Arrastrar para explorar</span>
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="flex-1 bg-slate-50 border border-gray-100 rounded-xl overflow-hidden relative min-h-[420px]">
        {standards.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-gray-400">
            <svg className="w-12 h-12 text-gray-300 stroke-[1.2] mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-xs font-semibold text-gray-500">No hay estándares que coincidan</p>
          </div>
        ) : (
          <svg 
            ref={svgRef} 
            className="w-full h-full block"
            style={{ minHeight: '420px' }}
          />
        )}
      </div>

      {/* Graph Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-3 text-[11px] text-gray-500 font-medium pb-1.5">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
          <span>Área (A)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 block"></span>
          <span>Proceso (P)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>
          <span>Tarea (T)</span>
        </span>
      </div>
    </div>
  );
}
