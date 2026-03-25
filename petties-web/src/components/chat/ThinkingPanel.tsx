import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface ThinkingSegment {
  type: 'thought' | 'tool_call' | 'observation'
  content: string
  step_index?: string
}

interface ThinkingPanelProps {
  segments: ThinkingSegment[]
  isStreaming?: boolean
  latestContent?: string
}

const STREAM_DELAY_MS = 25

export function ThinkingPanel({ segments, isStreaming = false, latestContent = '' }: ThinkingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [displayedSegments, setDisplayedSegments] = useState<ThinkingSegment[]>([])
  const [streamingText, setStreamingText] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when new content arrives
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [displayedSegments, streamingText])

  // Stream new segments
  useEffect(() => {
    if (segments.length > displayedSegments.length) {
      const newSegments = segments.slice(displayedSegments.length)
      setDisplayedSegments([...displayedSegments, ...newSegments])
      
      // Start streaming the last new segment
      if (newSegments.length > 0) {
        const lastSegment = newSegments[newSegments.length - 1]
        streamText(lastSegment.content)
      }
    }
  }, [segments])

  // Stream live content from backend
  useEffect(() => {
    if (latestContent && isStreaming) {
      streamText(latestContent)
    }
  }, [latestContent, isStreaming])

  const streamText = useCallback((text: string) => {
    let index = 0
    setStreamingText('')
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setStreamingText(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
        // Add completed segment
        if (text) {
          setDisplayedSegments(prev => [...prev, { type: 'thought', content: text }])
        }
        setStreamingText('')
      }
    }, STREAM_DELAY_MS)

    return () => clearInterval(interval)
  }, [])

  if (segments.length === 0 && !isStreaming) {
    return null
  }

  return (
    <div className="border-2 border-stone-900 rounded-xl mb-3 overflow-hidden bg-amber-50">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-amber-100 hover:bg-amber-200 transition-colors border-b-2 border-stone-900"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💭</span>
          <span className="font-bold text-sm text-stone-900 uppercase">
            {isStreaming ? 'Đang suy luận...' : 'Quá trình suy luận'}
          </span>
          {isStreaming && <StreamingIndicator />}
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-4 h-4 text-stone-900" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-stone-900" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div 
          ref={containerRef}
          className="px-4 py-3 max-h-48 overflow-y-auto bg-white"
        >
          {/* Displayed segments */}
          {displayedSegments.map((segment, idx) => (
            <ThinkingSegmentItem key={idx} segment={segment} />
          ))}
          
          {/* Streaming text */}
          {streamingText && (
            <ThinkingSegmentItem 
              segment={{ type: 'thought', content: streamingText }} 
              isStreaming={true}
            />
          )}
          
          {/* Loading indicator */}
          {isStreaming && !streamingText && (
            <div className="flex items-center gap-2 text-stone-500 text-sm">
              <span className="animate-pulse">Đang xử lý...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThinkingSegmentItem({ segment, isStreaming = false }: { segment: ThinkingSegment; isStreaming?: boolean }) {
  const getIcon = () => {
    if (segment.content.startsWith('🧠')) return '🧠'
    if (segment.content.startsWith('🔍')) return '🔍'
    if (segment.content.startsWith('📋')) return '📋'
    return '💭'
  }

  const cleanContent = segment.content
    .replace(/^🧠\s*/, '')
    .replace(/^🔍\s*/, '')
    .replace(/^📋\s*/, '')

  return (
    <div className={`flex items-start gap-2 mb-2 ${isStreaming ? 'animate-pulse' : ''}`}>
      <span className="text-base flex-shrink-0 mt-0.5">{getIcon()}</span>
      <span className="text-sm text-stone-700 leading-relaxed">
        {cleanContent}
      </span>
      {isStreaming && <CursorBlink />}
    </div>
  )
}

function StreamingIndicator() {
  return (
    <div className="flex gap-1">
      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

function CursorBlink() {
  return (
    <span className="inline-block w-0.5 h-4 bg-stone-900 animate-pulse ml-0.5" />
  )
}

export default ThinkingPanel
