import { useState } from 'react'
import { CheckIcon, XMarkIcon, LinkIcon, CpuChipIcon, WrenchScrewdriverIcon, UserIcon, BoltIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { LoadingCard, UISchemaRenderer } from '../chat/renderers'
import type { ChatStage, UIAction, UIComponent, UISchemaV1 } from '../../types/chat-copilot'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  images?: string[] // Mảng các URL hình ảnh từ metadata
  citations?: Array<{ type: 'rag' | 'web'; source: string; url?: string }>
  thinkingProcess?: string[]
  toolCalls?: Array<{ tool: string; input: Record<string, unknown>; output?: unknown }>
  feedback?: 'good' | 'bad' | null
  onFeedback?: (feedback: 'good' | 'bad') => void
  uiSchema?: UISchemaV1
  stage?: ChatStage
  selectedClinicId?: string
  onUiAction?: (action: UIAction, component: UIComponent) => void
}

/**
 * Chat Message Component - Neobrutalism Style
 */
/**
 * Expandable Tool Call Card
 */
const ToolCallCard = ({ call }: { call: { tool: string; input: Record<string, unknown>; output?: unknown } }) => {
  const [expanded, setExpanded] = useState(false)
  const outputStr = call.output
    ? typeof call.output === 'string'
      ? call.output
      : JSON.stringify(call.output, null, 2)
    : ''
  const inputStr = JSON.stringify(call.input, null, 2)
  const isLongOutput = outputStr.length > 200
  const isLongInput = inputStr.length > 200

  return (
    <div className="bg-white border-2 border-stone-900 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 w-full text-left cursor-pointer"
      >
        {(isLongOutput || isLongInput) ? (
          expanded ? (
            <ChevronDownIcon className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" />
          )
        ) : null}
        <span className="px-2 py-0.5 bg-stone-900 text-white font-black text-[10px] uppercase">
          {call.tool}
        </span>
        {!expanded && isLongOutput && (
          <span className="text-[9px] text-stone-400 font-bold">Bấm để xem chi tiết</span>
        )}
      </button>
      <div className="grid grid-cols-1 gap-2">
        <div className="text-[10px] font-mono bg-stone-50 p-1.5 border border-stone-200">
          <span className="font-black text-stone-400 mr-2">IN:</span>
          {expanded ? (
            <pre className="mt-1 whitespace-pre-wrap break-words text-stone-900 max-h-48 overflow-y-auto">
              {inputStr}
            </pre>
          ) : (
            <span className="text-stone-900">
              {inputStr.length > 200 ? inputStr.slice(0, 200) + '...' : inputStr}
            </span>
          )}
        </div>
        {outputStr && (
          <div className="text-[10px] font-mono bg-green-50 p-1.5 border border-green-200">
            <span className="font-black text-green-600 mr-2">OUT:</span>
            {expanded ? (
              <pre className="mt-1 whitespace-pre-wrap break-words text-stone-900 max-h-64 overflow-y-auto">
                {outputStr}
              </pre>
            ) : (
              <span className="text-stone-900">
                {outputStr.length > 200 ? outputStr.slice(0, 200) + '...' : outputStr}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const ChatMessage = ({
  role,
  content,
  timestamp,
  images = [],
  citations = [],
  thinkingProcess = [],
  toolCalls = [],
  feedback,
  onFeedback,
  uiSchema,
  stage,
  selectedClinicId,
  onUiAction,
}: ChatMessageProps) => {
  const isUser = role === 'user'
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const resolveImageSrc = (value: string) => {
    const image = (value || '').trim()
    if (!image) return ''
    if (image.startsWith('data:') || image.startsWith('http://') || image.startsWith('https://')) {
      return image
    }
    return `data:image/jpeg;base64,${image}`
  }
  const resolvedImages = images
    .map(resolveImageSrc)
    .filter((image): image is string => Boolean(image))
  const hasContent = content.trim().length > 0
  const imageGridClass = resolvedImages.length === 1
    ? 'grid-cols-1'
    : 'grid-cols-2'

  return (
    <>
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
            relative border-2 border-stone-900 p-3.5 w-fit max-w-full
            ${isUser
              ? 'bg-blue-500 text-white shadow-[3px_3px_0_#1c1917]'
              : 'bg-white text-stone-900 shadow-[3px_3px_0_#1c1917]'
            }
          `}>
            {resolvedImages.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className={`grid ${imageGridClass} gap-2`}>
                  {resolvedImages.map((image, idx) => (
                    <button
                      key={`${image}-${idx}`}
                      type="button"
                      onClick={() => setPreviewImage(image)}
                      className={`group relative overflow-hidden border-2 border-stone-900 bg-stone-100 shadow-[2px_2px_0_#1c1917] ${resolvedImages.length === 1 ? 'w-[260px] max-w-full' : 'w-[128px]'} ${resolvedImages.length === 1 ? 'h-[200px]' : 'h-[128px]'}`}
                    >
                      <img
                        src={image}
                        alt={`Ảnh đính kèm ${idx + 1}`}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1 text-left text-[10px] font-black uppercase tracking-wide text-white">
                        Ảnh {idx + 1}
                      </div>
                    </button>
                  ))}
                </div>
                <div className={`inline-flex items-center gap-2 border-2 border-stone-900 px-2 py-1 text-[10px] font-black uppercase tracking-wide shadow-[2px_2px_0_#1c1917] ${isUser ? 'bg-white text-stone-900' : 'bg-amber-200 text-stone-900'}`}>
                  <span>{resolvedImages.length} ảnh đính kèm</span>
                  <span className="text-stone-500">Bấm để xem lớn</span>
                </div>
              </div>
            )}
            {hasContent && (
              <div className={`text-sm md:text-base font-bold whitespace-pre-wrap leading-relaxed ${isUser ? 'text-white' : 'text-stone-900'}`}>
                {content}
              </div>
            )}

            {!isUser && stage === 'COLLECTING' && !uiSchema && (
              <div className="mt-4">
                <LoadingCard />
              </div>
            )}

            {!isUser && uiSchema && (
              <div className="mt-4">
                <UISchemaRenderer
                  schema={uiSchema}
                  onAction={onUiAction}
                  selectedClinicId={selectedClinicId}
                />
              </div>
            )}

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
                    aria-label="Phản hồi tích cực"
                    title="Phản hồi tích cực"
                    className={`p-1.5 border-2 border-stone-900 transition-all ${feedback === 'good' ? 'bg-green-400' : 'bg-white hover:bg-green-100 shadow-[2px_2px_0_#1c1917]'}`}
                  >
                    <CheckIcon className="w-4 h-4 font-black text-stone-900" />
                  </button>
                  <button
                    onClick={() => onFeedback('bad')}
                    aria-label="Phản hồi chưa tốt"
                    title="Phản hồi chưa tốt"
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
                      <ToolCallCard key={idx} call={call} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-h-[90vh] max-w-[90vw] overflow-hidden border-4 border-stone-900 bg-white shadow-[8px_8px_0_#1c1917]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-stone-900 bg-amber-300 px-4 py-2">
              <span className="text-xs font-black uppercase tracking-wide text-stone-900">Ảnh đính kèm</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                aria-label="Đóng ảnh xem trước"
                title="Đóng ảnh xem trước"
                className="border-2 border-stone-900 bg-white p-1 text-stone-900 shadow-[2px_2px_0_#1c1917] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Ảnh đính kèm phóng to"
              className="max-h-[80vh] max-w-[90vw] object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}
