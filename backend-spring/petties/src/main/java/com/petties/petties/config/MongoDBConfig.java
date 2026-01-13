package com.petties.petties.config;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.bson.UuidRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.convert.DefaultDbRefResolver;
import org.springframework.data.mongodb.core.convert.DefaultMongoTypeMapper;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Date;
import java.util.concurrent.TimeUnit;

/**
 * MongoDB Configuration for AI Chat History and Logs.
 *
 * Environments:
 * - Dev: Local MongoDB Docker (mongodb:7)
 * - Test/Prod: MongoDB Atlas (cloud)
 *
 * Best Practices:
 * - Connection pooling with configurable pool size
 * - Timeout settings for connection and socket
 * - Removes _class field from documents for cleaner data
 * - Supports MongoAuditing for @CreatedDate, @LastModifiedDate
 */
@Configuration
@EnableMongoAuditing
public class MongoDBConfig {

        @Value("${spring.data.mongodb.uri:mongodb://localhost:27017/petties_nosql}")
        private String mongoUri;

        @Bean
        public MongoClient mongoClient() {
                ConnectionString connectionString = new ConnectionString(mongoUri);

                MongoClientSettings settings = MongoClientSettings.builder()
                                .applyConnectionString(connectionString)
                                .uuidRepresentation(UuidRepresentation.STANDARD)
                                .applyToConnectionPoolSettings(builder -> builder
                                                .maxSize(10) // Max connections in pool
                                                .minSize(2) // Min connections kept alive
                                                .maxWaitTime(5000, TimeUnit.MILLISECONDS))
                                .applyToSocketSettings(builder -> builder
                                                .connectTimeout(10000, TimeUnit.MILLISECONDS)
                                                .readTimeout(15000, TimeUnit.MILLISECONDS))
                                .build();

                return MongoClients.create(settings);
        }

        @Bean
        public MongoDatabaseFactory mongoDatabaseFactory(MongoClient mongoClient) {
                ConnectionString connectionString = new ConnectionString(mongoUri);
                String database = connectionString.getDatabase() != null
                                ? connectionString.getDatabase()
                                : "petties_nosql";
                return new SimpleMongoClientDatabaseFactory(mongoClient, database);
        }

        @Bean
        public MongoTemplate mongoTemplate(MongoDatabaseFactory factory,
                        MongoMappingContext mappingContext) {
                MappingMongoConverter converter = new MappingMongoConverter(
                                new DefaultDbRefResolver(factory), mappingContext);
                // Remove _class field from documents for cleaner storage
                converter.setTypeMapper(new DefaultMongoTypeMapper(null));
                // Add custom conversions for Date <-> LocalDateTime
                converter.setCustomConversions(mongoCustomConversions());
                converter.afterPropertiesSet();
                return new MongoTemplate(factory, converter);
        }

        @Bean
        public MongoCustomConversions mongoCustomConversions() {
                return new MongoCustomConversions(Arrays.asList(
                        new DateToLocalDateTimeConverter(),
                        new LocalDateTimeToDateConverter()
                ));
        }

        /**
         * Converter: Date -> LocalDateTime
         */
        private static class DateToLocalDateTimeConverter implements Converter<Date, LocalDateTime> {
                @Override
                public LocalDateTime convert(Date source) {
                        return source.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
                }
        }

        /**
         * Converter: LocalDateTime -> Date
         */
        private static class LocalDateTimeToDateConverter implements Converter<LocalDateTime, Date> {
                @Override
                public Date convert(LocalDateTime source) {
                        return Date.from(source.atZone(ZoneId.systemDefault()).toInstant());
                }
        }
}
