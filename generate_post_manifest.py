import os
import re
import json
from datetime import datetime

# --- 설정 ---
# 프로젝트의 기본 디렉토리 경로를 설정합니다.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSTS_DIR = os.path.join(BASE_DIR, "posts")
OUTPUT_FILE = os.path.join(BASE_DIR, "js", "post-manifest.js")
DEFAULT_AUTHOR = "SleepyFinger"
EXCERPT_LENGTH = 150
# --- 설정 끝 ---

def parse_markdown_file(filepath):
    """
    마크다운 파일을 파싱하여 머리말(frontmatter)과 본문 내용을 분리합니다.
    app.js의 parseMarkdown 함수 로직을 참고하여 Python으로 구현했습니다.
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = [line.rstrip('\n') for line in f.readlines()]
    except Exception as e:
        print(f"Error reading file {filepath}: {e}")
        return None

    if not lines or lines[0].strip() != "---":
        print(f"Warning: No frontmatter found or not starting with '---' in {filepath}.")
        return {'metadata': {}, 'content': "\n".join(lines).strip()}

    frontmatter = {}
    content_lines = []
    in_frontmatter = True
    frontmatter_end_found = False

    # 첫 번째 '---' 다음 라인부터 시작
    for i in range(1, len(lines)):
        line = lines[i]
        if in_frontmatter:
            if line.strip() == "---":
                in_frontmatter = False
                frontmatter_end_found = True
                continue  # 닫는 '---' 라인은 내용에 포함하지 않음
            
            separator_index = line.find(":")
            if separator_index > 0:
                key = line[:separator_index].strip()
                value = line[separator_index+1:].strip()
                # JavaScript와 유사하게 따옴표 처리
                if (value.startswith("'") and value.endswith("'")) or \
                   (value.startswith('"') and value.endswith('"')):
                    value = value[1:-1]
                frontmatter[key] = value
        else:
            content_lines.append(line)
    
    if not frontmatter_end_found:
        # app.js의 로직: '---'로 시작했지만 닫는 '---'가 없는 경우,
        # 첫 '---' 이후의 모든 것을 내용으로 간주 (메타데이터는 없음)
        print(f"Warning: Frontmatter in {filepath} did not end with '---'. Treating content after initial '---'.")
        return {'metadata': {}, 'content': "\n".join(lines[1:]).strip()}

    return {'metadata': frontmatter, 'content': "\n".join(content_lines).strip()}

def generate_excerpt(markdown_content, length=EXCERPT_LENGTH):
    """
    마크다운 내용에서 간단한 요약을 생성합니다.
    """
    if not markdown_content:
        return ""

    # 1. 간단한 마크다운 제거 (HTML 태그는 없다고 가정)
    text = re.sub(r'^\s*#+\s+', '', markdown_content, flags=re.MULTILINE) # 헤더 제거
    text = re.sub(r'(\*\*|__)(.*?)(\*\*|__)', r'\2', text) # 볼드
    text = re.sub(r'(\*|_)(.*?)(\*|_)', r'\2', text)     # 이탤릭
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text) # 링크 (텍스트만 남김)
    text = re.sub(r'!\[[^\]]*\]\([^\)]+\)', '', text)    # 이미지 제거
    text = re.sub(r'`([^`]+)`', r'\1', text)             # 인라인 코드
    text = re.sub(r'```[\s\S]*?```', '', text)           # 코드 블록
    text = re.sub(r'^\s*([-*_]){3,}\s*$', '', text, flags=re.MULTILINE) # 수평선

    # 2. 여러 공백/줄바꿈을 단일 공백으로 변경 후 앞뒤 공백 제거
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 3. 지정된 길이로 자르기
    if len(text) <= length:
        return text
    else:
        excerpt = text[:length]
        last_space = excerpt.rfind(' ')
        if last_space > length / 2: # 너무 짧게 잘리지 않도록
            excerpt = excerpt[:last_space]
        return excerpt + "..."

def main():
    all_posts_data = []
    
    if not os.path.exists(POSTS_DIR):
        print(f"Error: Posts directory not found at '{POSTS_DIR}'")
        return

    print(f"Scanning posts in '{POSTS_DIR}'...")
    for filename in os.listdir(POSTS_DIR):
        if filename.endswith(".md"):
            slug = filename[:-3].lower() # .md 확장자 제거 및 소문자화
            filepath = os.path.join(POSTS_DIR, filename)
            
            print(f"  Processing '{filename}'...")
            parsed_data = parse_markdown_file(filepath)
            if not parsed_data:
                print(f"    Warning: Could not parse '{filename}'. Skipping.")
                continue

            metadata = parsed_data.get('metadata', {})
            content = parsed_data.get('content', "")

            title = metadata.get('title', slug.replace('-', ' ').replace('_', ' ').title())
            author = metadata.get('author', DEFAULT_AUTHOR)
            date_str = metadata.get('date')

            if not date_str:
                try:
                    mtime = os.path.getmtime(filepath)
                    date_str = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')
                    print(f"    Warning: No 'date' in frontmatter for '{filename}'. Using file modification date: {date_str}")
                except Exception as e:
                    date_str = "YYYY-MM-DD" # 기본값
                    print(f"    Warning: No 'date' in frontmatter for '{filename}' and failed to get modification date ({e}). Using placeholder: {date_str}")
            
            # 머리말에 excerpt가 있으면 그것을 사용, 없으면 자동 생성
            excerpt = metadata.get('excerpt')
            if not excerpt:
                excerpt = generate_excerpt(content)
                if not excerpt and content: # 내용이 있는데 요약이 안만들어진 경우
                     print(f"    Warning: Could not auto-generate excerpt for '{filename}'. It might be empty or too short after stripping markdown.")

            post_entry = {
                "slug": slug,
                "title": title,
                "author": author,
                "date": date_str,
                "excerpt": excerpt
            }
            all_posts_data.append(post_entry)

    # 날짜를 기준으로 최신 글이 먼저 오도록 정렬 (app.js와 동일한 로직)
    all_posts_data.sort(key=lambda p: p.get('date', '0000-00-00'), reverse=True)

    # JavaScript 파일 내용 생성
    # json.dumps를 사용하여 JavaScript 객체 배열 형태로 만듭니다.
    # indent=2로 가독성을 높이고, ensure_ascii=False로 한글이 유니코드로 변환되지 않도록 합니다.
    js_output_content = "const postManifest = "
    js_output_content += json.dumps(all_posts_data, indent=2, ensure_ascii=False)
    js_output_content += ";\n"

    try:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True) # js 폴더가 없으면 생성
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(js_output_content)
        print(f"\nSuccessfully generated '{OUTPUT_FILE}' with {len(all_posts_data)} post(s).")
    except IOError as e:
        print(f"\nError writing to '{OUTPUT_FILE}': {e}")

if __name__ == "__main__":
    main()
