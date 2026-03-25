import re
import sys

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 1. Update imports in initialize()
    content = content.replace(
        "from llama_index.core.graph_stores import SimpleGraphStore",
        ""
    )
    
    # 2. Update __init__
    content = re.sub(
        r"def __init__\(self, persist_dir: str = KG_PERSIST_DIR\) -> None:.*?# Deduplication tracking",
        "def __init__(self) -> None:\n        \"\"\"Khởi tạo service.\"\"\"\n        self._kg_index = None\n        self._llm_model = \"google/gemini-2.5-flash-lite\"\n        self._initialized = False\n\n        # Deduplication tracking",
        content,
        flags=re.DOTALL
    )
    
    # 3. Replace _load_tracking_state with empty or remove. It is called in initialize.
    
    # 4. Modify initialize to remove SimpleGraphStore logic
    init_match = re.search(r"(# Load or create graph store.*?self\._initialized = True)", content, re.DOTALL)
    if init_match:
        new_init = "self._processed_doc_ids = set()\n            self._initialized = True"
        content = content.replace(init_match.group(1), new_init)
        
    # 5. Modify build_from_documents
    # find lines from "# Lưu triplets vào graph store" to "self._persist()"
    build_pattern = r"(# Lưu triplets vào graph store \(chỉ triplets hợp lệ\).*?)self\._persist\(\)"
    
    mongo_upsert_logic = """# Lưu triplets vào MongoDB
            saved_count = 0
            
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            kg_collection = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION]
            
            for subj, pred, obj in triplets:
                subj_clean = subj.strip()
                pred_clean = pred.strip()
                obj_clean = obj.strip()

                # Validation
                if not subj_clean or not pred_clean or not obj_clean:
                    continue
                if len(subj_clean) > 200 or len(pred_clean) > 100 or len(obj_clean) > 200:
                    continue
                
                # Deduplication hash
                triplet_hash = self._get_triplet_hash(subj_clean, pred_clean, obj_clean)
                
                doc_record = {
                    "subject": subj_clean,
                    "predicate": pred_clean,
                    "object": obj_clean,
                    "source": "documents",
                    "triplet_hash": triplet_hash
                }
                
                try:
                    await kg_collection.update_one(
                        {"subject": subj_clean, "predicate": pred_clean, "object": obj_clean},
                        {"$setOnInsert": doc_record},
                        upsert=True
                    )
                    saved_count += 1
                except Exception as e:
                    logger.warning(f"Error inserting triplet to MongoDB: {e}")

            # Track processed document IDs
            for doc in documents:
                doc_id = doc.metadata.get("document_id") if doc.metadata else None
                if doc_id:
                    self._processed_doc_ids.add(str(doc_id))
"""
    content = re.sub(build_pattern, mongo_upsert_logic, content, flags=re.DOTALL)
    
    # Remove "if self._graph_store is None:" checks
    content = content.replace("if self._graph_store is None:\n            logger.warning(\"KnowledgeGraphService not available, skipping build\")\n            return 0", "")
    content = content.replace("if self._graph_store is None:\n            return []", "")
    content = content.replace("if not text or not text.strip() or self._graph_store is None:\n            return 0", "if not text or not text.strip():\n            return 0")
    content = content.replace("if self._graph_store is None:\n            return {\n                \"initialized\": False,\n                \"error\": \"KnowledgeGraphService not available\",\n            }", "")
    content = content.replace("if self._graph_store is None:\n            return {\"success\": False, \"error\": \"Graph store not initialized\"}", "")
    content = content.replace("if self._graph_store is None:\n            return {\"nodes\": [], \"edges\": [], \"error\": \"Graph store not initialized\"}", "")
    
    # 6. Update add_text_to_graph
    add_txt_pattern = r"(import AsyncSessionLocal.*?try:.*?upsert_triplet.*?)self\._persist\(\)"
    add_mongo_logic = """import AsyncSessionLocal
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings

        async with AsyncSessionLocal() as db:
            openrouter_api_key = await get_setting("OPENROUTER_API_KEY", db)

        if not openrouter_api_key:
            return 0

        # Trích xuất triplets sử dụng LLM
        triplets = await self._extract_triplets_with_llm(text, openrouter_api_key)

        db_mongo = await get_mongodb_database()
        kg_collection = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION]

        added_count = 0
        for subj, pred, obj in triplets:
            subj = self._clean_text(subj)
            pred = self._clean_text(pred)
            obj = self._clean_text(obj)

            if not subj or not pred or not obj:
                continue

            try:
                triplet_hash = self._get_triplet_hash(subj, pred, obj)
                doc_record = {
                    "subject": subj,
                    "predicate": pred,
                    "object": obj,
                    "source": "text_auto_update",
                    "triplet_hash": triplet_hash
                }
                res = await kg_collection.update_one(
                    {"subject": subj, "predicate": pred, "object": obj},
                    {"$setOnInsert": doc_record},
                    upsert=True
                )
                if res.upserted_id:
                    added_count += 1
            except Exception as e:
                logger.warning(f"Error adding triplet ({subj}, {pred}, {obj}): {e}")

        if added_count > 0:
"""
    content = re.sub(r"import AsyncSessionLocal.*?if added_count > 0:\n\s*self\._persist\(\)", add_mongo_logic, content, flags=re.DOTALL)
    
    # 7. Update get_graph_stats
    stats_replacement = """        triplet_count = await self._count_triplets()
        triplets = await self._get_all_triplets()

        # Count unique entities and relation types
        subjects = set()
        objects = set()
        predicates = set()
        for subj, pred, obj in triplets:
            subjects.add(subj)
            objects.add(obj)
            predicates.add(pred)

        all_entities = subjects | objects

        return {
            "initialized": self._initialized,
            "has_index": self._kg_index is not None,
            "triplet_count": triplet_count,
            "entity_count": len(all_entities),
            "relation_types": sorted(list(predicates)),
            "relation_type_count": len(predicates)
        }"""
    content = re.sub(r"triplet_count = self\._count_triplets\(\).*?persist_dir\": self\._persist_dir,\n        \}", stats_replacement, content, flags=re.DOTALL)
    
    # 8. Update get_graph_visualization_data
    viz_replacement = """        triplets = await self._get_all_triplets()

        if not triplets:
            return {"nodes": [], "edges": [], "error": "No triplets found"}"""
    content = re.sub(r"triplets = self\._get_triplets_from_store\(self\._graph_store\)\n\n\s*if not triplets:\n\s*return {\"nodes\": \[\], \"edges\": \[\], \"error\": \"No triplets found\"}", viz_replacement, content, flags=re.DOTALL)
    
    # 9. Update query_graph
    query_replacement = """            all_triplets = await self._get_all_triplets()
            if not all_triplets:
                logger.info("KG query: graph store is empty")
                return []"""
    content = re.sub(r"all_triplets = self\._get_triplets_from_store\(self\._graph_store\)\n\s*if not all_triplets:\n\s*logger\.info\(\"KG query: graph store is empty\"\)\n\s*return \[\]", query_replacement, content, flags=re.DOTALL)
    
    # 10. Update reset_knowledge_graph
    reset_replacement = """        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            kg_collection = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION]
            await kg_collection.delete_many({})

            self._triplet_hashes = set()
            self._processed_doc_ids = set()

            logger.info("Knowledge Graph has been reset in MongoDB")
            return {
                "success": True,
                "message": "Đã xóa toàn bộ KG và bắt đầu lại từ đầu",
            }"""
    content = re.sub(r"try:\n\s*# Create new empty graph store.*?message\": \"Đã xóa toàn bộ KG và.*?\n\s*\}", reset_replacement, content, flags=re.DOTALL)

    # 11. Add _get_all_triplets and fix _count_triplets
    helpers_replacement = """    async def _count_triplets(self) -> int:
        \"\"\"Đếm tổng số triplets trong graph store.\"\"\"
        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            return await db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION].count_documents({})
        except Exception:
            return 0

    async def _get_all_triplets(self) -> List[Tuple[str, str, str]]:
        \"\"\"Trích xuất tất cả triplets từ MongoDB.\"\"\"
        triplets = []
        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            cursor = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION].find({}, {"subject": 1, "predicate": 1, "object": 1, "_id": 0})
            docs = await cursor.to_list(length=None)
            for d in docs:
                triplets.append((d.get("subject", ""), d.get("predicate", ""), d.get("object", "")))
        except Exception as e:
            logger.warning(f"Failed to fetch triplets from MongoDB: {e}")
        return triplets"""
    
    content = re.sub(r"def _count_triplets.*?def _load_index_from_store", helpers_replacement + "\n\n    async def _load_index_from_store", content, flags=re.DOTALL)
    
    # Remove _persist
    content = re.sub(r"def _persist\(self\) -> None:.*?logger\.warning.*?\{e\}\"\)", "", content, flags=re.DOTALL)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

process_file(r"d:\SEP490\petties\petties-agent-serivce\app\core\rag\knowledge_graph.py")
