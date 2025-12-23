package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.clinic.ClinicRequest;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.ClinicService;
import com.petties.petties.service.CloudinaryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ClinicController Unit Tests")
class ClinicControllerUnitTest {

    private MockMvc mockMvc;

    @Mock
    private ClinicService clinicService;

    @Mock
    private AuthService authService;

    @Mock
    private CloudinaryService cloudinaryService;

    @InjectMocks
    private ClinicController clinicController;

    private ObjectMapper objectMapper;

    @BeforeEach
    @SuppressWarnings({"unchecked", "rawtypes", "removal"})
    void setup() {
        objectMapper = new ObjectMapper();
        // Custom serializer for Page to avoid module dependencies
        var pageModule = new com.fasterxml.jackson.databind.module.SimpleModule();
        pageModule.addSerializer((Class) org.springframework.data.domain.Page.class,
                new com.fasterxml.jackson.databind.JsonSerializer<org.springframework.data.domain.Page<?>>() {
                    @Override
                    public void serialize(org.springframework.data.domain.Page<?> value,
                                           com.fasterxml.jackson.core.JsonGenerator gen,
                                           com.fasterxml.jackson.databind.SerializerProvider serializers) throws java.io.IOException {
                        gen.writeStartObject();
                        gen.writeObjectField("content", value.getContent());
                        gen.writeNumberField("totalElements", value.getTotalElements());
                        gen.writeNumberField("totalPages", value.getTotalPages());
                        gen.writeNumberField("size", value.getSize());
                        gen.writeNumberField("number", value.getNumber());
                        gen.writeEndObject();
                    }
                });
        objectMapper.registerModule(pageModule);
        mockMvc = MockMvcBuilders.standaloneSetup(clinicController)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();
    }

    private User mockUser() {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        return u;
    }

    private ClinicResponse mockClinic(UUID id, String name) {
        return ClinicResponse.builder()
                .clinicId(id)
                .name(name)
                .status(ClinicStatus.PENDING)
                .address("123 Street")
                .phone("0900000000")
                .build();
    }

    @Test
    @DisplayName("GET /clinics - return paged clinics")
    void getAllClinics_returns200() throws Exception {
        Page<ClinicResponse> page = new PageImpl<>(List.of(
                mockClinic(UUID.randomUUID(), "Clinic A"),
                mockClinic(UUID.randomUUID(), "Clinic B")
        ));
        when(clinicService.getAllClinics(any(), any(), any())).thenReturn(page);

        mockMvc.perform(get("/clinics")
                        .param("status", "PENDING")
                        .param("name", "Clinic")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].name").value("Clinic A"));
    }

    @Test
    @DisplayName("GET /clinics/{id} - return clinic detail")
    void getClinicById_returns200() throws Exception {
        UUID id = UUID.randomUUID();
        when(clinicService.getClinicById(id)).thenReturn(mockClinic(id, "Clinic Detail"));

        mockMvc.perform(get("/clinics/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Clinic Detail"));
    }

    @Test
    @DisplayName("POST /clinics - create clinic returns 201")
    void createClinic_returns201() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name("New Clinic")
                .address("123 Street")
                .phone("0900000000")
                .build();

        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);
        when(clinicService.createClinic(any(ClinicRequest.class), eq(user.getUserId())))
                .thenReturn(mockClinic(UUID.randomUUID(), "New Clinic"));

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("New Clinic"));
    }

    @Test
    @DisplayName("POST /clinics/{id}/images - upload clinic image returns 201")
    void uploadClinicImage_returns201() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "image.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "fake-image".getBytes()
        );

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("http://cloudinary.com/image.jpg")
                .publicId("publicId")
                .build();
        given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

        ClinicResponse resp = mockClinic(clinicId, "With Image");
        resp.setImages(List.of("http://cloudinary.com/image.jpg"));
        when(clinicService.uploadClinicImage(eq(clinicId), anyString(), any(), any(), any(), eq(user.getUserId())))
                .thenReturn(resp);

        mockMvc.perform(multipart("/clinics/{id}/images", clinicId)
                        .file(file)
                        .param("isPrimary", "true"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.images", hasSize(1)));
    }

    @Test
    @DisplayName("POST /clinics/{id}/images/{imageId}/primary - set primary image returns 200")
    void setPrimaryImage_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        ClinicResponse resp = mockClinic(clinicId, "Primary");
        resp.setImages(List.of("http://cloudinary.com/primary.jpg"));
        when(clinicService.setPrimaryClinicImage(eq(clinicId), eq(imageId), eq(user.getUserId())))
                .thenReturn(resp);

        mockMvc.perform(post("/clinics/{id}/images/{imageId}/primary", clinicId, imageId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images", hasSize(1)));
    }

    @Test
    @DisplayName("DELETE /clinics/{id}/images/{imageId} - delete image returns 200")
    void deleteImage_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        when(authService.getCurrentUser()).thenReturn(mockUser());

        mockMvc.perform(delete("/clinics/{id}/images/{imageId}", clinicId, imageId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Image deleted successfully"));
    }
}

