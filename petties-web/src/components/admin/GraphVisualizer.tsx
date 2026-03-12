import { useEffect, useRef, useState } from 'react'
import type { KGVisualizeResponse } from '../../services/agentService'

interface GraphVisualizerProps {
  data: KGVisualizeResponse
  width?: number
  height?: number
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  label: string
  type: string
}

interface D3Link {
  label: string
  // d3 will mutate these to D3Node references; keep broad typing
  source: string | D3Node
  target: string | D3Node
}

export const GraphVisualizer = ({ data, height = 500 }: GraphVisualizerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [loading, setLoading] = useState(true)
  const [actualWidth, setActualWidth] = useState(800)

  // Measure container width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.getBoundingClientRect().width
        if (w > 0) setActualWidth(w)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (!data?.nodes?.length || !svgRef.current || actualWidth <= 0) {
      setLoading(false)
      return
    }

    setLoading(true)

    // Dynamic import d3
    import('d3').then((d3Module) => {
      const d3 = d3Module as typeof import('d3')

      // Clear previous
      const svg = d3.select(svgRef.current as SVGSVGElement)
      svg.selectAll('*').remove()

      // Create container with zoom
      const g = svg.append('g')

      // Add zoom
      const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr('transform', event.transform.toString())
        })
      ;(svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior)

      // Prepare data
      const nodes: D3Node[] = data.nodes.map((n) => ({ ...n }))
      const links: D3Link[] = data.edges.map((e) => ({
        label: e.label,
        source: e.source,
        target: e.target,
      }))

      // Color scale
      const colorScale = d3.scaleOrdinal<string>()
        .domain(['subject', 'object'])
        .range(['#f59e0b', '#3b82f6'])

      // Arrow marker
      svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .append('path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', '#64748b')

      // Simulation
      const simulation = d3.forceSimulation<D3Node>(nodes)
        .force('link', d3.forceLink<D3Node, D3Link>(links).id((d) => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(actualWidth / 2, height / 2))
        .force('collide', d3.forceCollide(40))

      // Links
      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)')

      // Link labels (background rect + text for readability)
      const linkLabelGroup = g.append('g')
        .selectAll('g')
        .data(links)
        .join('g')

      linkLabelGroup.append('rect')
        .attr('fill', 'white')
        .attr('rx', 4)
        .attr('opacity', 0.9)

      linkLabelGroup.append('text')
        .text((d) => d.label)
        .attr('font-size', 10)
        .attr('fill', '#7c3aed')
        .attr('font-weight', 'bold')
        .attr('text-anchor', 'middle')
        .attr('dy', 4)

      // Measure text and set rect sizes
      linkLabelGroup.each(function () {
        const group = d3.select(this)
        const text = group.select('text')
        const bbox = (text.node() as SVGTextElement)?.getBBox()
        if (bbox) {
          group.select('rect')
            .attr('width', bbox.width + 8)
            .attr('height', bbox.height + 4)
            .attr('x', -bbox.width / 2 - 4)
            .attr('y', -bbox.height / 2 - 2)
        }
      })

      // Nodes
      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')

      const dragBehavior = d3.drag<any, any>()
        .on('start', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('end', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })

      ;(node as any).call(dragBehavior as any)

      // Node circles
      node.append('circle')
        .attr('r', 14)
        .attr('fill', (d) => colorScale(d.type))
        .attr('stroke', '#1c1917')
        .attr('stroke-width', 2.5)
        .attr('cursor', 'grab')

      // Node labels
      node.append('text')
        .text((d) => d.label.length > 20 ? d.label.slice(0, 20) + '...' : d.label)
        .attr('x', 18)
        .attr('y', 5)
        .attr('font-size', 12)
        .attr('font-weight', 'bold')
        .attr('fill', '#1c1917')

      // Tooltip on hover
      node.append('title')
        .text((d) => d.label)

      // Update positions
      simulation.on('tick', () => {
        link
          .attr('x1', (d) => ((d.source as unknown) as D3Node).x!)
          .attr('y1', (d) => ((d.source as unknown) as D3Node).y!)
          .attr('x2', (d) => ((d.target as unknown) as D3Node).x!)
          .attr('y2', (d) => ((d.target as unknown) as D3Node).y!)

        linkLabelGroup
          .attr('transform', (d) => {
            const sourceNode = (d.source as unknown) as D3Node
            const targetNode = (d.target as unknown) as D3Node
            const x = ((sourceNode.x || 0) + (targetNode.x || 0)) / 2
            const y = ((sourceNode.y || 0) + (targetNode.y || 0)) / 2
            return `translate(${x},${y})`
          })

        node.attr('transform', (d) => `translate(${d.x},${d.y})`)
      })

      setLoading(false)

      return () => {
        simulation.stop()
      }
    }).catch((err) => {
      console.error('Failed to load d3:', err)
      setLoading(false)
    })
  }, [data, actualWidth, height])

  if (loading && (!data?.nodes?.length)) {
    return (
      <div className="flex items-center justify-center h-64 bg-stone-100 border-2 border-stone-900 rounded-xl">
        <div className="text-stone-500 font-bold">Đang tải graph...</div>
      </div>
    )
  }

  if (!data?.nodes?.length) {
    return (
      <div className="flex items-center justify-center h-64 bg-stone-100 border-2 border-stone-900 rounded-xl">
        <div className="text-stone-500 font-bold">Chưa có dữ liệu Knowledge Graph</div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="border-2 border-stone-900 rounded-xl overflow-hidden bg-white">
      <svg
        ref={svgRef}
        width={actualWidth}
        height={height}
        className="cursor-move"
        style={{ display: 'block', background: '#fafaf9' }}
      />
      <div className="p-2 bg-stone-100 border-t-2 border-stone-900 flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-500 border border-stone-900"></span>
          Thực thể (Subject)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 border border-stone-900"></span>
          Đối tượng (Object)
        </span>
        <span className="ml-auto text-stone-500">
          {data.nodes?.length || 0} nodes • {data.edges?.length || 0} edges
        </span>
      </div>
    </div>
  )
}
