package com.petties.petties.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * JPA Configuration for PostgreSQL database.
 *
 * Enables JPA Auditing for automatic population of:
 * - @CreatedDate: Set when entity is first persisted
 * - @LastModifiedDate: Updated on every save
 *
 * Note: This is separate from @EnableMongoAuditing in MongoDBConfig
 * which handles auditing for MongoDB documents.
 */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
