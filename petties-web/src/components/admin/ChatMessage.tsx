import { CheckIcon, XMarkIcon, LinkIcon } from '@heroicons/react/24/outline'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  citations?: Array<{ type: 'rag' | 'web'; source: string; url?: string }>
  thinkingProcess?: string[]
  toolCalls?: Array<{ tool: string; input: any; output?: any }>
  feedback?: 'good' | 'bad' | null
  onFeedback?: (feedback: 'good' | 'bad') => void
}

/**
 * Chat Message Component
 * Displays user/assistant messages with citations, thinking process, and feedback
 */
export const ChatMessage = ({
  role,
  content,
  timestamp,
  citations = [],
  thinkingProcess = [],
  toolCalls = [],
  feedback,
  onFeedback
}: ChatMessageProps) => {
  const isUser = role === 'user'

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      )}

      <div className={`flex-1 ${isUser ? 'max-w-3xl' : 'max-w-4xl'}`}>
        {/* Role Label */}
        <div className={`flex items-center gap-2 mb-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs font-medium text-stone-500">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {timestamp && (
            <span className="text-xs text-stone-400">
              {timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Message Content */}
        <div className={`
          rounded-2xl px-4 py-3
          ${isUser
            ? 'bg-amber-600 text-white ml-auto'
            : 'bg-white border border-stone-200 shadow-soft'
          }
        `}>
          <div className={`${isUser ? 'text-white' : 'text-stone-900'} whitespace-pre-wrap`}>
            {content}
          </div>

          {/* Citations */}
          {!isUser && citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-200 space-y-1.5">
              <p className="text-xs font-medium text-stone-600 mb-2">Sources:</p>
              {citations.map((citation, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <LinkIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-stone-500">
                    {citation.type === 'rag' ? '📄 ' : '🌐 '}
                    {citation.source}
                  </span>
                  {citation.url && (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-600 hover:text-amber-700 underline"
                    >
                      View source
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feedback Buttons (Assistant only) */}
          {!isUser && onFeedback && (
            <div className="mt-3 pt-3 border-t border-stone-200 flex items-center gap-2">
              <span className="text-xs text-stone-500">Feedback:</span>
              <button
                onClick={() => onFeedback('good')}
                className={`
                  p-1.5 rounded-lg transition-colors cursor-pointer
                  ${feedback === 'good'
                    ? 'bg-green-100 text-green-700'
                    : 'text-stone-400 hover:bg-stone-100 hover:text-green-600'
                  }
                `}
                title="Good response"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => onFeedback('bad')}
                className={`
                  p-1.5 rounded-lg transition-colors cursor-pointer
                  ${feedback === 'bad'
                    ? 'bg-red-100 text-red-700'
                    : 'text-stone-400 hover:bg-stone-100 hover:text-red-600'
                  }
                `}
                title="Bad response"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Thinking Process & Tool Calls (Expanded by default when available) */}
        {!isUser && (thinkingProcess.length > 0 || toolCalls.length > 0) && (
          <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-blue-800">🧠 Agent Thinking Process</span>
            </div>

            {thinkingProcess.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Reasoning Steps:</p>
                <ol className="space-y-1.5 text-sm text-blue-900">
                  {thinkingProcess.map((step, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {toolCalls.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wide">🔧 Tool Executions:</p>
                <div className="space-y-2">
                  {toolCalls.map((call, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-purple-200 text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-mono text-xs font-bold">
                          {call.tool}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-stone-600 mb-1">
                        <span className="text-purple-600 font-semibold">Input:</span>{' '}
                        <code className="bg-stone-100 px-1 py-0.5 rounded">
                          {JSON.stringify(call.input)}
                        </code>
                      </div>
                      {call.output && (
                        <div className="text-xs font-mono text-stone-600">
                          <span className="text-green-600 font-semibold">Output:</span>{' '}
                          <code className="bg-green-50 px-1 py-0.5 rounded text-green-700">
                            {typeof call.output === 'string'
                              ? call.output.slice(0, 150) + (call.output.length > 150 ? '...' : '')
                              : JSON.stringify(call.output).slice(0, 150)}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  )
}
