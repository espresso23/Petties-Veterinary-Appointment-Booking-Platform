package com.petties.petties.service;

import com.petties.petties.dto.subscription.ClinicSubscriptionStatusDto;
import com.petties.petties.dto.subscription.SubscribeRequestDto;
import com.petties.petties.dto.subscription.SubscriptionPlanResponseDto;
import com.petties.petties.dto.subscription.UserSubscriptionResponseDto;
import com.petties.petties.dto.subscription.MySubscriptionStatusDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserSubscriptionService {

        private final UserSubscriptionRepository subscriptionRepository;
        private final SubscriptionPlanRepository planRepository;
        private final PaymentRepository paymentRepository;
        private final ClinicRepository clinicRepository;
        private final UserRepository userRepository;

        @Value("${sepay.qr.acc:}")
        private String sepayQrAcc;

        @Value("${sepay.qr.bank:}")
        private String sepayQrBank;

        @Transactional
        public UserSubscriptionResponseDto initiateSubscription(UUID userId, SubscribeRequestDto request) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

                Clinic clinic = clinicRepository.findById(request.getClinicId())
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                // Verify ownership
                if (!clinic.getOwner().getUserId().equals(userId)) {
                        throw new BadRequestException("Bạn không có quyền đăng ký cho phòng khám này");
                }

                SubscriptionPlan plan = planRepository.findById(request.getPlanId())
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy gói hội viên"));

                if (!plan.getIsActive()) {
                        throw new BadRequestException("Gói hội viên này hiện không khả dụng");
                }

                // Prevent multiple pending subscriptions
                Optional<UserSubscription> pending = subscriptionRepository
                                .findFirstByClinicClinicIdAndStatusOrderByCreatedAtDesc(
                                                clinic.getClinicId(), UserSubscriptionStatus.PENDING_PAYMENT);
                if (pending.isPresent()) {
                        throw new BadRequestException(
                                        "Phòng khám đang có một đăng ký chờ thanh toán. Vui lòng hoàn tất hoặc hủy trước khi đăng ký gói mới.");
                }

                // Prevent purchasing if already active (unless within 3 days of expiry for
                // renewal)
                Optional<UserSubscription> active = subscriptionRepository
                                .findFirstByClinicClinicIdAndStatusOrderByCreatedAtDesc(
                                                clinic.getClinicId(), UserSubscriptionStatus.ACTIVE);
                if (active.isPresent()) {
                        LocalDateTime expiryDate = active.get().getEndDate();
                        if (expiryDate != null && expiryDate
                                        .isAfter(LocalDateTime.now().plusDays(3).withHour(23).withMinute(59))) {
                                throw new BadRequestException(
                                                "Phòng khám đã có gói hội viên đang hoạt động. Bạn chỉ có thể gia hạn hoặc mua gói mới khi còn dưới 3 ngày sử dụng.");
                        }
                }

                // Create subscription
                UserSubscription subscription = UserSubscription.builder()
                                .user(user)
                                .clinic(clinic)
                                .plan(plan)
                                .status(UserSubscriptionStatus.PENDING_PAYMENT)
                                .paymentMethod(request.getPaymentMethod())
                                .cancelAtPeriodEnd(false)
                                .build();

                UserSubscription savedSubscription = subscriptionRepository.save(subscription);

                // Create Initial Payment
                String shortId = savedSubscription.getSubscriptionId().toString().split("-")[0].toUpperCase();
                String paymentDescription = "SUB" + shortId;

                Payment payment = Payment.builder()
                                .subscription(savedSubscription)
                                .amount(plan.getPrice())
                                .method(request.getPaymentMethod())
                                .status(PaymentStatus.PENDING)
                                .paymentDescription(paymentDescription)
                                .build();

                paymentRepository.save(payment);

                log.info("Initiated subscription for clinic {}: {}", clinic.getName(), plan.getName());
                return mapToResponse(savedSubscription);
        }

        @Transactional(readOnly = true)
        public List<UserSubscriptionResponseDto> getAllSubscriptions() {
                return subscriptionRepository.findAllByOrderByCreatedAtDesc()
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        @Transactional(readOnly = true)
        public ClinicSubscriptionStatusDto getClinicSubscriptionStatus(UUID clinicId) {
                Optional<UserSubscription> active = subscriptionRepository.findActiveSubscriptionByClinicId(clinicId);
                Optional<UserSubscription> pending = subscriptionRepository
                                .findFirstByClinicClinicIdAndStatusOrderByCreatedAtDesc(
                                                clinicId, UserSubscriptionStatus.PENDING_PAYMENT);

                return ClinicSubscriptionStatusDto.builder()
                                .active(active.map(this::mapToResponse).orElse(null))
                                .pending(pending.map(this::mapToResponse).orElse(null))
                                .build();
        }

        @Transactional(readOnly = true)
        public UserSubscriptionResponseDto getClinicSubscription(UUID clinicId) {
                // Return latest non-cancelled
                UserSubscription subscription = subscriptionRepository
                                .findFirstByClinicClinicIdAndStatusNotOrderByCreatedAtDesc(clinicId,
                                                UserSubscriptionStatus.CANCELLED)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Phòng khám chưa đăng ký gói hội viên nào"));
                return mapToResponse(subscription);
        }

        @Transactional(readOnly = true)
        public List<UserSubscriptionResponseDto> getClinicSubscriptionHistory(UUID clinicId) {
                return subscriptionRepository.findByClinicClinicIdOrderByCreatedAtDesc(clinicId)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        @Transactional
        public UserSubscriptionResponseDto cancelClinicSubscription(UUID clinicId) {
                UserSubscription subscription = subscriptionRepository
                                .findFirstByClinicClinicIdOrderByCreatedAtDesc(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Phòng khám chưa đăng ký gói hội viên nào"));

                if (subscription.getStatus() == UserSubscriptionStatus.PENDING_PAYMENT) {
                        subscription.setStatus(UserSubscriptionStatus.CANCELLED);
                        subscriptionRepository.save(subscription);
                        log.info("Cancelled pending subscription for clinic ID: {}", clinicId);
                        return mapToResponse(subscription);
                }

                if (subscription.getStatus() != UserSubscriptionStatus.ACTIVE) {
                        throw new BadRequestException("Chỉ có thể hủy những gói đang hoạt động hoặc chờ thanh toán");
                }

                if (subscription.getCancelAtPeriodEnd() != null && subscription.getCancelAtPeriodEnd()) {
                        throw new BadRequestException("Gói hội viên này đã được yêu cầu hủy");
                }

                // Cập nhật trạng thái không tự động gia hạn (Hủy ngang nhưng dùng đến hết kỳ)
                subscription.setCancelAtPeriodEnd(true);
                UserSubscription savedSubscription = subscriptionRepository.save(subscription);

                log.info("Cancelled subscription for clinic ID: {}", clinicId);
                return mapToResponse(savedSubscription);
        }

        @Transactional
        public UserSubscriptionResponseDto cancelSubscriptionById(UUID subscriptionId) {
                UserSubscription subscription = subscriptionRepository.findById(subscriptionId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy đăng ký gói hội viên"));

                if (subscription.getStatus() == UserSubscriptionStatus.PENDING_PAYMENT) {
                        subscription.setStatus(UserSubscriptionStatus.CANCELLED);
                        UserSubscription saved = subscriptionRepository.save(subscription);
                        log.info("Cancelled pending subscription by ID: {}", subscriptionId);
                        return mapToResponse(saved);
                }

                if (subscription.getStatus() == UserSubscriptionStatus.ACTIVE) {
                        subscription.setCancelAtPeriodEnd(true);
                        UserSubscription saved = subscriptionRepository.save(subscription);
                        log.info("Cancelled active subscription (stop auto-renew) by ID: {}", subscriptionId);
                        return mapToResponse(saved);
                }

                throw new BadRequestException("Không thể hủy gói hội viên ở trạng thái " + subscription.getStatus());
        }

        private UserSubscriptionResponseDto mapToResponse(UserSubscription subscription) {
                UserSubscriptionResponseDto dto = UserSubscriptionResponseDto.builder()
                                .subscriptionId(subscription.getSubscriptionId())
                                .clinicId(subscription.getClinic().getClinicId())
                                .clinicName(subscription.getClinic().getName())
                                .plan(SubscriptionPlanResponseDto.builder()
                                                .planId(subscription.getPlan().getPlanId())
                                                .name(subscription.getPlan().getName())
                                                .price(subscription.getPlan().getPrice())
                                                .durationDays(subscription.getPlan().getDurationDays())
                                                .features(subscription.getPlan().getFeatures())
                                                .build())
                                .status(subscription.getStatus())
                                .paymentMethod(subscription.getPaymentMethod())
                                .startDate(subscription.getStartDate())
                                .endDate(subscription.getEndDate())
                                .cancelAtPeriodEnd(subscription.getCancelAtPeriodEnd())
                                .build();

                // If pending payment, find the associated payment and generate QR info
                if (subscription.getStatus() == UserSubscriptionStatus.PENDING_PAYMENT) {
                        paymentRepository.findFirstBySubscriptionSubscriptionIdOrderByCreatedAtDesc(
                                        subscription.getSubscriptionId())
                                        .ifPresent(payment -> {
                                                dto.setPaymentDescription(payment.getPaymentDescription());
                                                if (payment.getMethod() == com.petties.petties.model.enums.PaymentMethod.QR) {
                                                        String qrUrl = String.format(
                                                                        "https://img.vietqr.io/image/%s-%s-compact2.jpg?amount=%d&addInfo=%s",
                                                                        sepayQrBank,
                                                                        sepayQrAcc,
                                                                        payment.getAmount().longValue(),
                                                                        payment.getPaymentDescription());
                                                        dto.setQrUrl(qrUrl);
                                                }
                                        });
                }

                return dto;
        }

        @Transactional(readOnly = true)
        public MySubscriptionStatusDto getMySubscriptionStatus(User currentUser) {
                String role = currentUser.getRole().name();
                boolean isPetOwner = role.equals("PET_OWNER");
                
                // DEV mode check - can be from env variable
                boolean isDevMode = isPetOwner; // PET_OWNER always get dev mode response for now
                
                // PET_OWNER: Return mock active subscription
                if (isPetOwner) {
                        log.info("PET_OWNER subscription status: returning mock active");
                        return MySubscriptionStatusDto.builder()
                                .status("ACTIVE")
                                .planName("Pet Owner Free")
                                .userRole(role)
                                .clinicId(null)
                                .clinicName(null)
                                .startDate(null)
                                .endDate(null)
                                .isPetOwner(true)
                                .isDevMode(true)
                                .build();
                }
                
                // CLINIC_OWNER, STAFF: Get subscription from clinic
                // For now, return NOT_SUBSCRIBED if no clinic or no subscription
                // This will be expanded when workingClinicId is properly set
                if (currentUser.getWorkingClinic() == null) {
                        log.info("User {} has no working clinic, returning not subscribed", currentUser.getUserId());
                        return MySubscriptionStatusDto.builder()
                                .status("NOT_SUBSCRIBED")
                                .planName(null)
                                .userRole(role)
                                .clinicId(null)
                                .clinicName(null)
                                .startDate(null)
                                .endDate(null)
                                .isPetOwner(false)
                                .isDevMode(false)
                                .build();
                }
                
                // Get subscription for working clinic
                var clinic = currentUser.getWorkingClinic();
                try {
                        var subscription = getClinicSubscription(clinic.getClinicId());
                        return MySubscriptionStatusDto.builder()
                                .status(subscription.getStatus().name())
                                .planName(subscription.getPlan().getName())
                                .userRole(role)
                                .clinicId(clinic.getClinicId())
                                .clinicName(clinic.getName())
                                .startDate(subscription.getStartDate())
                                .endDate(subscription.getEndDate())
                                .isPetOwner(false)
                                .isDevMode(false)
                                .build();
                } catch (ResourceNotFoundException e) {
                        log.info("Clinic {} has no subscription", clinic.getClinicId());
                        return MySubscriptionStatusDto.builder()
                                .status("NOT_SUBSCRIBED")
                                .planName(null)
                                .userRole(role)
                                .clinicId(clinic.getClinicId())
                                .clinicName(clinic.getName())
                                .startDate(null)
                                .endDate(null)
                                .isPetOwner(false)
                                .isDevMode(false)
                                .build();
                }
        }
}
