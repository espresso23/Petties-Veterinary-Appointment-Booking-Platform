"""
Test script to verify document delete operation removes vectors from Qdrant

This script:
1. Uploads a test document
2. Verifies vectors are created in Qdrant
3. Deletes the document
4. Verifies vectors are removed from Qdrant
"""
import requests
import time
import os

BASE_URL = "http://localhost:8000/api/v1/knowledge"

# Test file content
TEST_CONTENT = """
Bệnh ghẻ ở chó mèo

Bệnh ghẻ là một bệnh da rất phổ biến ở chó mèo, do ký sinh trùng ghẻ gây ra.

Triệu chứng:
- Ngứa dữ dội, thú cưng cào liên tục
- Rụng lông từng mảng, da bị tổn thương
- Da dày lên, sần sùi, có mảng vảy
- Thường xuất hiện ở tai, khuỷu chân, bụng

Điều trị:
- Tắm thuốc diệt ghẻ chuyên dụng
- Dùng thuốc tiêm/uống theo chỉ định bác sĩ
- Vệ sinh nơi ở, đồ dùng của thú cưng
- Cách ly để tránh lây lan
"""


def upload_test_document():
    """Upload test document"""
    print("\n" + "=" * 80)
    print("STEP 1: UPLOADING TEST DOCUMENT")
    print("=" * 80)

    # Create test file
    test_file_path = "test_document_ghe.txt"
    with open(test_file_path, "w", encoding="utf-8") as f:
        f.write(TEST_CONTENT)

    try:
        with open(test_file_path, "rb") as f:
            files = {"file": (test_file_path, f, "text/plain")}
            data = {
                "uploaded_by": "test_user",
                "notes": "Test document for delete verification"
            }

            response = requests.post(f"{BASE_URL}/upload", files=files, data=data)
            response.raise_for_status()
            result = response.json()

            print(f"[OK] Upload successful!")
            print(f"   Document ID: {result['document_id']}")
            print(f"   Filename: {result['filename']}")
            print(f"   File size: {result['file_size']} bytes")

            return result['document_id']

    finally:
        # Cleanup test file
        if os.path.exists(test_file_path):
            os.remove(test_file_path)


def wait_for_processing(document_id: int, max_wait: int = 30):
    """Wait for document to be processed"""
    print("\n" + "=" * 80)
    print("STEP 2: WAITING FOR PROCESSING")
    print("=" * 80)

    for i in range(max_wait):
        response = requests.get(f"{BASE_URL}/documents")
        response.raise_for_status()
        data = response.json()

        doc = next((d for d in data['documents'] if d['id'] == document_id), None)
        if doc:
            if doc['processed']:
                print(f"[OK] Processing complete!")
                print(f"   Vectors created: {doc['vector_count']}")
                return doc['vector_count']
            else:
                print(f"[WAIT] Processing... ({i+1}s)")

        time.sleep(1)

    raise Exception(f"[ERROR] Processing timeout after {max_wait}s")


def check_qdrant_before_delete():
    """Check Qdrant collection before delete"""
    print("\n" + "=" * 80)
    print("STEP 3: CHECKING QDRANT BEFORE DELETE")
    print("=" * 80)

    response = requests.get(f"{BASE_URL}/debug/qdrant")
    response.raise_for_status()
    data = response.json()

    print(f"Collection exists: {data.get('exists', False)}")
    print(f"Total points: {data.get('collection_info', {}).get('points_count', 0)}")
    print(f"Sample points: {len(data.get('sample_points', []))}")

    return data.get('collection_info', {}).get('points_count', 0)


def delete_document(document_id: int):
    """Delete document"""
    print("\n" + "=" * 80)
    print("STEP 4: DELETING DOCUMENT")
    print("=" * 80)

    response = requests.delete(f"{BASE_URL}/documents/{document_id}")

    if response.ok:
        result = response.json()
        print(f"[OK] Delete successful!")
        print(f"   Message: {result['message']}")
        print(f"   Vectors deleted: {result['vectors_deleted']}")
        return True
    else:
        error_data = response.json()
        print(f"[ERROR] Delete failed!")
        print(f"   Status: {response.status_code}")
        print(f"   Error: {error_data.get('detail', 'Unknown error')}")
        return False


def check_qdrant_after_delete():
    """Check Qdrant collection after delete"""
    print("\n" + "=" * 80)
    print("STEP 5: CHECKING QDRANT AFTER DELETE")
    print("=" * 80)

    response = requests.get(f"{BASE_URL}/debug/qdrant")
    response.raise_for_status()
    data = response.json()

    print(f"Collection exists: {data.get('exists', False)}")
    print(f"Total points: {data.get('collection_info', {}).get('points_count', 0)}")
    print(f"Sample points: {len(data.get('sample_points', []))}")

    return data.get('collection_info', {}).get('points_count', 0)


def main():
    print("\n" + "=" * 80)
    print(" " * 20 + "DELETE VERIFICATION TEST")
    print("=" * 80)

    try:
        # Step 1: Upload
        document_id = upload_test_document()

        # Step 2: Wait for processing
        vector_count = wait_for_processing(document_id)

        # Step 3: Check Qdrant before delete
        points_before = check_qdrant_before_delete()

        # Step 4: Delete document
        delete_success = delete_document(document_id)

        # Step 5: Check Qdrant after delete
        time.sleep(2)  # Wait for Qdrant to update
        points_after = check_qdrant_after_delete()

        # Verify results
        print("\n" + "=" * 80)
        print("VERIFICATION RESULTS")
        print("=" * 80)

        if delete_success:
            expected_points_after = points_before - vector_count

            if points_after == expected_points_after:
                print("[PASS] Vectors correctly removed from Qdrant")
                print(f"   Points before: {points_before}")
                print(f"   Vectors deleted: {vector_count}")
                print(f"   Points after: {points_after} (expected: {expected_points_after})")
            else:
                print("[FAIL] Vector count mismatch!")
                print(f"   Points before: {points_before}")
                print(f"   Vectors deleted: {vector_count}")
                print(f"   Points after: {points_after} (expected: {expected_points_after})")
                print("\n[WARNING] This indicates orphaned vectors in Qdrant!")
        else:
            print("[FAIL] Delete operation failed")

        print("\n" + "=" * 80)

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
