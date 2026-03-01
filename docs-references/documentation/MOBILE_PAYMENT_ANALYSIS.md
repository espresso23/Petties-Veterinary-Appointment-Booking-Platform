# Mobile System Analysis: Payment & Booking Structure

## 1. Mobile Project Structure Overview
The `petties_mobile` project follows a clean architecture with Feature-first or Layer-first hybrid approach:

-   **`lib/data`**: Contains data layer components.
    -   `services/`: API clients (e.g., `api_client.dart`) and feature-specific services (`pet_service.dart`, `qr_payment_service.dart`).
    -   `models/`: Data models (DTOs).
-   **`lib/ui`**: Contains the presentation layer.
    -   `screens/`: UI Screens organized by feature or role (e.g., `pet_owner`, `auth`).
    -   `widgets/`: Reusable widgets.
-   **`lib/providers`**: State management using Provider pattern.
-   **`lib/routing`**: Navigation configuration using `go_router`.

## 2. Payment Module Analysis

### Current State
-   **Service Layer**: `QrPaymentService` (`lib/data/services/qr_payment_service.dart`) handles payment interactions.
    -   Currently, it contains `checkQrStatus(bookingId)` which is essential for verifying payment status.
    -   *Previously*, it contained `createTestQrBooking()` which has been removed as per the latest refactoring.
-   **UI Layer**:
    -   Payment logic was temporarily embedded in `PetOwnerHomeScreen` for testing purposes ("Thử thanh toán QR" button).
    -   This test logic included polling for payment status (`_startQrPolling`) and displaying the QR code.
    -   This test UI has been successfully removed to clean up the production interface.

### Backend Integration
-   The backend APIs for payment and booking are reported to be complete and manually tested.
-   The `QrPaymentService` uses `ApiClient` to communicate with these endpoints.

## 3. Refactoring Summary (Completed)
As requested, the "Create Test Booking" feature has been removed from the frontend to prepare for real feature implementation.

**Changes made:**
1.  **`PetOwnerHomeScreen.dart`**:
    -   Removed "Thử thanh toán QR" button (`_buildQrTestButton`).
    -   Removed Test Payment Section (`_buildQrPaymentSection`).
    -   Removed `_createTestQrBooking` function and its state variables (`_isCreatingQrBooking`, `_qrBookingId`, etc.).
    -   Removed polling logic `_startQrPolling`.
2.  **`QrPaymentService.dart`**:
    -   Removed `createTestQrBooking()` method which called the `/dev/qr-bookings` endpoint.
    -   Kept `checkQrStatus()` as it is a valid production method for checking payment status.

## 4. Next Steps & Recommendations

With the test logic removed and Backend ready, the next steps for the Mobile App are:

1.  **Implement Real Booking Flow**:
    -   Create a "Booking" or "Appointment" screen where users can select Clinic -> Vet -> Date/Time -> Service.
    -   This flow should interact with a strictly defined `BookingService` (to be implemented if missing).

2.  **Integrate Payment into Booking**:
    -   Upon confirming a booking, the app should call the Backend to create a real booking.
    -   The Backend should return the Booking details including the Payment Info (QR Code URL, Amount).
    -   **Display QR Code**: Show the QR code to the user on a "Payment" or "Booking Confirmation" screen.
    -   **Poll for Status**: Use `QrPaymentService.checkQrStatus(bookingId)` to monitor when the user completes the transfer.

3.  **Payment Success Handling**:
    -   Once `checkQrStatus` returns `PAID`, automatically navigate the user to the "Booking Success" screen.

This refactoring ensures the codebase is clean and ready for the implementation of the actual end-to-end booking and payment user story.
