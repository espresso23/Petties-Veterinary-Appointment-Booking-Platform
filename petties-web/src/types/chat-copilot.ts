export type ChatStage = 'IDLE' | 'COLLECTING' | 'PRESENTING' | 'CONFIRMING' | 'BOOKED'

export type UIActionType =
  | 'select_item'
  | 'select_services'
  | 'confirm_booking'
  | 'confirm_service_create'
  | 'confirm_service_batch_create'
  | 'confirm_service_update'
  | 'open_native_confirm'
  | 'cancel_flow'
  | 'load_more'
  | 'open_detail'
  | 'retry_with_change'
  | 'dismiss'

export type UIComponentType =
  | 'pet_card'
  | 'clinic_card'
  | 'service_card'
  | 'service_chip'
  | 'slot_button'
  | 'booking_summary'
  | 'emr_summary'
  | 'vaccination_card'
  | 'text'
  | 'badge'
  | 'button'
  | 'empty_state'
  | 'error_card'
  | 'booking_list_card'
  | 'booking_detail_card'
  | 'clinic_today_summary'
  | 'daily_summary_card'
  | 'staff_schedule_card'
  | 'staff_list_card'
  | 'clinic_service_list_card'
  | 'service_detail_card'
  | 'confirmation_card'
  | 'action_confirmation_card'

export interface UIAction {
  type: UIActionType
  label: string
  payload?: Record<string, unknown>
}

export interface UIComponent {
  type: UIComponentType
  id: string
  data: Record<string, unknown>
  actions?: UIAction[]
}

export interface UISchemaV1 {
  version: '1.0'
  layout: 'list' | 'grid' | 'card' | 'slot_grid'
  components: UIComponent[]
  metadata?: {
    title?: string
    description?: string
    empty_state?: string
    pagination?: {
      total: number
      shown: number
      has_more: boolean
      next_cursor?: string
    }
  }
}
