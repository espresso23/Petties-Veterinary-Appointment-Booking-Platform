import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, PhotoIcon } from '@heroicons/react/24/solid'

interface MessageInputProps {
  onSend: (content: string) => void
  onImageUpload?: (file: File) => Promise<void>
  onCombinedMessage?: (content: string, imageFile: File) => Promise<void>
  onTyping?: (typing: boolean) => void
  onError?: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Message input component with auto-resize textarea
 */
export function MessageInput({
  onSend,
  onImageUpload,
  onCombinedMessage,
  onTyping,
  onError,
  disabled = false,
  placeholder = 'Nhap tin nhan...',
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  console.log('MessageInput initialized', {
    hasOnSend: !!onSend,
    hasOnImageUpload: !!onImageUpload,
    hasOnCombinedMessage: !!onCombinedMessage,
    hasOnTyping: !!onTyping
  })

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [text])

  // Handle paste images from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            imageFiles.push(file)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        handleImagesSelected(imageFiles)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)

    // Typing indicator
    if (onTyping) {
      onTyping(true)

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false)
      }, 1000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (disabled) return

    const trimmedText = text.trim()

    console.log('MessageInput.handleSubmit', {
      trimmedText: trimmedText ? `"${trimmedText}"` : 'empty',
      selectedImagesCount: selectedImages.length,
      hasOnCombinedMessage: !!onCombinedMessage,
      hasOnImageUpload: !!onImageUpload
    })

    // If we have both text and images, send text first, then images separately
    if (trimmedText && selectedImages.length > 0 && onSend && onImageUpload) {
      console.log('MessageInput: Sending text + images separately')
      setIsUploading(true)
      try {
        // Send text message first
        onSend(trimmedText)

        // Send all images separately
        for (const image of selectedImages) {
          await onImageUpload(image)
        }

        // Clear everything
        setSelectedImages([])
        setImagePreviews([])
        setText('')
        if (onTyping) {
          onTyping(false)
        }
      } catch (error) {
        console.error('Combined message failed:', error)
        onError?.('Gửi tin nhắn thất bại. Vui lòng thử lại.')
      } finally {
        setIsUploading(false)
      }
    }
    // If we have only images, upload them
    else if (selectedImages.length > 0 && onImageUpload) {
      console.log('MessageInput: Sending only images, count:', selectedImages.length)
      setIsUploading(true)
      let successCount = 0
      let failCount = 0

      try {
        // Upload all images - continue even if some fail
        for (const image of selectedImages) {
          try {
            console.log('Uploading image:', image.name)
            await onImageUpload(image)
            successCount++
            console.log('Upload success:', image.name)
          } catch (imageError) {
            console.error('Failed to upload image:', image.name, imageError)
            failCount++
          }
        }

        // Clear selection after all uploads attempted
        setSelectedImages([])
        setImagePreviews([])
        setText('')
        if (onTyping) {
          onTyping(false)
        }

        // Show result to user
        if (failCount > 0) {
          onError?.(`Tải lên thất bại ${failCount} ảnh. Vui lòng thử lại.`)
        }
      } finally {
        setIsUploading(false)
      }
    }
    // If we have only text, send it
    else if (trimmedText) {
      console.log('MessageInput: Sending only text')
      onSend(trimmedText)
      setText('')
      if (onTyping) {
        onTyping(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleImagesSelected = async (files: File[]) => {
    if (!onImageUpload) return

    const validFiles: File[] = []
    const previews: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      if (!file.type.startsWith('image/')) {
        onError?.(`File ${file.name} không phải là hình ảnh`)
        continue
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        onError?.(`File ${file.name} quá lớn. Tối đa 10MB`)
        continue
      }

      validFiles.push(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          previews.push(e.target.result as string)
          if (previews.length === validFiles.length) {
            setImagePreviews(previews)
          }
        }
      }
      reader.readAsDataURL(file)
    }

    setSelectedImages(validFiles)
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !onImageUpload) return

    const fileArray = Array.from(files)
    await handleImagesSelected(fileArray)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <>
      {/* Image Preview */}
      {imagePreviews.length > 0 && (
        <div className="bg-stone-50 border-t-2 border-stone-900 p-4">
          <div className="flex items-start gap-4">
            <div className="flex gap-2 flex-wrap">
              {imagePreviews.slice(0, 3).map((preview, index) => (
                <div key={index} className="relative">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold"
                  >
                    ✕
                  </button>
                  {imagePreviews.length > 3 && index === 2 && (
                    <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">+{imagePreviews.length - 3}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-stone-900 mb-1">
                {imagePreviews.length === 1 ? 'Hình ảnh sẽ được gửi' : `${imagePreviews.length} hình ảnh sẽ được gửi`}
              </p>
              <p className="text-xs text-stone-500">Nhấn Enter hoặc nút gửi để gửi hình ảnh</p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border-t-2 border-stone-900 p-4 flex items-end gap-3"
      >
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full min-h-[48px] max-h-[120px] py-3 px-4 bg-stone-50 border-2 border-stone-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Image upload button */}
        {onImageUpload && (
          <button
            type="button"
            onClick={handleImageButtonClick}
            disabled={disabled || isUploading}
            className="px-4 py-2 bg-white border-2 border-stone-900 rounded-lg text-sm font-bold shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[2px_2px_0_#1c1917] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex items-center justify-center"
          >
            <PhotoIcon className="w-4 h-4" />
          </button>
        )}

        <button
          type="submit"
          disabled={(!text.trim() && selectedImages.length === 0) || disabled || isUploading}
          className="flex-shrink-0 w-12 h-12 bg-amber-600 text-white rounded-full border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#1c1917] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0_#1c1917] disabled:hover:translate-x-0 disabled:hover:translate-y-0 transition-all flex items-center justify-center"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </form>
    </>
  )
}

export default MessageInput
