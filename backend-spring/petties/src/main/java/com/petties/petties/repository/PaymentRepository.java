package com.petties.petties.repository;

import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Payment Repository - Data Access Layer cho Payment entity
 * 
 * Cung cấp các phương thức để thao tác với bảng payments trong database
 */
@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

  // ========== BASIC QUERIES ==========

  /**
   * Tìm payment theo booking ID (1-1 relationship)
   */
  Optional<Payment> findByBookingBookingId(UUID bookingId);

  Optional<Payment> findByPaymentDescription(String paymentDescription);

  Optional<Payment> findFirstBySubscriptionSubscriptionIdOrderByCreatedAtDesc(UUID subscriptionId);

  void deleteAllBySubscriptionIsNotNull();

  /**
   * Check xem booking đã có payment chưa
   */
  boolean existsByBookingBookingId(UUID bookingId);

  boolean existsByPaymentDescription(String paymentDescription);

  /**
   * Tìm payment theo payment method
   */
  List<Payment> findByMethod(com.petties.petties.model.enums.PaymentMethod method);

  @EntityGraph(attributePaths = { "booking", "booking.petOwner" })
  List<Payment> findByBookingPetOwnerUserIdOrderByCreatedAtDesc(UUID petOwnerId, Pageable pageable);

  @EntityGraph(attributePaths = { "booking", "booking.petOwner" })
  List<Payment> findByBookingPetOwnerUserIdAndStatusOrderByCreatedAtDesc(UUID petOwnerId, PaymentStatus status,
      Pageable pageable);

  // ========== CLINIC-BASED QUERIES ==========

  /**
   * Find payments by clinic ID
   */
  @EntityGraph(attributePaths = { "booking", "booking.clinic", "booking.petOwner" })
  List<Payment> findByBookingClinicClinicIdOrderByCreatedAtDesc(UUID clinicId, Pageable pageable);

  @EntityGraph(attributePaths = { "booking", "booking.clinic", "booking.petOwner" })
  List<Payment> findByBookingClinicClinicIdAndStatusOrderByCreatedAtDesc(UUID clinicId, PaymentStatus status,
      Pageable pageable);

  /**
   * Find payments by clinic with optional payment status and booking status
   * filter.
   * When bookingStatuses is null, no filter on booking status.
   */
  @Query("SELECT p FROM Payment p JOIN FETCH p.booking b LEFT JOIN FETCH b.petOwner LEFT JOIN FETCH b.clinic "
      + "WHERE b.clinic.clinicId = :clinicId "
      + "AND (:pStatus IS NULL OR p.status = :pStatus) "
      + "AND (:bStatuses IS NULL OR b.status IN :bStatuses) "
      + "ORDER BY p.createdAt DESC")
  List<Payment> findByClinicAndOptionalFilters(
      @Param("clinicId") UUID clinicId,
      @Param("pStatus") PaymentStatus pStatus,
      @Param("bStatuses") List<BookingStatus> bStatuses,
      Pageable pageable);

  /**
   * Revenue summary: sum of PAID payments by clinic, grouped by period.
   * Returns List of [period_start (Timestamp), total (BigDecimal)].
   */
  @Query(value = """
      SELECT date_trunc('day', p.paid_at) AS period_start, COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      INNER JOIN bookings b ON p.booking_id = b.booking_id
      WHERE b.clinic_id = :clinicId AND p.status = 'PAID' AND p.paid_at IS NOT NULL
        AND p.paid_at >= (CURRENT_DATE - INTERVAL '30 days')
      GROUP BY date_trunc('day', p.paid_at)
      ORDER BY period_start DESC
      LIMIT 30
      """, nativeQuery = true)
  List<Object[]> getRevenueByDay(@Param("clinicId") UUID clinicId);

  @Query(value = """
      SELECT date_trunc('week', p.paid_at) AS period_start, COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      INNER JOIN bookings b ON p.booking_id = b.booking_id
      WHERE b.clinic_id = :clinicId AND p.status = 'PAID' AND p.paid_at IS NOT NULL
        AND p.paid_at >= (CURRENT_DATE - INTERVAL '84 days')
      GROUP BY date_trunc('week', p.paid_at)
      ORDER BY period_start DESC
      LIMIT 12
      """, nativeQuery = true)
  List<Object[]> getRevenueByWeek(@Param("clinicId") UUID clinicId);

  @Query(value = """
      SELECT date_trunc('month', p.paid_at) AS period_start, COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      INNER JOIN bookings b ON p.booking_id = b.booking_id
      WHERE b.clinic_id = :clinicId AND p.status = 'PAID' AND p.paid_at IS NOT NULL
        AND p.paid_at >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY date_trunc('month', p.paid_at)
      ORDER BY period_start DESC
      LIMIT 12
      """, nativeQuery = true)
  List<Object[]> getRevenueByMonth(@Param("clinicId") UUID clinicId);

  @Query(value = """
      SELECT date_trunc('year', p.paid_at) AS period_start, COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      INNER JOIN bookings b ON p.booking_id = b.booking_id
      WHERE b.clinic_id = :clinicId AND p.status = 'PAID' AND p.paid_at IS NOT NULL
        AND p.paid_at >= (CURRENT_DATE - INTERVAL '5 years')
      GROUP BY date_trunc('year', p.paid_at)
      ORDER BY period_start DESC
      LIMIT 5
      """, nativeQuery = true)
  List<Object[]> getRevenueByYear(@Param("clinicId") UUID clinicId);

  @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.booking.clinic.clinicId = :clinicId AND p.status = 'PAID' AND p.paidAt IS NOT NULL")
  BigDecimal getTotalPaidByClinic(@Param("clinicId") UUID clinicId);

  @Query(value = """
      SELECT DISTINCT b.clinic_id as clinic_id,
             COALESCE(SUM(CASE WHEN p.method = 'QR' THEN p.amount ELSE 0 END), 0) as total_qr,
             COALESCE(SUM(CASE WHEN p.method = 'CASH' THEN p.amount ELSE 0 END), 0) as total_cash
      FROM payments p
      INNER JOIN bookings b ON p.booking_id = b.booking_id
      WHERE p.status = 'PAID' AND p.paid_at IS NOT NULL
      GROUP BY b.clinic_id
      """, nativeQuery = true)
  List<Object[]> findClinicIdsWithPaidPayments();

  @Query("SELECT SUM(p.amount) FROM Payment p WHERE p.booking.clinic.clinicId = :clinicId AND p.method = :method AND p.status = :status")
  BigDecimal sumAmountByClinicIdAndMethodAndStatus(
      @Param("clinicId") UUID clinicId,
      @Param("method") PaymentMethod method,
      @Param("status") PaymentStatus status);

  @Query("SELECT p FROM Payment p WHERE p.booking.clinic.clinicId = :clinicId AND p.method = :method AND p.status = 'PAID' ORDER BY p.paidAt DESC")
  List<Payment> findPaidByClinicAndMethod(
      @Param("clinicId") UUID clinicId,
      @Param("method") PaymentMethod method,
      Pageable pageable);

  @Query(value = "SELECT COALESCE(SUM(p.amount), 0) FROM payments p " +
      "INNER JOIN bookings b ON p.booking_id = b.booking_id " +
      "WHERE b.clinic_id = :clinicId " +
      "AND p.method = :method " +
      "AND p.status = 'PAID' " +
      "AND TO_CHAR(p.paid_at, 'YYYY-MM') = :period", nativeQuery = true)
  BigDecimal sumAmountByClinicAndMethodAndPeriod(
      @Param("clinicId") UUID clinicId,
      @Param("method") String method,
      @Param("period") String period);

  @Query(value = """
      SELECT date_trunc('day', p.paid_at) AS date, COALESCE(SUM(p.amount), 0) AS balance
      FROM payments p
      INNER JOIN bookings b ON p.booking_id = b.booking_id
      WHERE b.clinic_id = :clinicId AND p.status = 'PAID' AND p.paid_at IS NOT NULL
        AND p.paid_at >= (CURRENT_DATE - CAST(:days || ' days' AS INTERVAL))
      GROUP BY date_trunc('day', p.paid_at)
      ORDER BY date ASC
      """, nativeQuery = true)
  List<Object[]> getDailyRevenueLastNDays(@Param("clinicId") UUID clinicId, @Param("days") int days);
}
