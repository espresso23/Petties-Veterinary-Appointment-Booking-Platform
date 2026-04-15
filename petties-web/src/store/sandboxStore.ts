import { create } from 'zustand'
import { sandboxApi } from '../services/api/sandboxApi'
import type { SandboxClinicDTO } from '../services/api/sandboxApi'

/**
 * Sandbox Store (Zustand)
 * Manages global sandbox workspace state
 *
 * State:
 * - isSandboxMode: Whether user is currently in sandbox mode
 * - currentSandboxClinic: Active sandbox clinic data
 * - currentFeature: Which feature's sandbox is active (clinic_info, services, etc.)
 * - currentGuideStep: Current step in the multi-step guide
 */

export interface SandboxStore {
  // State
  isSandboxMode: boolean
  currentSandboxClinic: SandboxClinicDTO | null
  currentFeature: 'clinic_info' | 'services' | 'clinic_services' | 'master_services' | 'scheduling' | 'bookings' | null
  currentGuideStep: number
  stepProgress: Record<number, SandboxStepProgress>
  currentStepStartedAt: number
  lastProgressAt: number
  blockedOutsideFocusCount: number

  // Actions
  enterSandbox: (feature: 'clinic_info' | 'services' | 'clinic_services' | 'master_services' | 'scheduling' | 'bookings') => Promise<void>
  exitSandbox: () => Promise<void>
  loadCurrentSandbox: () => Promise<void>
  setGuideStep: (step: number) => void
  completeCurrentStepAction: () => void
  trackStepAction: (actionKey: string) => void
  reportBlockedOutsideFocus: () => void
  toggleChecklistItem: (itemId: string) => void
  isCurrentStepReady: () => boolean
  goToNextStep: () => void
  reset: () => void
}

export type SandboxFeature = 'clinic_info' | 'services' | 'clinic_services' | 'master_services' | 'scheduling' | 'bookings'

export interface SandboxChecklistItem {
  id: string
  label: string
}

export interface SandboxStepDefinition {
  title: string
  description: string
  actionLabel: string
  actionKey?: string
  hint?: string
  checklist: SandboxChecklistItem[]
  focusSelector?: string
  focusTargets?: Record<string, string>
}

export interface SandboxStepProgress {
  actionCompleted: boolean
  checklistCompleted: Record<string, boolean>
}

export const SANDBOX_GUIDE_DEFINITIONS: Record<SandboxFeature, SandboxStepDefinition[]> = {
  clinic_info: [
    {
      title: 'Bước 1: Làm quen màn quản lý phòng khám',
      description: 'Quan sát khu vực đăng ký, bộ lọc tìm kiếm và danh sách clinic để nắm bố cục màn hình.',
      actionLabel: 'Hãy bấm vào khu vực bộ lọc hoặc danh sách clinic để hệ thống ghi nhận.',
      actionKey: 'clinic_info.explore_list',
      hint: 'Ở màn quản lý phòng khám, hãy xem nút Đăng ký phòng khám, khối tìm kiếm/bộ lọc và danh sách clinic bên dưới.',
      checklist: [
        { id: 'register-button', label: 'Đã xác định nút Đăng ký phòng khám' },
        { id: 'search-filter', label: 'Đã xác định khu vực tìm kiếm và filter' },
        { id: 'clinic-cards', label: 'Đã quan sát danh sách clinic' },
      ],
      focusSelector: '[data-sandbox-target="clinic-owner-overview"]',
    },
    {
      title: 'Bước 2: Chọn clinic demo để xem chi tiết',
      description: 'Tập trung vào clinic demo vừa được tạo và mở trang chi tiết của nó.',
      actionLabel: 'Hãy bấm vào clinic demo được tô sáng để hệ thống ghi nhận.',
      actionKey: 'clinic_info.open_demo_clinic',
      hint: 'Clinic demo sẽ được tô sáng riêng. Bấm vào thẻ clinic đó để vào trang chi tiết.',
      checklist: [
        { id: 'demo-card', label: 'Đã chọn đúng clinic demo' },
      ],
      focusSelector: '[data-sandbox-target="clinic-info-demo-clinic"]',
    },
    {
      title: 'Bước 3: Làm quen thông tin chi tiết clinic',
      description: 'Đọc lần lượt từng khu vực thông tin của clinic demo và đánh dấu khi đã hiểu.',
      actionLabel: 'Không có thao tác bắt buộc ở bước này, chỉ cần hoàn tất checklist.',
      hint: 'Từng mục thông tin sẽ được tô sáng theo checklist. Hãy đọc kỹ rồi tick xác nhận ở panel hướng dẫn, không cần bấm vào từng khối.',
      checklist: [
        { id: 'basic-info', label: 'Đã hiểu khối thông tin cơ bản' },
        { id: 'address-info', label: 'Đã hiểu khối địa chỉ và vị trí' },
        { id: 'contact-info', label: 'Đã hiểu khối liên hệ' },
        { id: 'gallery-info', label: 'Đã hiểu khối ảnh và trạng thái' },
      ],
      focusTargets: {
        'basic-info': '[data-sandbox-target="clinic-detail-basic"]',
        'address-info': '[data-sandbox-target="clinic-detail-address"]',
        'contact-info': '[data-sandbox-target="clinic-detail-contact"]',
        'gallery-info': '[data-sandbox-target="clinic-detail-gallery"]',
      },
      focusSelector: '[data-sandbox-target="clinic-detail-basic"]',
    },
    {
      title: 'Bước 4: Chỉnh sửa mô tả clinic demo',
      description: 'Mở màn chỉnh sửa, thay đổi mô tả của clinic demo và lưu lại.',
      actionLabel: 'Hãy bấm nút chỉnh sửa để bắt đầu cập nhật mô tả.',
      actionKey: 'clinic_info.open_edit',
      hint: 'Sau khi sửa mô tả clinic demo, hệ thống sẽ hỏi bạn có muốn sang phần tạo clinic hay không.',
      checklist: [
        { id: 'open-edit', label: 'Đã mở màn hình chỉnh sửa' },
        { id: 'edit-description', label: 'Đã chỉnh sửa mô tả clinic demo' },
        { id: 'save-edit', label: 'Đã lưu thay đổi' },
      ],
      focusTargets: {
        'open-edit': '[data-sandbox-target="clinic-detail-edit-button"]',
        'edit-description': '[data-sandbox-target="clinic-edit-description"]',
        'save-edit': '[data-sandbox-target="clinic-edit-save"]',
      },
      focusSelector: '[data-sandbox-target="clinic-detail-edit-button"]',
    },
    {
      title: 'Bước 5: Tạo clinic mới từ sandbox',
      description: 'Làm quen form tạo clinic và các trường thông tin cần thiết, không cần bấm gửi.',
      actionLabel: 'Hãy bấm nút Đăng ký phòng khám để mở form tạo clinic.',
      actionKey: 'clinic_info.open_create_form',
      hint: 'Sau khi vào form tạo clinic, hãy đọc từng nhóm trường và đánh dấu khi đã hiểu.',
      checklist: [
        { id: 'create-name', label: 'Đã hiểu trường tên clinic' },
        { id: 'create-address', label: 'Đã hiểu trường địa chỉ và vị trí' },
        { id: 'create-contact', label: 'Đã hiểu trường liên hệ và giờ làm việc' },
        { id: 'create-license', label: 'Đã hiểu giấy phép và thông tin ngân hàng' },
        { id: 'create-hours', label: 'Đã hiểu khu vực giờ làm việc' },
      ],
      focusTargets: {
        'create-name': '[data-sandbox-target="clinic-form-basic"]',
        'create-address': '[data-sandbox-target="clinic-form-location"]',
        'create-contact': '[data-sandbox-target="clinic-form-contact"]',
        'create-license': '[data-sandbox-target="clinic-form-license"]',
        'create-hours': '[data-sandbox-target="clinic-form-hours"]',
      },
      focusSelector: '[data-sandbox-target="clinic-form-basic"]',
    },
  ],
  services: [
    {
      title: 'Bước 1: Quan sát danh sách dịch vụ',
      description: 'Xem danh sách dịch vụ mẫu để nhận diện cấu trúc thông tin.',
      actionLabel: 'Hãy bấm vào một thẻ dịch vụ để hệ thống ghi nhận.',
      actionKey: 'services.open_service',
      hint: 'Trong danh sách dịch vụ, chọn bất kỳ card dịch vụ nào để mở popup chi tiết.',
      checklist: [
        { id: 'check-card', label: 'Đã kiểm tra ít nhất 1 thẻ dịch vụ' },
        { id: 'check-price', label: 'Đã xem khu vực giá dịch vụ' },
      ],
      focusSelector: '[data-sandbox-target="services-list"]',
    },
    {
      title: 'Bước 2: Thực hành lọc dữ liệu',
      description: 'Dùng ô tìm kiếm để hiểu cách lọc danh sách dịch vụ.',
      actionLabel: 'Hãy nhập từ khóa tìm kiếm để hệ thống ghi nhận.',
      actionKey: 'services.search',
      hint: 'Nhập tối thiểu 1 ký tự vào ô Tìm kiếm dịch vụ để hệ thống theo dõi kết quả lọc.',
      checklist: [
        { id: 'search-keyword', label: 'Đã nhập từ khóa tìm kiếm' },
        { id: 'observe-result', label: 'Đã quan sát kết quả thay đổi' },
      ],
      focusSelector: '[data-sandbox-target="services-search"]',
    },
    {
      title: 'Bước 3: Đọc thống kê nhanh',
      description: 'Xem các chỉ số tổng quan để biết cách theo dõi dịch vụ.',
      actionLabel: 'Hãy bấm vào một ô thống kê để hệ thống ghi nhận.',
      actionKey: 'services.review_stats',
      hint: 'Bấm vào một trong ba ô thống kê: Tổng dịch vụ, Hoạt động, hoặc Tại nhà.',
      checklist: [
        { id: 'total-services', label: 'Đã xem tổng số dịch vụ' },
        { id: 'active-services', label: 'Đã xem số dịch vụ hoạt động' },
      ],
      focusSelector: '[data-sandbox-target="services-stats"]',
    },
    {
      title: 'Hoàn thành hướng dẫn dịch vụ',
      description: 'Bạn đã hoàn tất quy trình làm quen quản lý dịch vụ.',
      actionLabel: 'Xác nhận hoàn tất',
      checklist: [{ id: 'done', label: 'Xác nhận đã hiểu quy trình' }],
      focusSelector: '[data-sandbox-target="services-list"]',
    },
  ],
  clinic_services: [
    {
      title: 'Bước 1: Quan sát danh sách dịch vụ phòng khám',
      description: 'Xem clinic đang được chọn, bảng dịch vụ hiện có và các thống kê nhanh trước khi thao tác.',
      actionLabel: 'Hãy bấm vào một thẻ dịch vụ để hệ thống ghi nhận.',
      actionKey: 'clinic_services.open_service_card',
      hint: 'Danh sách này dùng cho dịch vụ riêng của phòng khám. Hãy xem clinic selector, thẻ dịch vụ và các nút thao tác trên từng card.',
      checklist: [
        { id: 'read-clinic-selector', label: 'Đã xác định khu vực chọn phòng khám' },
        { id: 'read-service-list', label: 'Đã quan sát danh sách dịch vụ' },
        { id: 'read-service-price', label: 'Đã quan sát giá và thời gian dịch vụ' },
      ],
      focusSelector: '[data-sandbox-target="clinic-services-list"]',
    },
    {
      title: 'Bước 2: Chọn phòng khám làm việc',
      description: 'Chọn đúng phòng khám rồi mới tạo hoặc chỉnh sửa dịch vụ riêng.',
      actionLabel: 'Hãy chọn một phòng khám trong danh sách thả xuống.',
      actionKey: 'clinic_services.select_clinic',
      hint: 'Sau khi chọn clinic, nút tạo dịch vụ và các thao tác khác sẽ áp dụng cho clinic đó.',
      checklist: [
        { id: 'selected-clinic', label: 'Đã chọn một phòng khám' },
        { id: 'enabled-create', label: 'Đã thấy nút tạo dịch vụ được kích hoạt' },
      ],
      focusSelector: '[data-sandbox-target="clinic-services-selector"]',
    },
    {
      title: 'Bước 3: Tạo dịch vụ riêng',
      description: 'Mở form tạo mới, điền thông tin dịch vụ và lưu lại.',
      actionLabel: 'Hãy bấm nút tạo dịch vụ riêng để mở form.',
      actionKey: 'clinic_services.open_create_form',
      hint: 'Trong form tạo dịch vụ, hãy quan sát tên, mô tả, giá, số slot và tuỳ chọn dịch vụ tại nhà.',
      checklist: [
        { id: 'create-name', label: 'Đã hiểu trường tên dịch vụ' },
        { id: 'create-price', label: 'Đã hiểu trường giá dịch vụ' },
        { id: 'create-slots', label: 'Đã hiểu số slot thực hiện' },
        { id: 'create-home-visit', label: 'Đã hiểu tuỳ chọn dịch vụ tại nhà' },
      ],
      focusSelector: '[data-sandbox-target="clinic-services-create-button"]',
    },
    {
      title: 'Bước 4: Thiết lập giá di chuyển và phí SOS',
      description: 'Mở bảng giá chung của clinic và kiểm tra phần cấu hình di chuyển.',
      actionLabel: 'Hãy bấm nút giá di chuyển & SOS để mở cấu hình.',
      actionKey: 'clinic_services.open_pricing_modal',
      hint: 'Bảng giá này áp dụng theo từng phòng khám, không phải cho toàn hệ thống.',
      checklist: [
        { id: 'pricing-km', label: 'Đã hiểu giá theo km' },
        { id: 'pricing-sos', label: 'Đã hiểu phí SOS' },
      ],
      focusSelector: '[data-sandbox-target="clinic-services-pricing-button"]',
    },
    {
      title: 'Bước 5: Thừa hưởng dịch vụ mẫu',
      description: 'Chọn một dịch vụ mẫu và áp dụng nó vào clinic đang làm việc.',
      actionLabel: 'Hãy bấm nút thừa hưởng từ dịch vụ mẫu để mở danh sách master service.',
      actionKey: 'clinic_services.open_inherit_modal',
      hint: 'Bạn có thể chọn một master service, đặt giá riêng cho clinic này rồi xác nhận thừa hưởng.',
      checklist: [
        { id: 'inherit-search', label: 'Đã hiểu ô tìm kiếm dịch vụ mẫu' },
        { id: 'inherit-select', label: 'Đã hiểu cách chọn dịch vụ mẫu' },
        { id: 'inherit-confirm', label: 'Đã hiểu nút xác nhận thừa hưởng' },
      ],
      focusSelector: '[data-sandbox-target="clinic-services-inherit-button"]',
    },
  ],
  master_services: [
    {
      title: 'Bước 1: Quan sát danh sách dịch vụ mẫu',
      description: 'Xem các template dịch vụ dùng chung cho toàn hệ thống và khu vực thao tác chính.',
      actionLabel: 'Không có thao tác bắt buộc ở bước này, chỉ cần hoàn tất checklist.',
      hint: 'Màn này dùng để tạo, sửa và áp dụng dịch vụ mẫu cho nhiều clinic.',
      checklist: [
        { id: 'read-template-list', label: 'Đã quan sát danh sách dịch vụ mẫu' },
        { id: 'read-template-price', label: 'Đã quan sát giá mặc định' },
      ],
      focusSelector: '[data-sandbox-target="master-services-overview"]',
    },
    {
      title: 'Bước 2: Tạo dịch vụ mẫu mới',
      description: 'Mở form tạo dịch vụ mẫu và điền thông tin template dùng chung.',
      actionLabel: 'Hãy bấm nút thêm dịch vụ mẫu để mở form.',
      actionKey: 'master_services.open_create_form',
      hint: 'Trong form này, bạn cần quan sát tên, giá mặc định, loại dịch vụ, thú nuôi và tuỳ chọn dịch vụ tại nhà.',
      checklist: [
        { id: 'template-name', label: 'Đã hiểu trường tên dịch vụ mẫu' },
        { id: 'template-price', label: 'Đã hiểu trường giá mặc định' },
        { id: 'template-category', label: 'Đã hiểu trường loại dịch vụ' },
        { id: 'template-pet-type', label: 'Đã hiểu trường loại thú nuôi' },
      ],
      focusSelector: '[data-sandbox-target="master-services-create-button"]',
    },
    {
      title: 'Bước 3: Bật chế độ chọn để áp dụng',
      description: 'Chuyển sang chế độ chọn nhiều dịch vụ mẫu trước khi áp dụng sang clinic.',
      actionLabel: 'Hãy bấm nút chọn & áp dụng để chuyển sang chế độ chọn.',
      actionKey: 'master_services.enter_apply_mode',
      hint: 'Sau khi bật chế độ chọn, một dịch vụ mẫu sandbox sẽ được làm nổi bật để bạn tick nhanh.',
      checklist: [
        { id: 'select-template', label: 'Đã chọn ít nhất một dịch vụ mẫu' },
        { id: 'apply-mode', label: 'Đã bật chế độ chọn & áp dụng' },
      ],
      focusTargets: {
        'apply-mode': '[data-sandbox-target="master-services-apply-mode"]',
        'select-template': '[data-sandbox-target="master-services-sandbox-service"]',
      },
      focusSelector: '[data-sandbox-target="master-services-apply-mode"]',
    },
    {
      title: 'Bước 4: Áp dụng dịch vụ mẫu cho clinic',
      description: 'Chọn clinic nhận template rồi xác nhận áp dụng. Nút áp dụng chỉ hiện sau khi đã chọn ít nhất một dịch vụ mẫu.',
      actionLabel: 'Hãy bấm nút áp dụng để mở danh sách clinic.',
      actionKey: 'master_services.open_apply_clinics',
      hint: 'Sau khi chọn clinic, hệ thống sẽ tạo dịch vụ phòng khám tương ứng từ template đã chọn.',
      checklist: [
        { id: 'select-clinic', label: 'Đã chọn clinic nhận dịch vụ mẫu' },
        { id: 'confirm-apply', label: 'Đã hiểu nút xác nhận áp dụng' },
      ],
      focusSelector: '[data-sandbox-target="master-services-apply-selected"]',
    },
    {
      title: 'Bước 5: Rà soát sửa và xóa',
      description: 'Đọc các nút chỉnh sửa, đổi trạng thái tại nhà và xóa dịch vụ mẫu.',
      actionLabel: 'Không có thao tác bắt buộc ở bước này, chỉ cần hoàn tất checklist.',
      checklist: [
        { id: 'edit-template', label: 'Đã hiểu nút chỉnh sửa dịch vụ mẫu' },
        { id: 'home-visit-template', label: 'Đã hiểu nút dịch vụ tại nhà' },
        { id: 'delete-template', label: 'Đã hiểu nút xóa dịch vụ mẫu' },
      ],
      focusSelector: '[data-sandbox-target="master-services-list"]',
    },
  ],
  scheduling: [
    {
      title: 'Bước 1: Làm quen khu vực lịch làm việc',
      description: 'Xác định khu vực điều hướng lịch và thao tác chính.',
      actionLabel: 'Hãy đổi chế độ xem hoặc đổi ngày để hệ thống ghi nhận.',
      actionKey: 'scheduling.navigate',
      hint: 'Dùng các nút Tuần/Ngày/Tháng hoặc mũi tên trái phải trong khu vực điều hướng lịch.',
      checklist: [
        { id: 'read-nav', label: 'Đã xác định nút điều hướng lịch' },
        { id: 'read-view-mode', label: 'Đã xác định chế độ xem lịch' },
      ],
      focusSelector: '[data-sandbox-target="schedule-navigation"]',
    },
    {
      title: 'Bước 2: Xem danh sách ca làm việc mẫu',
      description: 'Quan sát dữ liệu ca làm việc để hiểu cấu trúc hiển thị.',
      actionLabel: 'Hãy bấm vào một ca hoặc chọn một ô lịch để hệ thống ghi nhận.',
      actionKey: 'scheduling.inspect_shift',
      hint: 'Quan sát panel Chi tiết ca bên phải và bấm vào tab hoặc nội dung chi tiết để ghi nhận thao tác bắt buộc.',
      checklist: [
        { id: 'check-shift', label: 'Đã kiểm tra một ca làm việc' },
        { id: 'check-status', label: 'Đã kiểm tra trạng thái ca' },
      ],
      focusSelector: '[data-sandbox-target="schedule-shift-detail"]',
    },
    {
      title: 'Bước 3: Kiểm tra thao tác quản lý nhanh',
      description: 'Rà soát các nút thao tác như chọn nhiều hoặc xóa nhiều.',
      actionLabel: 'Hãy bật chế độ chọn nhiều hoặc thao tác quản lý nhanh để hệ thống ghi nhận.',
      actionKey: 'scheduling.quick_actions',
      hint: 'Bấm nút Xóa nhiều ở đầu trang lịch hoặc thao tác chọn nhiều rồi mở xóa hàng loạt.',
      checklist: [
        { id: 'bulk-select', label: 'Đã xác định thao tác chọn nhiều' },
        { id: 'bulk-delete', label: 'Đã xác định thao tác xóa nhiều' },
      ],
      focusSelector: '[data-sandbox-target="schedule-actions"]',
    },
    {
      title: 'Hoàn thành hướng dẫn lịch làm việc',
      description: 'Bạn đã hoàn tất quy trình làm quen lịch làm việc.',
      actionLabel: 'Xác nhận hoàn tất',
      checklist: [{ id: 'done', label: 'Xác nhận đã hiểu quy trình' }],
      focusSelector: '[data-sandbox-target="schedule-content"]',
    },
  ],
  bookings: [
    {
      title: 'Bước 1: Quan sát danh sách lịch hẹn',
      description: 'Làm quen danh sách và trạng thái booking mẫu trong hệ thống.',
      actionLabel: 'Hãy mở danh sách booking để hệ thống ghi nhận.',
      actionKey: 'bookings.view_list',
      checklist: [
        { id: 'check-pending', label: 'Đã xem nhóm chờ xác nhận' },
        { id: 'check-progress', label: 'Đã xem nhóm đang thực hiện' },
      ],
      focusSelector: '[data-sandbox-target="booking-list"]',
    },
    {
      title: 'Bước 2: Kiểm tra chi tiết lịch hẹn',
      description: 'Mở một lịch hẹn để hiểu trường dữ liệu quan trọng.',
      actionLabel: 'Hãy mở chi tiết một booking để hệ thống ghi nhận.',
      actionKey: 'bookings.view_detail',
      checklist: [
        { id: 'check-pet', label: 'Đã kiểm tra thông tin thú cưng' },
        { id: 'check-service', label: 'Đã kiểm tra thông tin dịch vụ' },
      ],
      focusSelector: '[data-sandbox-target="booking-detail"]',
    },
    {
      title: 'Bước 3: Rà soát luồng trạng thái booking',
      description: 'Đọc thứ tự trạng thái và xác nhận quy trình xử lý booking.',
      actionLabel: 'Hãy thao tác một trạng thái booking để hệ thống ghi nhận.',
      actionKey: 'bookings.review_status',
      checklist: [
        { id: 'status-order', label: 'Đã nắm thứ tự trạng thái booking' },
        { id: 'status-action', label: 'Đã hiểu hành động tương ứng từng trạng thái' },
      ],
      focusSelector: '[data-sandbox-target="booking-status-flow"]',
    },
    {
      title: 'Hoàn thành hướng dẫn booking',
      description: 'Bạn đã hoàn tất quy trình làm quen quản lý booking.',
      actionLabel: 'Xác nhận hoàn tất',
      checklist: [{ id: 'done', label: 'Xác nhận đã hiểu quy trình' }],
      focusSelector: '[data-sandbox-target="booking-list"]',
    },
  ],
}

function createInitialProgress(feature: SandboxFeature): Record<number, SandboxStepProgress> {
  const definitions = SANDBOX_GUIDE_DEFINITIONS[feature]
  return definitions.reduce<Record<number, SandboxStepProgress>>((acc, step, index) => {
    const checklistCompleted = step.checklist.reduce<Record<string, boolean>>((itemAcc, item) => {
      itemAcc[item.id] = false
      return itemAcc
    }, {})

    acc[index + 1] = {
      actionCompleted: false,
      checklistCompleted,
    }

    return acc
  }, {})
}

function getTotalSteps(feature: SandboxFeature | null): number {
  if (!feature) {
    return 0
  }

  return SANDBOX_GUIDE_DEFINITIONS[feature].length
}

function inferFeatureFromSandboxName(name?: string | null): SandboxFeature | null {
  if (!name) {
    return null
  }

  const matched = name.match(/Sandbox\s*-\s*([a-z_]+)/i)
  if (!matched?.[1]) {
    return null
  }

  const inferred = matched[1].toLowerCase()
  const isKnownFeature = Object.prototype.hasOwnProperty.call(SANDBOX_GUIDE_DEFINITIONS, inferred)

  if (!isKnownFeature) {
    return null
  }

  return inferred as SandboxFeature
}

export function resolveSandboxFocusSelector(
  feature: SandboxFeature | null,
  guideStep: number,
  stepProgress: Record<number, SandboxStepProgress>,
): string | null {
  if (!feature) {
    return null
  }

  const stepDefinition = SANDBOX_GUIDE_DEFINITIONS[feature][guideStep - 1]
  if (!stepDefinition) {
    return null
  }

  const currentProgress = stepProgress[guideStep]
  if (!currentProgress) {
    return stepDefinition.focusSelector || null
  }

  if (!currentProgress.actionCompleted || !stepDefinition.focusTargets) {
    return stepDefinition.focusSelector || null
  }

  const firstPendingItem = stepDefinition.checklist.find((item) => !currentProgress.checklistCompleted[item.id])
  if (firstPendingItem?.id && stepDefinition.focusTargets[firstPendingItem.id]) {
    return stepDefinition.focusTargets[firstPendingItem.id]
  }

  return stepDefinition.focusSelector || null
}

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  // eslint-disable-next-line no-restricted-globals
  // Date.now is used as monotonic-enough timestamp for UX hinting.
  // Initial State
  isSandboxMode: false,
  currentSandboxClinic: null,
  currentFeature: null,
  currentGuideStep: 1,
  stepProgress: {},
  currentStepStartedAt: Date.now(),
  lastProgressAt: Date.now(),
  blockedOutsideFocusCount: 0,

  // Actions
  enterSandbox: async (feature) => {
    try {
      const clinic = await sandboxApi.enter(feature)
      const now = Date.now()
      set({
        isSandboxMode: true,
        currentSandboxClinic: clinic,
        currentFeature: feature,
        currentGuideStep: 1,
        stepProgress: createInitialProgress(feature),
        currentStepStartedAt: now,
        lastProgressAt: now,
        blockedOutsideFocusCount: 0,
      })
    } catch (error) {
      console.error('Error entering sandbox:', error)
      throw error
    }
  },

  exitSandbox: async () => {
    const clinic = get().currentSandboxClinic
    if (!clinic) return

    try {
      await sandboxApi.exit(clinic.clinicId)
      const now = Date.now()
      set({
        isSandboxMode: false,
        currentSandboxClinic: null,
        currentFeature: null,
        currentGuideStep: 1,
        stepProgress: {},
        currentStepStartedAt: now,
        lastProgressAt: now,
        blockedOutsideFocusCount: 0,
      })
    } catch (error) {
      console.error('Error exiting sandbox:', error)
      throw error
    }
  },

  loadCurrentSandbox: async () => {
    try {
      const clinic = await sandboxApi.getCurrent()
      if (clinic) {
        const inferredFeature = inferFeatureFromSandboxName(clinic.name) ?? get().currentFeature
        const now = Date.now()
        set({
          isSandboxMode: true,
          currentSandboxClinic: clinic,
          currentFeature: inferredFeature,
          currentGuideStep: 1,
          stepProgress: inferredFeature ? createInitialProgress(inferredFeature) : {},
          currentStepStartedAt: now,
          lastProgressAt: now,
          blockedOutsideFocusCount: 0,
        })
      } else {
        const now = Date.now()
        set({
          isSandboxMode: false,
          currentSandboxClinic: null,
          currentFeature: null,
          stepProgress: {},
          currentStepStartedAt: now,
          lastProgressAt: now,
          blockedOutsideFocusCount: 0,
        })
      }
    } catch (error) {
      console.error('Error loading current sandbox:', error)
    }
  },

  setGuideStep: (step) => {
    const feature = get().currentFeature
    const totalSteps = getTotalSteps(feature)

    if (step < 1 || step > totalSteps) {
      return
    }

    const now = Date.now()
    set({
      currentGuideStep: step,
      currentStepStartedAt: now,
      blockedOutsideFocusCount: 0,
    })
  },

  completeCurrentStepAction: () => {
    const { currentGuideStep, stepProgress } = get()
    const currentProgress = stepProgress[currentGuideStep]

    if (!currentProgress) {
      return
    }

    set({
      stepProgress: {
        ...stepProgress,
        [currentGuideStep]: {
          ...currentProgress,
          actionCompleted: true,
        },
      },
      lastProgressAt: Date.now(),
      blockedOutsideFocusCount: 0,
    })
  },

  trackStepAction: (actionKey) => {
    const { currentFeature, currentGuideStep, stepProgress } = get()
    if (!currentFeature) {
      return
    }

    const currentStepDefinition = SANDBOX_GUIDE_DEFINITIONS[currentFeature][currentGuideStep - 1]
    if (!currentStepDefinition?.actionKey || currentStepDefinition.actionKey !== actionKey) {
      return
    }

    const currentProgress = stepProgress[currentGuideStep]
    if (!currentProgress || currentProgress.actionCompleted) {
      return
    }

    set({
      stepProgress: {
        ...stepProgress,
        [currentGuideStep]: {
          ...currentProgress,
          actionCompleted: true,
        },
      },
      lastProgressAt: Date.now(),
      blockedOutsideFocusCount: 0,
    })
  },

  reportBlockedOutsideFocus: () => {
    set((state) => ({
      blockedOutsideFocusCount: state.blockedOutsideFocusCount + 1,
    }))
  },

  toggleChecklistItem: (itemId) => {
    const { currentGuideStep, stepProgress } = get()
    const currentProgress = stepProgress[currentGuideStep]

    if (!currentProgress || !(itemId in currentProgress.checklistCompleted)) {
      return
    }

    set({
      stepProgress: {
        ...stepProgress,
        [currentGuideStep]: {
          ...currentProgress,
          checklistCompleted: {
            ...currentProgress.checklistCompleted,
            [itemId]: !currentProgress.checklistCompleted[itemId],
          },
        },
      },
      lastProgressAt: Date.now(),
      blockedOutsideFocusCount: 0,
    })
  },

  isCurrentStepReady: () => {
    const { currentFeature, currentGuideStep, stepProgress } = get()
    const currentProgress = stepProgress[currentGuideStep]

    if (!currentProgress || !currentFeature) {
      return false
    }

    const currentStepDefinition = SANDBOX_GUIDE_DEFINITIONS[currentFeature][currentGuideStep - 1]
    const actionIsRequired = Boolean(currentStepDefinition?.actionKey)
    const allChecklistDone = Object.values(currentProgress.checklistCompleted).every(Boolean)
    const actionIsDone = actionIsRequired ? currentProgress.actionCompleted : true

    return actionIsDone && allChecklistDone
  },

  goToNextStep: () => {
    const { currentFeature, currentGuideStep, isCurrentStepReady } = get()

    if (!currentFeature || !isCurrentStepReady()) {
      return
    }

    const totalSteps = SANDBOX_GUIDE_DEFINITIONS[currentFeature].length
    if (currentGuideStep < totalSteps) {
      const now = Date.now()
      set({
        currentGuideStep: currentGuideStep + 1,
        currentStepStartedAt: now,
        lastProgressAt: now,
        blockedOutsideFocusCount: 0,
      })
    }
  },

  reset: () => {
    const now = Date.now()
    set({
      isSandboxMode: false,
      currentSandboxClinic: null,
      currentFeature: null,
      currentGuideStep: 1,
      stepProgress: {},
      currentStepStartedAt: now,
      lastProgressAt: now,
      blockedOutsideFocusCount: 0,
    })
  },
}))
