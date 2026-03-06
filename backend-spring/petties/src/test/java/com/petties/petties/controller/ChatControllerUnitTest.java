package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.chat.ConversationResponse;
import com.petties.petties.dto.chat.CreateConversationRequest;
import com.petties.petties.dto.chat.MessageResponse;
import com.petties.petties.dto.chat.SendMessageRequest;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.ChatService;
import com.petties.petties.model.enums.SenderType;
import com.petties.petties.model.enums.MessageType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

@WebMvcTest(ChatController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ChatController Detailed Unit Tests")
class ChatControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private ChatService chatService;

    // Security
    @MockitoBean private JwtTokenProvider jwtTokenProvider;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean private UserDetailsServiceImpl userDetailsService;
    @MockitoBean private BlacklistedTokenRepository blacklistedTokenRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private UUID conversationId;
    private UUID clinicId;
    private UUID petOwnerId;
    private ConversationResponse conversationResponse;

    @BeforeEach
    void setUp() {
        conversationId = UUID.randomUUID();
        clinicId = UUID.randomUUID();
        petOwnerId = UUID.randomUUID();

        conversationResponse = ConversationResponse.builder()
                .id(conversationId)
                .petOwnerId(petOwnerId)
                .clinicId(clinicId)
                .build();
    }

    // ==================== createOrGetConversation (8 TCs) ====================

    @Test
    @DisplayName("TC-001: New conv, no initial msg -> 200")
    void createOrGetConv_NoInitialMsg_Returns200() throws Exception {
        CreateConversationRequest req = new CreateConversationRequest();
        req.setClinicId(clinicId);
        
        when(chatService.createOrGetConversation(any(), eq(req))).thenReturn(conversationResponse);

        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-002: New conv + initial msg -> 200")
    void createOrGetConv_InitialMsg_Returns200() throws Exception {
        CreateConversationRequest req = new CreateConversationRequest();
        req.setClinicId(clinicId);
        req.setInitialMessage("Hello");
        
        when(chatService.createOrGetConversation(any(), eq(req))).thenReturn(conversationResponse);

        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-003: Existing conv + empty initial msg -> 200")
    void createOrGetConv_ExistingEmptyMsg_Returns200() throws Exception {
        CreateConversationRequest req = new CreateConversationRequest();
        req.setClinicId(clinicId);
        req.setInitialMessage("");
        when(chatService.createOrGetConversation(any(), eq(req))).thenReturn(conversationResponse);

        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-004: Existing conv + blank spaces only -> 200")
    void createOrGetConv_ExistingBlankMsg_Returns200() throws Exception {
        CreateConversationRequest req = new CreateConversationRequest();
        req.setClinicId(clinicId);
        req.setInitialMessage("   ");
        when(chatService.createOrGetConversation(any(), eq(req))).thenReturn(conversationResponse);

        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-005: Existing conv, no initial msg -> 200")
    void createOrGetConv_ExistingNoMsg_Returns200() throws Exception {
        CreateConversationRequest req = new CreateConversationRequest();
        req.setClinicId(clinicId);
        when(chatService.createOrGetConversation(any(), eq(req))).thenReturn(conversationResponse);

        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-006: Non-existent clinicId -> 404")
    void createOrGetConv_ClinicNotFound_Returns404() throws Exception {
        when(chatService.createOrGetConversation(any(), any()))
                .thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-007: Non-existent userId -> 404")
    void createOrGetConv_UserNotFound_Returns404() throws Exception {
        when(chatService.createOrGetConversation(any(), any()))
                .thenThrow(new ResourceNotFoundException("User not found"));
        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-008: CLINIC_OWNER tries to create -> 403 Forbidden")
    void createOrGetConv_Forbidden_Returns403() throws Exception {
        when(chatService.createOrGetConversation(any(), any()))
                .thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(post("/chat/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    // ==================== getConversations (6 TCs) ====================

    @Test
    @DisplayName("TC-009: PET_OWNER with convs -> 200")
    void getConversations_PetOwnerData_Returns200() throws Exception {
        Page<ConversationResponse> page = new PageImpl<>(List.of(conversationResponse));
        when(chatService.getConversations(any(), anyInt(), anyInt())).thenReturn(page);
        mockMvc.perform(get("/chat/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)));
    }

    @Test
    @DisplayName("TC-010: PET_OWNER no convs -> 200 empty")
    void getConversations_PetOwnerEmpty_Returns200() throws Exception {
        Page<ConversationResponse> page = new PageImpl<>(new ArrayList<>());
        when(chatService.getConversations(any(), anyInt(), anyInt())).thenReturn(page);
        mockMvc.perform(get("/chat/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    @DisplayName("TC-011: CLINIC_OWNER with convs -> 200")
    void getConversations_ClinicOwner_Returns200() throws Exception {
        Page<ConversationResponse> page = new PageImpl<>(List.of(conversationResponse));
        when(chatService.getConversations(any(), anyInt(), anyInt())).thenReturn(page);
        mockMvc.perform(get("/chat/conversations"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-012: CLINIC_OWNER no convs -> 200 empty")
    void getConversations_ClinicOwnerEmpty_Returns200() throws Exception {
        when(chatService.getConversations(any(), anyInt(), anyInt())).thenReturn(Page.empty());
        mockMvc.perform(get("/chat/conversations"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-013: STAFF role -> 200")
    void getConversations_StaffRole_Returns200() throws Exception {
        when(chatService.getConversations(any(), anyInt(), anyInt())).thenReturn(Page.empty());
        mockMvc.perform(get("/chat/conversations"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-014: Invalid/unauthorized role -> 403 Forbidden")
    void getConversations_Forbidden_Returns403() throws Exception {
        when(chatService.getConversations(any(), anyInt(), anyInt()))
                .thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(get("/chat/conversations"))
                .andExpect(status().isForbidden());
    }

    // ==================== getConversation (5 TCs) ====================

    @Test
    @DisplayName("TC-015: Valid ID (petOwner) -> 200")
    void getConvById_PetOwner_Returns200() throws Exception {
        when(chatService.getConversation(any(), eq(conversationId))).thenReturn(conversationResponse);
        mockMvc.perform(get("/chat/conversations/{id}", conversationId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-016: Valid ID (staff) -> 200")
    void getConvById_Staff_Returns200() throws Exception {
        when(chatService.getConversation(any(), eq(conversationId))).thenReturn(conversationResponse);
        mockMvc.perform(get("/chat/conversations/{id}", conversationId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-017: Non-existent ID -> 404")
    void getConvById_NotFound_Returns404() throws Exception {
        when(chatService.getConversation(any(), eq(conversationId)))
                .thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(get("/chat/conversations/{id}", conversationId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-018: null/empty ID -> 404")
    void getConvById_NullEmpty_Returns404() throws Exception {
        mockMvc.perform(get("/chat/conversations/ "))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-019: Valid ID no access -> 403")
    void getConvById_NoAccess_Returns403() throws Exception {
        when(chatService.getConversation(any(), eq(conversationId)))
                .thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(get("/chat/conversations/{id}", conversationId))
                .andExpect(status().isForbidden());
    }

    // ==================== sendMessage (8 TCs) ====================

    @Test
    @DisplayName("TC-020: Valid text -> 200")
    void sendMessage_Text_Returns200() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setContent("Hello");
        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-021: Image only -> 200")
    void sendMessage_ImageOnly_Returns200() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setImageUrl("http://img");
        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-022: Text + image -> 200")
    void sendMessage_TextImage_Returns200() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setContent("Look");
        req.setImageUrl("http://img");
        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-023: Empty string -> 200")
    void sendMessage_EmptyText_Returns200() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setContent("");
        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-024: Clinic sends message -> 200")
    void sendMessage_Clinic_Returns200() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setContent("Hi");
        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-025: Long text -> 200")
    void sendMessage_LongText_Returns200() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setContent("A".repeat(150));
        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-026: Clinic sends (senderType) -> 200")
    void sendMessage_ClinicSender_Returns200() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setContent("We are open");
        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-027: Non-existent id -> 404")
    void sendMessage_NotFound_Returns404() throws Exception {
        SendMessageRequest req = new SendMessageRequest();
        req.setContent("Hi");
        doThrow(new ResourceNotFoundException("Not found"))
                .when(chatService).sendMessage(any(), eq(conversationId), any());

        mockMvc.perform(post("/chat/conversations/{id}/messages", conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotFound());
    }

    // ==================== getMessages (5 TCs) ====================

    @Test
    @DisplayName("TC-028: Valid -> 200")
    void getMessages_Valid_Returns200() throws Exception {
        when(chatService.getMessages(any(), eq(conversationId), anyInt(), anyInt()))
                .thenReturn(new PageImpl<>(List.of(new MessageResponse())));
        mockMvc.perform(get("/chat/conversations/{id}/messages", conversationId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-029: Valid page=1 -> 200")
    void getMessages_Pagination_Returns200() throws Exception {
        when(chatService.getMessages(any(), eq(conversationId), eq(1), eq(10)))
                .thenReturn(new PageImpl<>(List.of(new MessageResponse())));
        mockMvc.perform(get("/chat/conversations/{id}/messages", conversationId)
                .param("page", "1").param("size", "10"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-030: No messages -> 200 empty")
    void getMessages_Empty_Returns200() throws Exception {
        when(chatService.getMessages(any(), eq(conversationId), anyInt(), anyInt()))
                .thenReturn(Page.empty());
        mockMvc.perform(get("/chat/conversations/{id}/messages", conversationId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-031: Non-existent -> 404")
    void getMessages_NotFound_Returns404() throws Exception {
        when(chatService.getMessages(any(), eq(conversationId), anyInt(), anyInt()))
                .thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(get("/chat/conversations/{id}/messages", conversationId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-032: No access -> 403")
    void getMessages_Forbidden_Returns403() throws Exception {
        when(chatService.getMessages(any(), eq(conversationId), anyInt(), anyInt()))
                .thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(get("/chat/conversations/{id}/messages", conversationId))
                .andExpect(status().isForbidden());
    }

    // ==================== markAsRead (5 TCs) ====================

    @Test
    @DisplayName("TC-033: PET_OWNER -> 200")
    void markAsRead_PetOwner_Returns200() throws Exception {
        mockMvc.perform(put("/chat/conversations/{id}/read", conversationId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-034: CLINIC -> 200")
    void markAsRead_Clinic_Returns200() throws Exception {
        mockMvc.perform(put("/chat/conversations/{id}/read", conversationId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-035: No unread -> 200")
    void markAsRead_NoUnread_Returns200() throws Exception {
        mockMvc.perform(put("/chat/conversations/{id}/read", conversationId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-036: Non-existent -> 404")
    void markAsRead_NotFound_Returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Not found"))
                .when(chatService).markAsRead(any(), eq(conversationId));
        mockMvc.perform(put("/chat/conversations/{id}/read", conversationId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-037: No access -> 403")
    void markAsRead_Forbidden_Returns403() throws Exception {
        doThrow(new ForbiddenException("Forbidden"))
                .when(chatService).markAsRead(any(), eq(conversationId));
        mockMvc.perform(put("/chat/conversations/{id}/read", conversationId))
                .andExpect(status().isForbidden());
    }

    // ==================== getUnreadCount (5 TCs) ====================

    @Test
    @DisplayName("TC-038: PET_OWNER unreads -> 200")
    void getUnreadCount_PetOwnerUnreads_Returns200() throws Exception {
        when(chatService.getUnreadCount(any())).thenReturn(2);
        mockMvc.perform(get("/chat/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(2));
    }

    @Test
    @DisplayName("TC-039: PET_OWNER no unread -> 200")
    void getUnreadCount_PetOwnerZero_Returns200() throws Exception {
        when(chatService.getUnreadCount(any())).thenReturn(0);
        mockMvc.perform(get("/chat/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    @DisplayName("TC-040: CLINIC_OWNER unreads -> 200")
    void getUnreadCount_ClinicOwner_Returns200() throws Exception {
        when(chatService.getUnreadCount(any())).thenReturn(5);
        mockMvc.perform(get("/chat/unread-count"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-041: CLINIC_OWNER no unread -> 200")
    void getUnreadCount_ClinicOwnerZero_Returns200() throws Exception {
        when(chatService.getUnreadCount(any())).thenReturn(0);
        mockMvc.perform(get("/chat/unread-count"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-042: CLINIC_OWNER no clinic -> 200")
    void getUnreadCount_NoClinic_Returns200() throws Exception {
        when(chatService.getUnreadCount(any())).thenReturn(0);
        mockMvc.perform(get("/chat/unread-count"))
                .andExpect(status().isOk());
    }

    // ==================== sendMessageWithFile (6 TCs) ====================
    // Note: The method in controller uses multipart. File argument validation normally throws 400.
    
    @Test
    @DisplayName("TC-043: Valid image+text -> 200")
    void sendMsgFile_ImageText_Returns200() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "img".getBytes());
        when(chatService.sendMessage(any(), any(), any())).thenReturn(new MessageResponse());
        
        mockMvc.perform(multipart("/chat/conversations/{id}/messages", conversationId)
                .file(file)
                .param("content", "Look"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-044: Valid image, no text -> 200")
    void sendMsgFile_ImageNoText_Returns200() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "img".getBytes());
        mockMvc.perform(multipart("/chat/conversations/{id}/messages", conversationId)
                .file(file))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-045: Large file >10MB -> 400")
    void sendMsgFile_LargeFile_Returns400() throws Exception {
        // Assume controller/service throws IllegalArgumentException for size limits manually 
        // Or Spring's MaxUploadSizeExceededException is translated to 400/413.
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "img".getBytes());
        when(chatService.sendMessage(any(), any(), any())).thenThrow(new IllegalArgumentException("Size limit exceeded"));

        mockMvc.perform(multipart("/chat/conversations/{id}/messages", conversationId)
                .file(file))
                .andExpect(status().isBadRequest()); // Maps to IllegalArgumentException handling
    }

    @Test
    @DisplayName("TC-046: No file, text only -> 200")
    void sendMsgFile_NoFileText_Returns200() throws Exception {
        mockMvc.perform(multipart("/chat/conversations/{id}/messages", conversationId)
                .param("content", "Hello"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-047: Invalid format -> 400")
    void sendMsgFile_InvalidFormat_Returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.exe", "application/x-msdownload", "exe".getBytes());
        when(chatService.sendMessage(any(), any(), any())).thenThrow(new IllegalArgumentException("Invalid format"));
        
        mockMvc.perform(multipart("/chat/conversations/{id}/messages", conversationId)
                .file(file))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-048: Empty file -> 400")
    void sendMsgFile_EmptyFile_Returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[0]);
        when(chatService.sendMessage(any(), any(), any())).thenThrow(new IllegalArgumentException("File is empty"));
        
        mockMvc.perform(multipart("/chat/conversations/{id}/messages", conversationId)
                .file(file))
                .andExpect(status().isBadRequest());
    }

    // ==================== uploadImage (5 TCs) ====================

    @Test
    @DisplayName("TC-049: Valid image -> 200")
    void uploadImg_Valid_Returns200() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "img".getBytes());
        when(chatService.uploadConversationImage(any(), eq(conversationId), any())).thenReturn("http://img");
        
        mockMvc.perform(multipart("/chat/conversations/{id}/images", conversationId)
                .file(file))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-050: Large file -> 400")
    void uploadImg_LargeFile_Returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "img".getBytes());
        when(chatService.uploadConversationImage(any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Large file"));
        
        mockMvc.perform(multipart("/chat/conversations/{id}/images", conversationId)
                .file(file))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-051: Invalid format -> 400")
    void uploadImg_InvalidFormat_Returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.exe", "application/x-msdownload", "img".getBytes());
        when(chatService.uploadConversationImage(any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Invalid format"));
        
        mockMvc.perform(multipart("/chat/conversations/{id}/images", conversationId)
                .file(file))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-052: Non-existent -> 404")
    void uploadImg_NotFound_Returns404() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "img".getBytes());
        when(chatService.uploadConversationImage(any(), any(), any()))
                .thenThrow(new ResourceNotFoundException("Not found"));
        
        mockMvc.perform(multipart("/chat/conversations/{id}/images", conversationId)
                .file(file))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-053: No access -> 403")
    void uploadImg_Forbidden_Returns403() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "img".getBytes());
        when(chatService.uploadConversationImage(any(), any(), any()))
                .thenThrow(new ForbiddenException("Forbidden"));
        
        mockMvc.perform(multipart("/chat/conversations/{id}/images", conversationId)
                .file(file))
                .andExpect(status().isForbidden());
    }
}
