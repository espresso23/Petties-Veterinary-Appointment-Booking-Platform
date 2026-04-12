package com.petties.petties.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * EMR Image - Ảnh đính kèm trong bệnh án
 * 
 * Embedded document trong EmrRecord (MongoDB)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmrImage {
    private String url;
    private String description;
}
