import { useState } from 'react'
import { getVietQRImageUrl, findBankByCode } from '../../utils/vietqr'

interface VietQRPreviewProps {
    bankCode: string
    accountNumber: string
    showInfo?: boolean // Show bank name and account number below QR
}

export function VietQRPreview({ bankCode, accountNumber, showInfo = true }: VietQRPreviewProps) {
    const [imageError, setImageError] = useState(false)
    const [imageLoading, setImageLoading] = useState(true)

    const qrUrl = getVietQRImageUrl(bankCode, accountNumber)
    const bank = findBankByCode(bankCode)

    if (!bankCode || !accountNumber) {
        return null
    }

    return (
        <div className="card-brutal p-4 bg-white">
            <div className="text-sm font-bold uppercase text-stone-600 mb-3">Ma QR Chuyen Khoan</div>

            <div className="flex flex-col items-center">
                {/* QR Code Image */}
                <div className="relative w-full max-w-[200px] aspect-square border-2 border-stone-900 overflow-hidden bg-white">
                    {imageLoading && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                            <div className="text-xs font-bold uppercase text-stone-500 animate-pulse">Dang tai...</div>
                        </div>
                    )}

                    {imageError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-4">
                            <div className="text-xs font-bold uppercase text-red-600 text-center">
                                Khong the tai ma QR
                            </div>
                            <div className="text-[10px] text-stone-500 text-center mt-1">
                                Kiem tra lai thong tin ngan hang
                            </div>
                        </div>
                    ) : (
                        <img
                            src={qrUrl}
                            alt="VietQR Code"
                            className={`w-full h-full object-contain ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
                            onLoad={() => setImageLoading(false)}
                            onError={() => {
                                setImageError(true)
                                setImageLoading(false)
                            }}
                        />
                    )}
                </div>

                {/* Bank Info */}
                {showInfo && bank && !imageError && (
                    <div className="mt-3 text-center w-full">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <img src={bank.logo} alt={bank.shortName} className="w-5 h-5 object-contain" />
                            <span className="font-bold text-stone-900 text-sm">{bank.shortName}</span>
                        </div>
                        <div className="text-xs text-stone-600 font-mono">{accountNumber}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
