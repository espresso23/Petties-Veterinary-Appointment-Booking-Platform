package com.petties.petties.repository;

import com.petties.petties.model.UserStrikeConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserStrikeConfigRepository extends JpaRepository<UserStrikeConfig, String> {
}
