# AI/AGENT IMPROVEMENTS ROADMAP

**Version:** 1.0
**Last Updated:** December 13, 2025
**Purpose:** Các cải tiến để Agent thông minh hơn từng ngày

---

## OVERVIEW

Document này mô tả các cải tiến AI/Agent có thể áp dụng để hệ thống Petties Agent ngày càng thông minh hơn, từ cơ bản đến nâng cao.

---

## LEVEL 1: FOUNDATION IMPROVEMENTS (Dễ - 1-2 tuần)

### 1.1 Prompt Engineering Optimization

**Mục tiêu:** Cải thiện chất lượng phản hồi mà không cần thay đổi code

| Improvement | Description | Impact |
|-------------|-------------|--------|
| **Few-Shot Examples trong Prompt** | Thêm 3-5 ví dụ vào system prompt để LLM hiểu format mong muốn | High |
| **Chain-of-Thought Prompting** | Yêu cầu LLM giải thích reasoning trước khi trả lời | Medium |
| **Role-Playing Enhancement** | Định nghĩa rõ persona: "Bạn là bác sĩ thú y với 10 năm kinh nghiệm..." | Medium |
| **Output Format Specification** | Định dạng output rõ ràng (JSON, Markdown) | High |

**Example - Medical Agent Prompt Enhancement:**
```markdown
# System Prompt - Medical Agent v2.0

Bạn là Dr. Petties - Bác sĩ thú y ảo với kiến thức chuyên sâu.

## Quy trình chẩn đoán:
1. Thu thập thông tin: Loài, tuổi, cân nặng, triệu chứng
2. Phân tích triệu chứng với knowledge base
3. Đưa ra chẩn đoán sơ bộ (KHÔNG phải chẩn đoán cuối cùng)
4. Khuyến nghị hành động tiếp theo

## Ví dụ tương tác:
User: "Mèo nhà tôi 2 tuổi bị nôn"
Assistant: "Tôi cần thêm thông tin để đánh giá:
- Mèo nôn bao nhiêu lần trong ngày?
- Có bỏ ăn không?
- Phân có bình thường không?
- Mèo có tiêm phòng đầy đủ chưa?"

## Lưu ý quan trọng:
- LUÔN hỏi thêm nếu thiếu thông tin
- KHÔNG đưa ra chẩn đoán tuyệt đối
- Khuyên đến phòng khám nếu nghiêm trọng
- Trích dẫn nguồn khi sử dụng knowledge base
```

---

### 1.2 Context Management Enhancement

**Mục tiêu:** Giữ ngữ cảnh cuộc hội thoại tốt hơn

| Improvement | Description | Implementation |
|-------------|-------------|----------------|
| **Conversation Summarization** | Tóm tắt hội thoại dài để fit context window | Use LLM to summarize every 10 messages |
| **Entity Extraction** | Trích xuất thông tin key (pet name, symptoms, dates) | Store in session metadata |
| **Context Injection** | Inject relevant context khi chuyển agent | Pass summarized context to sub-agents |

**Implementation Example:**
```python
class ConversationManager:
    async def summarize_if_needed(self, messages: List[Message]) -> List[Message]:
        if len(messages) > 15:
            summary = await self.llm.generate(
                f"Summarize this conversation in 3 bullet points:\n{messages[:10]}"
            )
            return [SystemMessage(f"Previous context: {summary}")] + messages[-5:]
        return messages

    async def extract_entities(self, messages: List[Message]) -> Dict:
        """Extract pet info, symptoms, dates from conversation."""
        extraction_prompt = """
        Extract from conversation:
        - pet_type: (dog/cat/other)
        - pet_name:
        - symptoms: []
        - urgency: (low/medium/high)
        """
        return await self.llm.generate_json(extraction_prompt, messages)
```

---

### 1.3 Response Quality Scoring

**Mục tiêu:** Tự đánh giá và cải thiện chất lượng phản hồi

| Metric | Description | How to Measure |
|--------|-------------|----------------|
| **Completeness** | Câu trả lời có đầy đủ thông tin không? | LLM self-evaluation |
| **Relevance** | Có đúng với câu hỏi không? | Semantic similarity |
| **Helpfulness** | Có actionable không? | Check for recommendations |
| **Safety** | Có khuyên đến bác sĩ khi cần không? | Keyword detection |

**Implementation:**
```python
async def evaluate_response(self, question: str, response: str) -> float:
    eval_prompt = f"""
    Rate this response (0-10):

    Question: {question}
    Response: {response}

    Criteria:
    - Completeness (0-3): Does it fully answer the question?
    - Relevance (0-3): Is it on topic?
    - Helpfulness (0-2): Does it provide actionable advice?
    - Safety (0-2): Does it recommend professional help when needed?

    Return JSON: {{"completeness": X, "relevance": X, "helpfulness": X, "safety": X, "total": X}}
    """
    return await self.llm.generate_json(eval_prompt)
```

---

## LEVEL 2: INTERMEDIATE IMPROVEMENTS (Trung bình - 2-4 tuần)

### 2.1 Retrieval-Augmented Generation (RAG) Enhancement

**Mục tiêu:** Cải thiện độ chính xác của Medical Agent

| Improvement | Description | Impact |
|-------------|-------------|--------|
| **Hybrid Search** | Kết hợp keyword + semantic search | High |
| **Re-ranking** | Re-rank results với cross-encoder | High |
| **Query Expansion** | Mở rộng query với synonyms | Medium |
| **Chunk Optimization** | Điều chỉnh chunk size và overlap | Medium |

**Hybrid Search Implementation:**
```python
class HybridRAGEngine:
    async def search(self, query: str, top_k: int = 5) -> List[Document]:
        # 1. Semantic search (vector)
        semantic_results = await self.qdrant.search(
            query_embedding=self.embed(query),
            limit=top_k * 2
        )

        # 2. Keyword search (BM25)
        keyword_results = self.bm25_search(query, top_k * 2)

        # 3. Reciprocal Rank Fusion
        fused_results = self.reciprocal_rank_fusion(
            semantic_results,
            keyword_results,
            k=60
        )

        # 4. Re-rank with cross-encoder
        reranked = await self.rerank(query, fused_results[:top_k * 2])

        return reranked[:top_k]
```

**Query Expansion:**
```python
async def expand_query(self, query: str) -> str:
    """Expand query with medical synonyms."""
    expansion_prompt = f"""
    Expand this veterinary query with relevant medical terms:
    Query: "{query}"

    Add:
    - Medical synonyms (e.g., "nôn" → "nôn, ói, vomiting, emesis")
    - Related conditions
    - Vietnamese and English terms

    Return expanded query:
    """
    return await self.llm.generate(expansion_prompt)
```

---

### 2.2 Tool Selection Intelligence

**Mục tiêu:** Agent chọn tool chính xác hơn

| Improvement | Description | Implementation |
|-------------|-------------|----------------|
| **Tool Relevance Scoring** | Score mỗi tool theo context | LLM + semantic similarity |
| **Multi-Step Planning** | Plan trước khi execute | ReAct pattern |
| **Tool Chaining** | Tự động chain multiple tools | LangGraph edges |

**ReAct Pattern Implementation:**
```python
async def reason_and_act(self, query: str, tools: List[Tool]) -> str:
    """
    ReAct: Reasoning + Acting pattern
    """
    react_prompt = f"""
    Question: {query}

    Available Tools:
    {self.format_tools(tools)}

    Think step by step:
    1. What information do I need?
    2. Which tool(s) should I use?
    3. In what order?

    Format:
    Thought: [Your reasoning]
    Action: [tool_name]
    Action Input: [parameters]
    """

    while not self.is_complete:
        thought = await self.llm.generate(react_prompt)
        action = self.parse_action(thought)
        observation = await self.execute_tool(action)
        react_prompt += f"\nObservation: {observation}\n"
```

---

### 2.3 Multi-Agent Collaboration Enhancement

**Mục tiêu:** Các agent phối hợp hiệu quả hơn

| Improvement | Description | Impact |
|-------------|-------------|--------|
| **Agent Communication Protocol** | Structured handoff với context | High |
| **Parallel Agent Execution** | Run multiple agents simultaneously | Medium |
| **Agent Consensus** | Multiple agents vote on answer | Medium |
| **Specialist Routing** | Route to most suitable agent | High |

**Structured Handoff Protocol:**
```python
@dataclass
class AgentHandoff:
    source_agent: str
    target_agent: str
    context_summary: str
    extracted_entities: Dict
    confidence: float
    reason: str
    required_actions: List[str]

async def handoff_to_agent(
    self,
    target: str,
    state: AgentState
) -> AgentHandoff:
    """Create structured handoff to another agent."""
    handoff = AgentHandoff(
        source_agent=self.name,
        target_agent=target,
        context_summary=await self.summarize_context(state),
        extracted_entities=await self.extract_entities(state),
        confidence=self.calculate_confidence(state),
        reason=f"User needs {target} expertise",
        required_actions=self.get_pending_actions(state)
    )
    return handoff
```

---

## LEVEL 3: ADVANCED IMPROVEMENTS (Nâng cao - 1-3 tháng)

### 3.1 Continuous Learning from Feedback

**Mục tiêu:** Agent học từ feedback của user và admin

| Component | Description | Implementation |
|-----------|-------------|----------------|
| **Feedback Collection** | Thu thập good/bad ratings | Store in DB |
| **Prompt Refinement** | Update prompts based on feedback | Admin review + auto-suggest |
| **Example Mining** | Extract good examples từ feedback | Add to few-shot examples |
| **Failure Analysis** | Phân tích responses bị đánh giá thấp | Weekly report |

**Feedback Loop Implementation:**
```python
class FeedbackLearner:
    async def process_feedback(
        self,
        session_id: str,
        rating: int,
        comment: str
    ):
        """Process user feedback for learning."""

        # 1. Store feedback
        await self.store_feedback(session_id, rating, comment)

        # 2. If good response, extract as example
        if rating >= 4:
            example = await self.extract_example(session_id)
            await self.add_to_few_shot(example)

        # 3. If bad response, analyze failure
        if rating <= 2:
            failure = await self.analyze_failure(session_id, comment)
            await self.create_improvement_task(failure)

    async def weekly_prompt_refinement(self):
        """Auto-suggest prompt improvements based on feedback."""
        low_rated = await self.get_low_rated_sessions(days=7)

        analysis_prompt = f"""
        Analyze these low-rated conversations and suggest prompt improvements:

        {self.format_sessions(low_rated)}

        For each failure pattern, suggest:
        1. What went wrong
        2. Specific prompt modification
        3. Example to add
        """

        suggestions = await self.llm.generate(analysis_prompt)
        await self.notify_admin(suggestions)
```

---

### 3.2 Knowledge Base Auto-Update

**Mục tiêu:** Knowledge base tự động cập nhật với thông tin mới

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Web Crawling Schedule** | Định kỳ crawl trusted sources | Scheduled job |
| **Content Validation** | Validate trước khi index | LLM + source checking |
| **Duplicate Detection** | Detect similar content | Semantic dedup |
| **Freshness Scoring** | Prioritize recent content | Time decay |

**Auto-Update Pipeline:**
```python
class KnowledgeAutoUpdater:
    TRUSTED_SOURCES = [
        "https://www.petmd.com",
        "https://www.akc.org",
        "https://www.vin.com"  # Veterinary Information Network
    ]

    async def daily_update(self):
        """Daily knowledge base update."""

        for source in self.TRUSTED_SOURCES:
            # 1. Crawl new articles
            articles = await self.crawler.get_new_articles(source, days=1)

            for article in articles:
                # 2. Validate content
                if not await self.validate_content(article):
                    continue

                # 3. Check duplicates
                if await self.is_duplicate(article):
                    continue

                # 4. Process and index
                chunks = self.document_processor.chunk(article)
                await self.rag_engine.index_chunks(chunks)

        # 5. Update freshness scores
        await self.update_freshness_scores()
```

---

### 3.3 Personalization Engine

**Mục tiêu:** Cá nhân hóa trải nghiệm cho từng user

| Feature | Description | Data Used |
|---------|-------------|-----------|
| **Pet Profile Integration** | Biết pet của user | Pet DB |
| **Conversation History** | Nhớ tương tác trước | Chat history |
| **Preference Learning** | Học style user thích | Interaction patterns |
| **Proactive Suggestions** | Gợi ý dựa trên context | Pet health + schedule |

**Personalization Implementation:**
```python
class PersonalizationEngine:
    async def get_user_context(self, user_id: str) -> UserContext:
        """Build rich user context for personalization."""

        return UserContext(
            # Pet information
            pets=await self.get_user_pets(user_id),

            # Recent interactions
            recent_topics=await self.get_recent_topics(user_id, days=30),

            # Preferences
            preferred_language=await self.detect_language_preference(user_id),
            detail_level=await self.detect_detail_preference(user_id),  # brief/detailed

            # Health alerts
            upcoming_vaccines=await self.get_upcoming_vaccines(user_id),
            pending_checkups=await self.get_pending_checkups(user_id)
        )

    async def personalize_response(
        self,
        response: str,
        context: UserContext
    ) -> str:
        """Personalize response based on user context."""

        personalization_prompt = f"""
        Personalize this response for the user:

        Original: {response}

        User Context:
        - Pets: {context.pets}
        - Recent topics: {context.recent_topics}
        - Prefers: {context.detail_level} answers

        Add personal touches like using pet names,
        referencing previous conversations if relevant.
        """

        return await self.llm.generate(personalization_prompt)
```

---

### 3.4 Multi-Modal Support (Hình ảnh)

**Mục tiêu:** Agent hiểu và phân tích hình ảnh thú cưng

| Feature | Description | Use Case |
|---------|-------------|----------|
| **Image Analysis** | Phân tích triệu chứng qua ảnh | Skin conditions, wounds |
| **Breed Detection** | Nhận diện giống | Auto-fill pet profile |
| **Health Indicators** | Phát hiện dấu hiệu bất thường | Eye discharge, coat quality |

**Implementation với Vision Model:**
```python
class VisionAgent:
    def __init__(self):
        self.vision_model = "llava:13b"  # or GPT-4V

    async def analyze_pet_image(
        self,
        image_base64: str,
        query: str
    ) -> str:
        """Analyze pet image for health indicators."""

        prompt = f"""
        Analyze this pet image for the following query: {query}

        Check for:
        1. Visible symptoms (skin issues, discharge, swelling)
        2. Overall condition (coat quality, posture)
        3. Any abnormalities

        Important: Always recommend professional vet examination
        for proper diagnosis.
        """

        response = await self.ollama.generate(
            model=self.vision_model,
            prompt=prompt,
            images=[image_base64]
        )

        return response
```

---

## LEVEL 4: CUTTING-EDGE IMPROVEMENTS (Nghiên cứu - 3+ tháng)

### 4.1 Agent Self-Improvement Loop

**Mục tiêu:** Agent tự cải thiện performance

```
┌─────────────────────────────────────────────────────────────┐
│                    SELF-IMPROVEMENT LOOP                     │
│                                                              │
│  ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌───────┐ │
│  │ Execute │───▶│ Evaluate │───▶│ Analyze   │───▶│ Update│ │
│  │ Task    │    │ Result   │    │ Failures  │    │ Prompt│ │
│  └─────────┘    └──────────┘    └───────────┘    └───────┘ │
│       ▲                                              │      │
│       └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.2 Knowledge Graph Integration

**Mục tiêu:** Reasoning phức tạp hơn với knowledge graph

| Benefit | Description |
|---------|-------------|
| **Relationship Reasoning** | "Parvo affects puppies more" |
| **Symptom Clustering** | Group related symptoms |
| **Treatment Paths** | Connect symptoms → diagnosis → treatment |
| **Drug Interactions** | Check medication conflicts |

---

### 4.3 Emotion & Sentiment Handling

**Mục tiêu:** Phản hồi phù hợp với cảm xúc user

| Emotion | Response Strategy |
|---------|-------------------|
| **Anxious** | Reassuring, calm tone |
| **Urgent** | Quick, action-focused |
| **Confused** | Step-by-step explanation |
| **Frustrated** | Empathetic, solution-oriented |

---

## IMPLEMENTATION PRIORITY MATRIX

```
                    IMPACT
            Low         High
         ┌───────────┬───────────┐
    Easy │ 1.3       │ 1.1, 1.2  │
         │ Response  │ Prompts,  │
EFFORT   │ Scoring   │ Context   │
         ├───────────┼───────────┤
    Hard │ 4.2       │ 2.1, 2.2  │
         │ Knowledge │ RAG, Tool │
         │ Graph     │ Selection │
         └───────────┴───────────┘
```

**Recommended Order:**
1. **Week 1-2:** Level 1 (Foundation) - Prompt engineering, context management
2. **Week 3-6:** Level 2 (Intermediate) - RAG enhancement, tool selection
3. **Month 2-3:** Level 3 (Advanced) - Feedback learning, personalization
4. **Month 4+:** Level 4 (Cutting-edge) - Self-improvement, knowledge graph

---

## METRICS TO TRACK

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Response Accuracy** | >85% | User feedback rating |
| **Intent Classification** | >90% | Manual evaluation |
| **Tool Selection** | >95% | Log analysis |
| **Response Time** | <3s | p95 latency |
| **User Satisfaction** | >4.0/5 | Average rating |
| **RAG Relevance** | >80% | Retrieval precision |

---

## CONCLUSION

Roadmap này cung cấp lộ trình rõ ràng để cải thiện Agent Petties từng bước:

1. **Short-term (1-2 tuần):** Prompt engineering + context management → 20-30% improvement
2. **Medium-term (1-2 tháng):** RAG + tool selection → 40-50% improvement
3. **Long-term (3+ tháng):** Personalization + learning → 60-80% improvement

Mỗi improvement có thể được implement độc lập và measure hiệu quả riêng.

---

**Document Maintained By:** Petties AI Team
**Next Review:** After Level 1 completion
