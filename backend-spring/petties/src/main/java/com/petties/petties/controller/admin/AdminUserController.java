package com.petties.petties.controller.admin;

import com.petties.petties.dto.response.AdminUserSummaryResponse;
import com.petties.petties.dto.user.AdminRestrictUserRequest;
import com.petties.petties.model.enums.Role;
import com.petties.petties.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<Page<AdminUserSummaryResponse>> getUsersForNotificationTarget(
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdTo,
            @RequestParam(defaultValue = "ALL") String strikeStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AdminUserSummaryResponse> users = userService.searchUsersForAdmin(
                role,
                search,
                createdFrom,
                createdTo,
                strikeStatus,
                pageable);

        return ResponseEntity.ok(users);
    }

    @PostMapping("/{userId}/restrict")
    public ResponseEntity<AdminUserSummaryResponse> restrictUser(
            @PathVariable java.util.UUID userId,
            @Valid @RequestBody AdminRestrictUserRequest request) {
        return ResponseEntity.ok(userService.restrictUserForAdmin(userId, request));
    }

    @PostMapping("/{userId}/lift-strike")
    public ResponseEntity<AdminUserSummaryResponse> liftUserStrike(@PathVariable java.util.UUID userId) {
        return ResponseEntity.ok(userService.liftUserStrikeForAdmin(userId));
    }
}
