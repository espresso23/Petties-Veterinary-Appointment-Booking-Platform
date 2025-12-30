import { CheckIcon, XMarkIcon, LinkIcon, CpuChipIcon, WrenchScrewdriverIcon, UserIcon, BoltIcon } from '@heroicons/react/24/outline'

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
 * Chat Message Component - Neobrutalism Style
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
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-6`}>
      {/* Avatar Wrapper */}
      <div className={`flex-shrink-0 w-9 h-9 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] flex items-center justify-center ${isUser ? 'bg-blue-400' : 'bg-amber-400'}`}>
        {isUser ? (
          <UserIcon className="w-5 h-5 text-stone-900" />
        ) : (
          <BoltIcon className="w-5 h-5 text-stone-900" />
        )}
      </div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
        {/* Role & Time */}
        <div className="flex items-center gap-3 mb-2 px-1">
          <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest">
            {isUser ? 'Pet Owner' : 'Petties Assistant'}
          </span>
          {timestamp && (
            <span className="text-[10px] font-bold text-stone-400">
              {timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Message Bubble */}
        <div className={`
          relative border-2 border-stone-900 p-3.5 w-fit
          ${isUser
            ? 'bg-blue-500 text-white shadow-[3px_3px_0_#1c1917]'
            : 'bg-white text-stone-900 shadow-[3px_3px_0_#1c1917]'
          }
        `}>
          <div className={`text-sm md:text-base font-bold whitespace-pre-wrap leading-relaxed ${isUser ? 'text-white' : 'text-stone-900'}`}>
            {content}
          </div>

          {/* Citations */}
          {!isUser && citations.length > 0 && (
            <div className="mt-4 pt-4 border-t-4 border-stone-900 grid grid-cols-1 gap-2">
              <p className="text-[10px] font-black uppercase text-stone-500 mb-1">Citations & Sources</p>
              {citations.map((citation, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs bg-stone-50 p-2 border-2 border-stone-900">
                  <LinkIcon className="w-3.5 h-3.5 text-stone-900" />
                  <span className="font-bold text-stone-700 truncate flex-1">
                    {citation.type === 'rag' ? 'Knowledge Base' : 'Web Resource'}: {citation.source}
                  </span>
                  {citation.url && (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-black uppercase text-[10px]"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feedback Section */}
          {!isUser && onFeedback && (
            <div className="mt-4 flex items-center justify-between border-t-4 border-stone-900 pt-3">
              <span className="text-[10px] font-black uppercase text-stone-500">Feedback</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onFeedback('good')}
                  className={`p-1.5 border-2 border-stone-900 transition-all ${feedback === 'good' ? 'bg-green-400' : 'bg-white hover:bg-green-100 shadow-[2px_2px_0_#1c1917]'}`}
                >
                  <CheckIcon className="w-4 h-4 font-black text-stone-900" />
                </button>
                <button
                  onClick={() => onFeedback('bad')}
                  className={`p-1.5 border-2 border-stone-900 transition-all ${feedback === 'bad' ? 'bg-red-400' : 'bg-white hover:bg-red-100 shadow-[2px_2px_0_#1c1917]'}`}
                >
                  <XMarkIcon className="w-4 h-4 font-black text-stone-900" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Thinking & Tools - Neobrutalist Cards */}
        {!isUser && (thinkingProcess.length > 0 || toolCalls.length > 0) && (
          <div className="mt-4 w-full space-y-4">
            {thinkingProcess.length > 0 && (
              <div className="bg-amber-100 border-4 border-stone-900 p-4 shadow-[4px_4px_0_#1c1917]">
                <div className="flex items-center gap-2 mb-3">
                  <CpuChipIcon className="w-5 h-5 text-stone-900" />
                  <span className="text-xs font-black uppercase tracking-wider text-stone-900">Reasoning Trace</span>
                </div>
                <div className="space-y-2">
                  {thinkingProcess.map((step, idx) => (
                    <div key={idx} className="flex gap-3 text-sm">
                      <span className="shrink-0 font-black text-amber-600">0{idx + 1}</span>
                      <p className="font-bold text-stone-700 leading-snug">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {toolCalls.length > 0 && (
              <div className="bg-purple-100 border-4 border-stone-900 p-4 shadow-[4px_4px_0_#1c1917]">
                <div className="flex items-center gap-2 mb-3">
                  <WrenchScrewdriverIcon className="w-5 h-5 text-stone-900" />
                  <span className="text-xs font-black uppercase tracking-wider text-stone-900">Tool Calls</span>
                </div>
                <div className="space-y-3">
                  {toolCalls.map((call, idx) => (
                    <div key={idx} className="bg-white border-2 border-stone-900 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-stone-900 text-white font-black text-[10px] uppercase">
                          {call.tool}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="text-[10px] font-mono bg-stone-50 p-1.5 border border-stone-200">
                          <span className="font-black text-stone-400 mr-2">IN:</span>
                          <span className="text-stone-900">{JSON.stringify(call.input)}</span>
                        </div>
                        {call.output && (
                          <div className="text-[10px] font-mono bg-green-50 p-1.5 border border-green-200">
                            <span className="font-black text-green-600 mr-2">OUT:</span>
                            <span className="text-stone-900">
                              {typeof call.output === 'string'
                                ? call.output.slice(0, 100) + (call.output.length > 100 ? '...' : '')
                                : JSON.stringify(call.output).slice(0, 100)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
