// Bank data from VietQR API (https://api.vietqr.io/v2/banks)
// Filtered to only include banks that support transfer (transferSupported: 1)

export interface VietQRBank {
    id: number
    name: string // Full name
    code: string // Bank code for VietQR image API
    bin: string // Bank BIN
    shortName: string // Short name for display
    logo: string // Logo URL
}

// Hardcoded list of popular banks that support transfer
// This is more reliable than fetching dynamically
export const VIETQR_BANKS: VietQRBank[] = [
    { id: 17, name: 'Ngân hàng TMCP Công thương Việt Nam', code: 'ICB', bin: '970415', shortName: 'VietinBank', logo: 'https://cdn.vietqr.io/img/ICB.png' },
    { id: 43, name: 'Ngân hàng TMCP Ngoại Thương Việt Nam', code: 'VCB', bin: '970436', shortName: 'Vietcombank', logo: 'https://cdn.vietqr.io/img/VCB.png' },
    { id: 4, name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', code: 'BIDV', bin: '970418', shortName: 'BIDV', logo: 'https://cdn.vietqr.io/img/BIDV.png' },
    { id: 42, name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', code: 'VBA', bin: '970405', shortName: 'Agribank', logo: 'https://cdn.vietqr.io/img/VBA.png' },
    { id: 26, name: 'Ngân hàng TMCP Phương Đông', code: 'OCB', bin: '970448', shortName: 'OCB', logo: 'https://cdn.vietqr.io/img/OCB.png' },
    { id: 21, name: 'Ngân hàng TMCP Quân đội', code: 'MB', bin: '970422', shortName: 'MBBank', logo: 'https://cdn.vietqr.io/img/MB.png' },
    { id: 38, name: 'Ngân hàng TMCP Kỹ thương Việt Nam', code: 'TCB', bin: '970407', shortName: 'Techcombank', logo: 'https://cdn.vietqr.io/img/TCB.png' },
    { id: 2, name: 'Ngân hàng TMCP Á Châu', code: 'ACB', bin: '970416', shortName: 'ACB', logo: 'https://cdn.vietqr.io/img/ACB.png' },
    { id: 47, name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', code: 'VPB', bin: '970432', shortName: 'VPBank', logo: 'https://cdn.vietqr.io/img/VPB.png' },
    { id: 39, name: 'Ngân hàng TMCP Tiên Phong', code: 'TPB', bin: '970423', shortName: 'TPBank', logo: 'https://cdn.vietqr.io/img/TPB.png' },
    { id: 36, name: 'Ngân hàng TMCP Sài Gòn Thương Tín', code: 'STB', bin: '970403', shortName: 'Sacombank', logo: 'https://cdn.vietqr.io/img/STB.png' },
    { id: 12, name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh', code: 'HDB', bin: '970437', shortName: 'HDBank', logo: 'https://cdn.vietqr.io/img/HDB.png' },
    { id: 44, name: 'Ngân hàng TMCP Bản Việt', code: 'VCCB', bin: '970454', shortName: 'VietCapitalBank', logo: 'https://cdn.vietqr.io/img/VCCB.png' },
    { id: 31, name: 'Ngân hàng TMCP Sài Gòn', code: 'SCB', bin: '970429', shortName: 'SCB', logo: 'https://cdn.vietqr.io/img/SCB.png' },
    { id: 45, name: 'Ngân hàng TMCP Quốc tế Việt Nam', code: 'VIB', bin: '970441', shortName: 'VIB', logo: 'https://cdn.vietqr.io/img/VIB.png' },
    { id: 35, name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', code: 'SHB', bin: '970443', shortName: 'SHB', logo: 'https://cdn.vietqr.io/img/SHB.png' },
    { id: 10, name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam', code: 'EIB', bin: '970431', shortName: 'Eximbank', logo: 'https://cdn.vietqr.io/img/EIB.png' },
    { id: 22, name: 'Ngân hàng TMCP Hàng Hải Việt Nam', code: 'MSB', bin: '970426', shortName: 'MSB', logo: 'https://cdn.vietqr.io/img/MSB.png' },
    { id: 53, name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank', code: 'CAKE', bin: '546034', shortName: 'CAKE', logo: 'https://cdn.vietqr.io/img/CAKE.png' },
    { id: 54, name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank', code: 'Ubank', bin: '546035', shortName: 'Ubank', logo: 'https://cdn.vietqr.io/img/UBANK.png' },
    { id: 34, name: 'Ngân hàng TMCP Sài Gòn Công Thương', code: 'SGICB', bin: '970400', shortName: 'SaigonBank', logo: 'https://cdn.vietqr.io/img/SGICB.png' },
    { id: 3, name: 'Ngân hàng TMCP Bắc Á', code: 'BAB', bin: '970409', shortName: 'BacABank', logo: 'https://cdn.vietqr.io/img/BAB.png' },
    { id: 65, name: 'Ví điện tử MoMo', code: 'MOMO', bin: '971025', shortName: 'MoMo', logo: 'https://cdn.vietqr.io/img/momo.png' },
    { id: 30, name: 'Ngân hàng TMCP Đại Chúng Việt Nam', code: 'PVCB', bin: '970412', shortName: 'PVcomBank', logo: 'https://cdn.vietqr.io/img/PVCB.png' },
    { id: 24, name: 'Ngân hàng TMCP Quốc Dân', code: 'NCB', bin: '970419', shortName: 'NCB', logo: 'https://cdn.vietqr.io/img/NCB.png' },
    { id: 37, name: 'Ngân hàng TNHH MTV Shinhan Việt Nam', code: 'SHBVN', bin: '970424', shortName: 'ShinhanBank', logo: 'https://cdn.vietqr.io/img/SHBVN.png' },
    { id: 1, name: 'Ngân hàng TMCP An Bình', code: 'ABB', bin: '970425', shortName: 'ABBANK', logo: 'https://cdn.vietqr.io/img/ABB.png' },
    { id: 41, name: 'Ngân hàng TMCP Việt Á', code: 'VAB', bin: '970427', shortName: 'VietABank', logo: 'https://cdn.vietqr.io/img/VAB.png' },
    { id: 23, name: 'Ngân hàng TMCP Nam Á', code: 'NAB', bin: '970428', shortName: 'NamABank', logo: 'https://cdn.vietqr.io/img/NAB.png' },
    { id: 29, name: 'Ngân hàng TMCP Thịnh vượng và Phát triển', code: 'PGB', bin: '970430', shortName: 'PGBank', logo: 'https://cdn.vietqr.io/img/PGB.png' },
    { id: 46, name: 'Ngân hàng TMCP Việt Nam Thương Tín', code: 'VIETBANK', bin: '970433', shortName: 'VietBank', logo: 'https://cdn.vietqr.io/img/VIETBANK.png' },
    { id: 5, name: 'Ngân hàng TMCP Bảo Việt', code: 'BVB', bin: '970438', shortName: 'BaoVietBank', logo: 'https://cdn.vietqr.io/img/BVB.png' },
    { id: 33, name: 'Ngân hàng TMCP Đông Nam Á', code: 'SEAB', bin: '970440', shortName: 'SeABank', logo: 'https://cdn.vietqr.io/img/SEAB.png' },
    { id: 52, name: 'Ngân hàng Hợp tác xã Việt Nam', code: 'COOPBANK', bin: '970446', shortName: 'COOPBANK', logo: 'https://cdn.vietqr.io/img/COOPBANK.png' },
    { id: 20, name: 'Ngân hàng TMCP Lộc Phát Việt Nam', code: 'LPB', bin: '970449', shortName: 'LPBank', logo: 'https://cdn.vietqr.io/img/LPB.png' },
    { id: 19, name: 'Ngân hàng TMCP Kiên Long', code: 'KLB', bin: '970452', shortName: 'KienLongBank', logo: 'https://cdn.vietqr.io/img/KLB.png' },
    { id: 55, name: 'Ngân hàng Đại chúng TNHH Kasikornbank', code: 'KBank', bin: '668888', shortName: 'KBank', logo: 'https://cdn.vietqr.io/img/KBANK.png' },
    { id: 7, name: 'Ngân hàng TNHH MTV CIMB Việt Nam', code: 'CIMB', bin: '422589', shortName: 'CIMB', logo: 'https://cdn.vietqr.io/img/CIMB.png' },
    { id: 49, name: 'Ngân hàng TNHH MTV Woori Việt Nam', code: 'WVN', bin: '970457', shortName: 'Woori', logo: 'https://cdn.vietqr.io/img/WVN.png' },
]

/**
 * Get VietQR image URL for a bank account
 * @param bankCode Bank code (e.g., 'MB', 'VCB')
 * @param accountNumber Account number
 * @param template QR template: 'compact', 'compact2', 'qr_only', 'print'
 * @returns VietQR image URL
 */
export function getVietQRImageUrl(
    bankCode: string,
    accountNumber: string,
    template: 'compact' | 'compact2' | 'qr_only' | 'print' = 'compact2'
): string {
    if (!bankCode || !accountNumber) {
        return ''
    }
    return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-${template}.jpg`
}

/**
 * Find bank by code
 */
export function findBankByCode(code: string): VietQRBank | undefined {
    return VIETQR_BANKS.find((bank) => bank.code.toLowerCase() === code.toLowerCase())
}
