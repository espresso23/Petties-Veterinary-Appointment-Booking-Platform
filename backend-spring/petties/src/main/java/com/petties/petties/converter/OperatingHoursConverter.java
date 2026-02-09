package com.petties.petties.converter;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalTimeSerializer;
import com.petties.petties.model.OperatingHours;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Converter for OperatingHours Map to/from JSONB
 * Handles LocalTime serialization/deserialization properly
 */
@Converter
@Slf4j
public class OperatingHoursConverter implements AttributeConverter<Map<String, OperatingHours>, String> {

    private static final ObjectMapper objectMapper;

    static {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        // Ignore unknown properties for backward compatibility with legacy formats
        objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        // Custom LocalTime serializer/deserializer with HH:mm format
        SimpleModule timeModule = new SimpleModule();
        timeModule.addSerializer(LocalTime.class, new LocalTimeSerializer(DateTimeFormatter.ofPattern("HH:mm")));
        timeModule.addDeserializer(LocalTime.class, new LocalTimeDeserializer(DateTimeFormatter.ofPattern("HH:mm")));
        objectMapper.registerModule(timeModule);

        // Disable writing dates as timestamps
        objectMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Override
    public String convertToDatabaseColumn(Map<String, OperatingHours> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(attribute);
        } catch (Exception e) {
            log.error("Error converting OperatingHours to JSON", e);
            throw new RuntimeException("Failed to convert OperatingHours to JSON", e);
        }
    }

    @Override
    public Map<String, OperatingHours> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return new HashMap<>();
        }
        try {
            TypeReference<Map<String, OperatingHours>> typeRef = new TypeReference<Map<String, OperatingHours>>() {
            };
            return objectMapper.readValue(dbData, typeRef);
        } catch (Exception e) {
            log.error("Error converting JSON to OperatingHours. JSON: {}", dbData, e);
            throw new RuntimeException("Failed to convert JSON to OperatingHours", e);
        }
    }
}
